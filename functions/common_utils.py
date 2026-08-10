import re
import base64
import io
from PIL import Image


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