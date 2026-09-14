from pathlib import Path

import config
from db.ppt_db_client import PPTDatabaseClient
from functions.page_hash import PageHash
from functions.ppt_to_images import ppt_to_images
from functions.qwen_embedding import QwenEmbeddingClient
from prompt_message import ppt_page_describer


DEFAULT_TOPIC_ID = "default_topic"


def ingest_ppt(ppt_path: str) -> list[dict]:
    """Render and store all previously unseen pages from one PPT file."""
    path = Path(ppt_path).resolve()
    if not path.is_file() or path.suffix.lower() not in {".ppt", ".pptx"}:
        raise ValueError(f"无效的 PPT 文件: {path}")
    if not config.DOWNLOAD_DIR:
        raise ValueError("未配置 DOWNLOAD_DIR")

    db = PPTDatabaseClient(**config.DB_CONFIG)
    embedding_client = QwenEmbeddingClient()
    used_revision_group_ids: list[str] = []
    results = []

    try:
        db.create_table()
        image_paths = ppt_to_images(str(path), config.DOWNLOAD_DIR)

        for page_no, image_path in enumerate(image_paths, 1):
            page_hash = PageHash.file_hash(image_path)
            existing_page = db.find_by_hash(
                DEFAULT_TOPIC_ID,
                page_hash,
                path.name,
                used_revision_group_ids,
            )

            if existing_page:
                used_revision_group_ids.append(
                    str(existing_page["revision_group_id"])
                )
                results.append({
                    "source_page_no": page_no,
                    "status": "same_revision",
                    "page_id": str(existing_page["page_id"]),
                })
                continue

            match_text = ppt_page_describer(image_path)
            embedding = embedding_client.embed(match_text)
            page_id = db.insert_page(
                topic_id=DEFAULT_TOPIC_ID,
                source_file_name=path.name,
                source_page_no=page_no,
                page_hash=page_hash,
                match_text=match_text,
                embedding=embedding,
                screenshot_path=image_path,
            )
            results.append({
                "source_page_no": page_no,
                "status": "inserted",
                "page_id": page_id,
            })

        return results
    finally:
        db.close()

if __name__ == "__main__":
    result = ingest_ppt(r"C:\Users\shen.xin\Downloads\AI&财务\test\希迪智驾年中报告1.pptx")
    print(result)

