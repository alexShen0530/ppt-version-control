from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from uuid import uuid4

from backend import config
from backend.db.ppt_db_client import PPTDatabaseClient
from backend.ppt_page_versioning.process_ppt import process_ppt
from backend.services.page_pool_service import list_master_pages


_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ppt-upload")


def _db() -> PPTDatabaseClient:
    return PPTDatabaseClient(**config.DB_CONFIG)


def create_upload(
    file_name: str,
    topic_id: str,
    source_path: str,
    upload_id: str | None = None,
) -> str:
    upload_id = upload_id or str(uuid4())
    db = _db()
    try:
        db.execute("""
            INSERT INTO upload_tasks(upload_id, file_name, topic_id, source_ppt_path)
            VALUES (%s, %s, %s, %s);
        """, (upload_id, file_name, topic_id, source_path))
    finally:
        db.close()
    _executor.submit(_run_upload, upload_id, source_path, topic_id)
    return upload_id


def _run_upload(upload_id: str, source_path: str, topic_id: str) -> None:
    db = _db()
    progress_lock = Lock()
    try:
        db.execute("""
            UPDATE upload_tasks SET status = 'processing', updated_at = CURRENT_TIMESTAMP
            WHERE upload_id = %s;
        """, (upload_id,))

        def progress(event: dict) -> None:
            with progress_lock:
                if "total_pages" in event:
                    db.execute("""
                        UPDATE upload_tasks SET total_pages = %s, updated_at = CURRENT_TIMESTAMP
                        WHERE upload_id = %s;
                    """, (event["total_pages"], upload_id))
                    return
                new_page_id = event.get("page_id") if event.get("classification") == "new_page" else None
                group_id = event.get("revision_group_id") if event.get("classification") == "new_revision" else None
                db.execute("""
                    UPDATE upload_tasks SET
                        processed_pages = processed_pages + 1,
                        new_page_ids = CASE WHEN %s::uuid IS NULL THEN new_page_ids
                            ELSE array_append(new_page_ids, %s::uuid) END,
                        updated_group_ids = CASE WHEN %s::uuid IS NULL THEN updated_group_ids
                            ELSE array_append(updated_group_ids, %s::uuid) END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE upload_id = %s;
                """, (new_page_id, new_page_id, group_id, group_id, upload_id))

        pages_dir = str(Path(source_path).parent / "pages")
        process_ppt(source_path, topic_id, progress, pages_dir)
        db.execute("""
            UPDATE upload_tasks SET status = 'completed', updated_at = CURRENT_TIMESTAMP
            WHERE upload_id = %s;
        """, (upload_id,))
    except Exception as exc:
        db.execute("""
            UPDATE upload_tasks SET status = 'failed', error = %s, updated_at = CURRENT_TIMESTAMP
            WHERE upload_id = %s;
        """, (str(exc), upload_id))
    finally:
        db.close()


def get_upload(upload_id: str) -> dict | None:
    db = _db()
    try:
        row = db.execute("SELECT * FROM upload_tasks WHERE upload_id = %s;", (upload_id,), "one")
    finally:
        db.close()
    if not row:
        return None

    new_pages = []
    if row["status"] == "completed" and row["new_page_ids"]:
        wanted = {str(value) for value in row["new_page_ids"]}
        new_pages = [
            page for page in list_master_pages(row["topic_id"])["pages"]
            if page["page_id"] in wanted
        ]
    return {
        "upload_id": str(row["upload_id"]),
        "file_name": row["file_name"],
        "topic_id": row["topic_id"],
        "status": row["status"],
        "total_pages": row["total_pages"],
        "processed_pages": row["processed_pages"],
        "new_pages": new_pages,
        "updated_groups": [str(value) for value in row["updated_group_ids"]]
            if row["status"] == "completed" else [],
        "error": row["error"],
    }


def upload_path(upload_id: str, file_name: str) -> Path:
    stem = "".join(
        char if char not in '<>:"/\\|?*' else "_"
        for char in Path(file_name).stem
    ).strip(" .") or "ppt"
    directory = Path(config.PPT_STORAGE_DIR) / f"{stem}_{upload_id}"
    directory.mkdir(parents=True, exist_ok=True)
    return directory / Path(file_name).name


if __name__ == "__main__":
    import sys
    print(get_upload(sys.argv[1]) if len(sys.argv) > 1 else "usage: upload_service.py UPLOAD_ID")
