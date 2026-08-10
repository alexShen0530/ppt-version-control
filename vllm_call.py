import re

from openai import OpenAI
import json

import system_prompt
from functions.doc_intelligence import parse_document, merge_markdown_by_page
from functions.common_utils import clean_page_text_list

VLLM_URL = "http://172.16.41.37:7080/v1"

client = OpenAI(
    base_url=VLLM_URL,
    api_key="EMPTY",
)


def chat_with_vllm(
    user_message: str,
    system_message: str,
    model: str = "qwen2.5-14b",
) -> str:
    """
    调用本地 vLLM 模型。

    :param user_message: 用户消息
    :param system_message: 系统提示词
    :param model: vLLM 中注册的模型名称
    :return: 模型回复文本
    """
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": system_message,
                },
                {
                    "role": "user",
                    "content": user_message,
                },
            ],
            temperature=0.7,
            max_tokens=2000,
        )

        return response.choices[0].message.content or ""

    except Exception as exc:
        raise RuntimeError(f"调用 vLLM 模型失败：{exc}") from exc

if __name__ == "__main__":
    input_path1 = r"C:\Users\shen.xin\Downloads\AI&财务\AI落地应用场景规划V1.pptx"
    result1 = parse_document(input_path1)
    page_text_list1 = clean_page_text_list(merge_markdown_by_page(result1))
    print(page_text_list1)

    input_path2 = r"C:\Users\shen.xin\Downloads\AI&财务\AI落地应用场景规划V2.pptx"
    result2 = parse_document(input_path2)
    page_text_list2 = clean_page_text_list(merge_markdown_by_page(result2))
    print(page_text_list2)

    input_text = f"""
            旧版：
            {json.dumps(page_text_list1, ensure_ascii=False, indent=2)}

            新版：
            {json.dumps(page_text_list2, ensure_ascii=False, indent=2)}
            """



    result = chat_with_vllm(
        user_message=input_text,
        system_message=system_prompt.ppt_version_diff,
    )

    print(result)