from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

from backend import config
from backend.db.ppt_db_client import PPTDatabaseClient
from backend.functions.ppt_exporter import export_ppt_pages


_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ppt-export")


class ExportExpiredError(Exception):
    pass


def _db() -> PPTDatabaseClient:
    return PPTDatabaseClient(**config.DB_CONFIG)


def _load_pages(page_ids: list[str]) -> list[dict]:
    if not page_ids:
        raise ValueError("至少选择一张页面")
    db = _db()
    try:
        rows = db.execute("""
            SELECT page_id, source_ppt_path, source_page_no
            FROM pages
            WHERE page_id = ANY(%s::uuid[]);
        """, (page_ids,), "all")
    finally:
        db.close()

    by_id = {str(row["page_id"]): row for row in rows}
    missing = [page_id for page_id in page_ids if page_id not in by_id]
    if missing:
        raise ValueError("部分所选页面不存在")

    pages = [by_id[page_id] for page_id in page_ids]
    if any(not page.get("source_ppt_path") for page in pages):
        raise ValueError("部分页面缺少原始 PPT 文件，无法导出可编辑页面")
    if any(not Path(page["source_ppt_path"]).is_file() for page in pages):
        raise ValueError("部分页面的原始 PPT 文件已丢失")
    return pages


def cleanup_expired_exports() -> None:
    db = _db()
    try:
        rows = db.execute("""
            DELETE FROM export_tasks
            WHERE expires_at <= CURRENT_TIMESTAMP
            RETURNING output_path;
        """, fetch="all")
    finally:
        db.close()
    for row in rows:
        path = Path(row["output_path"]) if row.get("output_path") else None
        if path and path.is_file():
            path.unlink()


def create_export(page_ids: list[str], topic_id: str) -> str:
    cleanup_expired_exports()
    pages = _load_pages(page_ids)
    export_id = str(uuid4())
    output_path = Path(config.PPT_STORAGE_DIR) / "exports" / f"{export_id}.pptx"
    db = _db()
    try:
        db.execute("""
            INSERT INTO export_tasks(export_id, topic_id, page_ids, output_path)
            VALUES (%s, %s, %s::uuid[], %s);
        """, (export_id, topic_id, page_ids, str(output_path)))
    finally:
        db.close()
    _executor.submit(_run_export, export_id, pages, str(output_path))
    return export_id


def _run_export(export_id: str, pages: list[dict], output_path: str) -> None:
    db = _db()
    try:
        export_ppt_pages(pages, output_path)
        db.execute("""
            UPDATE export_tasks
            SET status = 'completed', updated_at = CURRENT_TIMESTAMP
            WHERE export_id = %s;
        """, (export_id,))
    except Exception as exc:
        db.execute("""
            UPDATE export_tasks
            SET status = 'failed', error = %s, updated_at = CURRENT_TIMESTAMP
            WHERE export_id = %s;
        """, (str(exc), export_id))
    finally:
        db.close()


def get_export(export_id: str) -> dict | None:
    db = _db()
    try:
        row = db.execute(
            "SELECT * FROM export_tasks WHERE export_id = %s;",
            (export_id,), "one",
        )
    finally:
        db.close()
    if not row:
        return None
    return {
        "export_id": str(row["export_id"]),
        "status": row["status"],
        "page_count": len(row["page_ids"]),
        "download_url": f"/files/exports/{row['export_id']}"
            if row["status"] == "completed" else None,
        "error": row["error"],
        "created_at": row["created_at"].isoformat(),
        "expires_at": row["expires_at"].isoformat(),
    }


def list_exports() -> list[dict]:
    cleanup_expired_exports()
    db = _db()
    try:
        rows = db.execute("""
            SELECT * FROM export_tasks
            ORDER BY created_at DESC;
        """, fetch="all")
    finally:
        db.close()
    return [{
        "export_id": str(row["export_id"]),
        "status": row["status"],
        "page_count": len(row["page_ids"]),
        "download_url": f"/files/exports/{row['export_id']}"
            if row["status"] == "completed" else None,
        "error": row["error"],
        "created_at": row["created_at"].isoformat(),
        "expires_at": row["expires_at"].isoformat(),
    } for row in rows]


def get_export_path(export_id: str) -> Path | None:
    db = _db()
    try:
        row = db.execute("""
            SELECT output_path, status, expires_at <= CURRENT_TIMESTAMP AS expired
            FROM export_tasks WHERE export_id = %s;
        """, (export_id,), "one")
    finally:
        db.close()
    if row and row["expired"]:
        cleanup_expired_exports()
        raise ExportExpiredError
    if not row or row["status"] != "completed":
        return None
    path = Path(row["output_path"]) if row["output_path"] else None
    return path if path and path.is_file() else None


if __name__ == "__main__":
    import sys
    print(get_export(sys.argv[1]) if len(sys.argv) > 1 else "usage: export_service.py EXPORT_ID")
