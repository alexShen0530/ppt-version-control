import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock

from backend import config
from backend.db.ppt_db_client import PPTDatabaseClient
from backend.functions.page_hash import PageHash
from backend.functions.ppt_to_images import ppt_to_images
from backend.functions.qwen_embedding import QwenEmbeddingClient
from backend.functions.prompt_message import ppt_page_describer, ppt_page_diff_analyzer


TOPIC_ID = "2a8ea8ab-3207-43e8-a7a6-1460b6fb61a3"
SIMILARITY_THRESHOLD = 0.75


def _title(match_text: str) -> str:
    marker = "【标题】"
    if marker not in match_text:
        return "未命名页面"
    value = match_text.split(marker, 1)[1].split("【", 1)[0].strip()
    return value.splitlines()[0].strip() if value else "未命名页面"


def process_ppt(
    ppt_path: str,
    topic_id: str = TOPIC_ID,
    progress_callback=None,
    pages_dir: str | None = None,
) -> list[dict]:
    path = Path(ppt_path).resolve()
    if not path.is_file() or path.suffix.lower() not in {".ppt", ".pptx"}:
        raise ValueError(f"无效的 PPT 文件: {path}")

    db = PPTDatabaseClient(**config.DB_CONFIG)
    try:
        db.create_table()
        image_paths = ppt_to_images(
            str(path),
            pages_dir or str(path.parent / "pages"),
            flat_output=pages_dir is not None,
        )
        if progress_callback:
            progress_callback({"total_pages": len(image_paths)})
    finally:
        db.close()

    used_revision_group_ids: set[str] = set()
    group_lock = Lock()

    def complete(result: dict) -> dict:
        if progress_callback:
            progress_callback(result)
        return result

    def process_page(item: tuple[int, str]) -> dict:
        page_no, image_path = item
        page_hash = PageHash.file_hash(image_path)
        page_db = PPTDatabaseClient(**config.DB_CONFIG)

        def excluded_groups() -> list[str]:
            with group_lock:
                return list(used_revision_group_ids)

        def claim_group(group_id: str) -> bool:
            with group_lock:
                if group_id in used_revision_group_ids:
                    return False
                used_revision_group_ids.add(group_id)
                return True

        try:
            while True:
                existing = page_db.find_by_hash(
                    topic_id, page_hash, path.name, excluded_groups()
                )
                if not existing:
                    break
                group_id = str(existing["revision_group_id"])
                if claim_group(group_id):
                    return complete({
                        "source_page_no": page_no,
                        "classification": "same_revision",
                        "message": "页面hash一致,页面已存在",
                        "matched_page_id": str(existing["page_id"]),
                    })

            match_text = ppt_page_describer(image_path)
            # print(match_text)
            embedding = QwenEmbeddingClient().embed(match_text)

            def insert_new_page(
                similarity: float | None = None,
                reason: str = "",
            ) -> dict:
                page_id = page_db.insert_page(
                    topic_id, path.name, page_no, page_hash,
                    match_text, embedding, image_path,
                    title=_title(match_text),
                    source_ppt_path=str(path),
                )
                result = {
                    "source_page_no": page_no,
                    "classification": "new_page",
                    "message": "新页面添加",
                    "page_id": page_id,
                }
                if similarity is not None:
                    result.update(similarity=similarity, reason=reason)
                return complete(result)

            while True:
                candidates = page_db.search_similar_pages(
                    topic_id,
                    embedding,
                    path.name,
                    excluded_groups(),
                    top_k=1,
                )
                if not candidates or float(candidates[0]["similarity"]) < SIMILARITY_THRESHOLD:
                    return insert_new_page()

                candidate = candidates[0]
                analysis = json.loads(
                    ppt_page_diff_analyzer(candidate["match_text"], match_text)
                )
                result = analysis.get("result")

                if result == "different_page":
                    return insert_new_page(
                        float(candidate["similarity"]),
                        analysis.get("reason", ""),
                    )

                if result not in {
                    "same_page_same_revision",
                    "same_page_different_revision",
                }:
                    raise ValueError(f"无法识别的页面判断结果: {analysis}")

                group_id = str(candidate["revision_group_id"])
                if not claim_group(group_id):
                    continue

                if result == "same_page_same_revision":
                    return complete({
                        "source_page_no": page_no,
                        "classification": "same_revision",
                        "message": "页面已存在",
                        "matched_page_id": str(candidate["page_id"]),
                        "similarity": float(candidate["similarity"]),
                        "reason": analysis.get("reason", ""),
                    })

                page_id = page_db.insert_page(
                    topic_id,
                    path.name,
                    page_no,
                    page_hash,
                    match_text,
                    embedding,
                    image_path,
                    title=_title(match_text),
                    change_note=analysis.get("reason", ""),
                    source_ppt_path=str(path),
                    revision_group_id=group_id,
                )
                return complete({
                    "source_page_no": page_no,
                    "classification": "new_revision",
                    "message": "存在页面新版本添加",
                    "page_id": page_id,
                    "matched_page_id": str(candidate["page_id"]),
                    "revision_group_id": group_id,
                    "similarity": float(candidate["similarity"]),
                    "reason": analysis.get("reason", ""),
                })
        finally:
            page_db.close()

    with ThreadPoolExecutor(max_workers=3) as executor:
        return list(executor.map(process_page, enumerate(image_paths, 1)))

if __name__ == "__main__":
    result = process_ppt(r"C:\Users\shen.xin\Downloads\AI&财务\AI落地应用场景规划V3.pptx")
    print(result)
