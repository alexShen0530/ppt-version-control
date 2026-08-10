import base64
import io

from openai import OpenAI
from PIL import Image
import config
from functions.common_utils import encode_image


def _get_client():
    return OpenAI(
        api_key=config.BAILIAN_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
    )


def call_qwen_vision(
         user_message: str,
         system_message: str,
         image_paths: list[str] | None = None,
         model: str = "qwen3-vl-32b-thinking",
         high_resolution: bool = True
    ) -> str:
    """
    调用阿里云百炼Qwen多模态模型（支持传入多张图片）
    :param image_paths: 本地图片路径列表
    :param user_message: 用户输入
    :param system_message: 系统提示词
    :param model: 模型名称
    :param high_resolution: 是否保留图片原始分辨率
    :return: 模型生成的文本
    """
    client = _get_client()

    content = [{"type": "text", "text": user_message}]
    for image_path in image_paths:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{encode_image(image_path, high_resolution)}"}
        })

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": content}
        ]
    )

    return response.choices[0].message.content


if __name__ == "__main__":
    # 简单测试：图片理解
    result = call_qwen_vision(
        image_paths=[r"C:\Users\shen.xin\Downloads\9975-2.jpeg"],
        user_message="帮我把图片中的文本 结构化的提取出来",
        system_message="你是一个图片OCR解析助手"
    )
    print(result)
