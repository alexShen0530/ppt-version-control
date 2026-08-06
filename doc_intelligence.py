import json
import os
from pathlib import Path

from alibabacloud_docmind_api20220711.client import Client
from alibabacloud_docmind_api20220711 import models
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_tea_util import models as util_models
from config import ALIBABA_CLOUD_ACCESS_KEY_ID, ALIBABA_CLOUD_ACCESS_KEY_SECRET
import config


def parse_document(file_path: str):
    path = Path(file_path)

    config = open_api_models.Config(
        access_key_id=ALIBABA_CLOUD_ACCESS_KEY_ID,
        access_key_secret=ALIBABA_CLOUD_ACCESS_KEY_SECRET,
        endpoint="docmind-api.cn-hangzhou.aliyuncs.com"
    )

    client = Client(config)

    with path.open("rb") as file:
        request = models.SubmitDigitalDocStructureJobAdvanceRequest(
            file_url_object=file,
            file_name=path.name,
            reveal_markdown=True
        )

        runtime = util_models.RuntimeOptions(
            connect_timeout=30000,
            read_timeout=300000
        )

        response = client.submit_digital_doc_structure_job_advance(
            request,
            runtime
        )

    result = response.body.to_map()
    # print(json.dumps(result, ensure_ascii=False, indent=2))

    # with open("document_result.json", "w", encoding="utf-8") as output:
    #     json.dump(result, output, ensure_ascii=False, indent=2)
    return result

def merge_markdown_by_page(result: dict) -> list[str]:
    pages = {}

    for layout in result["Data"]["layouts"]:
        markdown = layout.get("markdownContent", "").strip()
        page_nums = layout.get("pageNum", [])

        if not markdown:
            continue

        for page_num in page_nums:
            pages.setdefault(page_num, []).append(
                (layout.get("index", 0), markdown)
            )

    return [
        "\n".join(
            markdown
            for _, markdown in sorted(pages[page_num])
        )
        for page_num in sorted(pages)
    ]


def save_pages_to_json(page_text_list: list[str], output_path: str) -> None:
    pages = [
        {"page_num": page_num, "text": text}
        for page_num, text in enumerate(page_text_list, start=1)
    ]

    with Path(output_path).open("w", encoding="utf-8") as output_file:
        json.dump(pages, output_file, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    input_path = r"C:\Users\shen.xin\Downloads\AI&财务\AI落地应用场景规划V2.pptx"
    result = parse_document(input_path)
    # print(result)
    page_text_list = merge_markdown_by_page(result)
    print(page_text_list)
    # output_path = os.path.join(config.DOWNLOAD_DIR, f"{Path(input_path).stem}_pages.json")
    # save_pages_to_json(page_text_list, str(output_path))
    # print(f"页面内容已保存到: {output_path}")

