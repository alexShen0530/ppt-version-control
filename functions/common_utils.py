import re
import json
import base64
import io
from PIL import Image
from pathlib import Path
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
import config


def clean_page_text_list(page_text_list: list[dict]) -> list[dict]:
    """
    删除每页文本中的 Markdown 图片：
    ![图片名.jpg](图片地址)
    """
    cleaned_list = []

    for item in page_text_list:
        text = item.get("text", "")

        # 删除 Markdown 图片格式，例如：
        # ![09e3-3.jpg](http://example.com/xxx.jpg)
        cleaned_text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)

        # 清理图片删除后多余的空行和首尾空格
        cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text).strip()

        cleaned_list.append({
            "page_num": item.get("page_num"),
            "text": cleaned_text,
        })

    return cleaned_list


def encode_image(image_path: str, high_resolution: bool = False) -> str:
    """图片转base64（默认压缩到1024x1024，high_resolution保留原图）"""
    with Image.open(image_path) as img:
        if not high_resolution:
            img = img.resize((1024, 1024), Image.LANCZOS)
        buffer = io.BytesIO()
        img.convert("RGB").save(buffer, format="JPEG")
        return base64.b64encode(buffer.getvalue()).decode("ascii")


def extract_ppt_images(ppt_path: str, download_dir: str = config.DOWNLOAD_DIR) -> list[dict]:
    """
    提取 PPT 每页中的图片。

    返回格式：
    [
        {1: ["/xxx/page_1_image_1.png"]},
        {2: ["/xxx/page_2_image_1.jpg", "/xxx/page_2_image_2.png"]}
    ]
    """
    file_name = Path(ppt_path).stem
    output_dir = Path(download_dir) / file_name
    output_dir.mkdir(parents=True, exist_ok=True)

    prs = Presentation(ppt_path)
    result = []

    for page_num, slide in enumerate(prs.slides, 1):
        image_paths = []

        for index, shape in enumerate(
            (s for s in slide.shapes if s.shape_type == MSO_SHAPE_TYPE.PICTURE),
            1
        ):
            image = shape.image
            image_path = output_dir / f"page_{page_num}_image_{index}.{image.ext}"
            image_path.write_bytes(image.blob)
            image_paths.append(str(image_path))

        if image_paths:
            result.append({
                "page_num": page_num,
                "image_paths": image_paths
            })

    return result


def enrich_pages_with_ocr(ppt_path: str, page_text_list: list[dict]) -> list[dict]:
    """
    批量OCR PPT本地提取的图片与视频三帧，结果追加到对应页文本末尾
    （同时清除DocMind产出中的图片占位符）
    """
    # 延迟导入，避免循环依赖（prompt_message -> call_qwen -> common_utils）
    from prompt_message import ppt_image_describer, ppt_video_describer
    from functions.concurrent_util import execute_parallel_with_fallback
    from functions.video_extractor import process_ppt_videos

    def parse_result(raw: str, summary_label: str) -> str:
        try:
            data = json.loads(raw)
            return f"原文本：{data.get('raw_text', '')}\n{summary_label}：{data.get('summary', '')}"
        except (json.JSONDecodeError, TypeError):
            return raw

    def ocr_image(image_path: str) -> str:
        return parse_result(ppt_image_describer(image_path), "图片理解")

    def ocr_video(frame_paths: list[str]) -> str:
        return parse_result(ppt_video_describer(frame_paths), "视频理解")

    # 1. 图片批量并发OCR
    tasks, task_pages = [], []
    for page in extract_ppt_images(ppt_path):
        for image_path in page["image_paths"]:
            tasks.append((ocr_image, (image_path,), {},
                          Path(image_path).name, "该图片暂时无法读取"))
            task_pages.append(page["page_num"])
    results = execute_parallel_with_fallback(tasks, max_workers=3, timeout_seconds=180)

    ocr_by_page = {}
    for page_num, text in zip(task_pages, results):
        images = ocr_by_page.setdefault(page_num, [])
        images.append(f"【图片{len(images) + 1}】\n{text}")

    # 2. 视频三帧批量并发OCR（页码未知的视频跳过）
    video_dir = Path(config.DOWNLOAD_DIR) / Path(ppt_path).stem
    tasks, task_pages = [], []
    for item in process_ppt_videos(ppt_path, output_dir=str(video_dir)):
        page_num = item["slide"]
        if not page_num:
            print(f"⚠️  视频无法定位页码，跳过: {Path(item['video']).name}")
            continue
        frame_paths = [p for p in item["frames"].values() if p]
        if not frame_paths:
            continue
        tasks.append((ocr_video, (frame_paths,), {},
                      Path(item["video"]).name, "该视频暂时无法读取"))
        task_pages.append(page_num)
    results = execute_parallel_with_fallback(tasks, max_workers=3, timeout_seconds=300)

    video_by_page = {}
    for page_num, text in zip(task_pages, results):
        videos = video_by_page.setdefault(page_num, [])
        videos.append(f"【视频{len(videos) + 1}】\n{text}")

    # 3. 清除图片占位符，把图片/视频OCR结果追加到对应页末尾
    enriched = clean_page_text_list(page_text_list)
    for item in enriched:
        page_num = item["page_num"]
        if ocr_by_page.get(page_num):
            item["text"] += "\n\n【图片内容】\n" + "\n\n".join(ocr_by_page[page_num])
        if video_by_page.get(page_num):
            item["text"] += "\n\n【视频内容】\n" + "\n\n".join(video_by_page[page_num])

    return enriched

if __name__ == "__main__":
    print(extract_ppt_images(r"C:\Users\shen.xin\Downloads\AI&财务\AI智算中心&财务P1工作.pptx"))
