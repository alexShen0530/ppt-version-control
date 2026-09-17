from pathlib import Path
import os
import re
import zipfile

import pythoncom
import win32com.client

from backend.functions.powerpoint_com import POWERPOINT_COM_LOCK


LATIN_FONT = "Liberation Sans"
EAST_ASIA_FONT = "方正兰亭黑简体"


def _write_package_fonts(pptx_path: Path) -> None:
    temp_path = pptx_path.with_suffix(".font-update.pptx")
    latin = LATIN_FONT.encode("utf-8")
    east_asia = EAST_ASIA_FONT.encode("utf-8")
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
