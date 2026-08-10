import requests, json
import system_prompt
from functions.doc_intelligence import parse_document, merge_markdown_by_page
from functions.common_utils import clean_page_text_list

OLLAMA_URL = "http://172.16.41.37:11434"


def call_ollama(
    user_message: str,
    system_message: str,
    model: str = "qwen3:14b",
) -> str:
    response = requests.post(
        f"{OLLAMA_URL}/api/chat",
        json={
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": system_message
                },
                {
                    "role": "user",
                    "content": user_message
                }
            ],
            "think": False,
            "stream": False
        },
        timeout=300
    )

    response.raise_for_status()
    return response.json()["message"]["content"]


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

    result = call_ollama(
        user_message='你好 你是谁',
        system_message='',
        model='qwq:32b'
    )

    print(result)