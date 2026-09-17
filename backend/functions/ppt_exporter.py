from pathlib import Path
import os
import re
import zipfile

import pythoncom
import win32com.client

from backend.functions.powerpoint_com import POWERPOINT_COM_LOCK


LATIN_FONT = "Liberation Sans"
EAST_ASIA_FONT = "方正兰亭黑简体"

# 匹配一个完整的 <a:latin> 元素（自闭合或带子节点两种形态）
_LATIN_ELEMENT = rb'<a:latin\b[^>]*/>|<a:latin\b[^>]*>.*?</a:latin>'
# 匹配带内容的字符/字体属性元素（排除自闭合），用于在缺 <a:ea> 时补齐中文槽；
# 覆盖继承链每一级：run(rPr/endParaRPr)、段落与版式(defRPr)、主题(majorFont/minorFont)
_PROP_ELEMENT = rb'<a:(rPr|defRPr|endParaRPr|majorFont|minorFont)\b[^>]*(?<!/)>(.*?)</a:\1>'
# OOXML 中必须排在 <a:ea> 之后的子元素，块内没有 <a:latin> 时按此定位插入点
_EA_FOLLOWERS = (b"<a:cs", b"<a:sym", b"<a:hlinkClick", b"<a:hlinkMouseOver", b"<a:rtl", b"<a:extLst")
# 匹配一个完整的文本 run，用于按文本内容归一化语言属性
_RUN_ELEMENT = rb'<a:r>.*?</a:r>'
# 中日韩表意文字与中文标点，作为“该 run 含中文”的判定依据
_CJK_TEXT = re.compile('[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]')


def _set_lang_on_rpr(tag: bytes) -> bytes:
    if b'lang="' in tag:
        tag = re.sub(rb'lang="[^"]*"', b'lang="zh-CN"', tag, count=1)
    else:
        tag = tag.replace(b'<a:rPr', b'<a:rPr lang="zh-CN"', 1)
    if b'altLang="' not in tag:
        tag = tag.replace(b'lang="zh-CN"', b'lang="zh-CN" altLang="en-US"', 1)
    return tag


def _normalize_run_lang(run_block: bytes) -> bytes:
    # 只有含中文的 run 才改 lang；纯英文/数字 run 保持原样，拉丁字体外观不变
    m = re.search(rb'<a:t>(.*?)</a:t>', run_block, re.DOTALL)
    if not m or not _CJK_TEXT.search(m.group(1).decode('utf-8', 'ignore')):
        return run_block
    if b'<a:rPr' in run_block:
        return re.sub(
            rb'<a:rPr\b[^>]*>',
            lambda mm: _set_lang_on_rpr(mm.group(0)),
            run_block,
            count=1,
        )
    return run_block.replace(b'<a:r>', b'<a:r><a:rPr lang="zh-CN" altLang="en-US"/>', 1)


def _write_package_fonts(pptx_path: Path) -> None:
    temp_path = pptx_path.with_suffix(".font-update.pptx")
    latin = LATIN_FONT.encode("utf-8")
    east_asia = EAST_ASIA_FONT.encode("utf-8")
    ea_tag = b'<a:ea typeface="' + east_asia + b'"/>'

    def ensure_ea(prop_block: bytes) -> bytes:
        # 只要缺 <a:ea> 就补：中文要么靠本 run 的 latin 槽、要么逐级继承
        # (defRPr/listStyle/theme)，任何一级缺 ea 都会塌陷成 Liberation Sans
        if b"<a:ea" in prop_block:
            return prop_block
        if b"<a:latin" in prop_block:
            return re.sub(
                _LATIN_ELEMENT,
                lambda m: m.group(0) + ea_tag,
                prop_block,
                count=1,
                flags=re.DOTALL,
            )
        # 没有 latin 时，插到第一个必须排在 ea 之后的元素之前，保持 schema 顺序
        for follower in _EA_FOLLOWERS:
            idx = prop_block.find(follower)
            if idx != -1:
                return prop_block[:idx] + ea_tag + prop_block[idx:]
        close_idx = prop_block.rfind(b"</a:")
        if close_idx == -1:
            return prop_block
        return prop_block[:close_idx] + ea_tag + prop_block[close_idx:]

    try:
        with zipfile.ZipFile(pptx_path, "r") as source, zipfile.ZipFile(temp_path, "w") as target:
            for entry in source.infolist():
                data = source.read(entry.filename)
                if entry.filename.startswith("ppt/") and entry.filename.endswith(".xml"):
                    data = re.sub(
                        rb'(<a:latin\b[^>]*\btypeface=")[^"]*(")',
                        rb'\g<1>' + latin + rb'\2',
                        data,
                    )
                    data = re.sub(
                        rb'(<a:ea\b[^>]*\btypeface=")[^"]*(")',
                        rb'\g<1>' + east_asia + rb'\2',
                        data,
                    )
                    for placeholder in (b"+mn-lt", b"+mj-lt"):
                        data = data.replace(b'typeface="' + placeholder + b'"', b'typeface="' + latin + b'"')
                    for placeholder in (b"+mn-ea", b"+mj-ea"):
                        data = data.replace(b'typeface="' + placeholder + b'"', b'typeface="' + east_asia + b'"')
                    # 补齐缺失的中文槽，兜住 COM 阶段没设到 NameFarEast 的 run
                    data = re.sub(
                        _PROP_ELEMENT,
                        lambda m: ensure_ea(m.group(0)),
                        data,
                        flags=re.DOTALL,
                    )
                    # 归一化语言属性：含中文但 lang 非中文的 run 会被 PowerPoint
                    # 按拉丁槽取字体，导致中文塌陷成 Liberation Sans
                    data = re.sub(
                        _RUN_ELEMENT,
                        lambda m: _normalize_run_lang(m.group(0)),
                        data,
                        flags=re.DOTALL,
                    )
                target.writestr(entry, data)
        os.replace(temp_path, pptx_path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def _set_text_font(text_range) -> None:
    def apply_font(target) -> None:
        try:
            target.Font.Name = LATIN_FONT
        except Exception:
            pass
        try:
            target.Font.NameFarEast = EAST_ASIA_FONT
        except Exception:
            pass

    apply_font(text_range)
    try:
        runs = text_range.Runs()
        for index in range(1, runs.Count + 1):
            apply_font(text_range.Runs(index, 1))
    except Exception:
        pass


def _set_shape_text_font(shape) -> None:
    try:
        if shape.HasTextFrame and shape.TextFrame.HasText:
            _set_text_font(shape.TextFrame.TextRange)
    except Exception:
        pass
    try:
        if shape.HasTextFrame and shape.TextFrame2.HasText:
            _set_text_font(shape.TextFrame2.TextRange)
    except Exception:
        pass


def _set_shape_font(shape) -> None:
    try:
        if shape.Type == 6:
            for index in range(1, shape.GroupItems.Count + 1):
                _set_shape_font(shape.GroupItems.Item(index))
            return
    except Exception:
        pass

    try:
        if shape.HasTable:
            for row in range(1, shape.Table.Rows.Count + 1):
                for column in range(1, shape.Table.Columns.Count + 1):
                    cell = shape.Table.Cell(row, column).Shape
                    _set_shape_text_font(cell)
            return
    except Exception:
        pass

    _set_shape_text_font(shape)

    try:
        if shape.HasSmartArt:
            for index in range(1, shape.SmartArt.AllNodes.Count + 1):
                _set_text_font(shape.SmartArt.AllNodes.Item(index).TextFrame2.TextRange)
    except Exception:
        pass

    try:
        if shape.HasChart:
            chart = shape.Chart
            if chart.HasTitle:
                _set_text_font(chart.ChartTitle.Format.TextFrame2.TextRange)
            if chart.HasLegend:
                _set_text_font(chart.Legend.Format.TextFrame2.TextRange)
    except Exception:
        pass


def export_ppt_pages(pages: list[dict], output_path: str) -> str:
    """Export source PPT pages in the exact order provided."""
    if not pages:
        raise ValueError("至少选择一张页面")

    output = Path(output_path).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    powerpoint = None
    merged = None

    with POWERPOINT_COM_LOCK:
        pythoncom.CoInitialize()
        try:
            powerpoint = win32com.client.DispatchEx("PowerPoint.Application")
            merged = powerpoint.Presentations.Add()
            slide_counts = {}

            for item in pages:
                source = str(Path(item["source_ppt_path"]).resolve())
                page_no = int(item["source_page_no"])
                if not Path(source).is_file():
                    raise FileNotFoundError(f"源 PPT 不存在: {source}")

                if source not in slide_counts:
                    presentation = powerpoint.Presentations.Open(
                        source, ReadOnly=True, WithWindow=False
                    )
                    try:
                        slide_counts[source] = presentation.Slides.Count
                        if merged.Slides.Count == 0:
                            merged.PageSetup.SlideWidth = presentation.PageSetup.SlideWidth
                            merged.PageSetup.SlideHeight = presentation.PageSetup.SlideHeight
                    finally:
                        presentation.Close()

                if page_no < 1 or page_no > slide_counts[source]:
                    raise ValueError(f"{Path(source).name} 页码越界: {page_no}")
                merged.Slides.InsertFromFile(
                    source, merged.Slides.Count, page_no, page_no
                )

            for slide_index in range(1, merged.Slides.Count + 1):
                slide = merged.Slides.Item(slide_index)
                for shape_index in range(1, slide.Shapes.Count + 1):
                    _set_shape_font(slide.Shapes.Item(shape_index))

            merged.SaveAs(str(output), 24)
        finally:
            if merged is not None:
                merged.Close()
            if powerpoint is not None:
                powerpoint.Quit()
            pythoncom.CoUninitialize()

    _write_package_fonts(output)
    return str(output)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4:
        print("usage: ppt_exporter.py SOURCE_PPT PAGE_NO OUTPUT_PPTX")
    else:
        print(export_ppt_pages(
            [{"source_ppt_path": sys.argv[1], "source_page_no": int(sys.argv[2])}],
            sys.argv[3],
        ))
