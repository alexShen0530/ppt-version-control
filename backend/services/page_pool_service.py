from pathlib import Path
from uuid import uuid4

from backend import config
from backend.db.ppt_db_client import PPTDatabaseClient


def _db() -> PPTDatabaseClient:
    return PPTDatabaseClient(**config.DB_CONFIG)


def _value(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value) if value is not None else None


def _version(row: dict) -> dict:
    return {
        "page_id": str(row["page_id"]),
        "revision_no": row["revision_no"],
        "image_url": f"/files/pages/{row['page_id']}",
        "source_file_name": row["source_file_name"],
        "source_page_no": row["source_page_no"],
        "created_at": _value(row["created_at"]),
        "change_note": row.get("change_note"),
    }


def list_topics() -> list[dict]:
    db = _db()
    try:
        return db.execute("""
            SELECT t.topic_id, t.name,
                   COUNT(DISTINCT p.revision_group_id)::int AS page_count
            FROM topics t
            LEFT JOIN pages p ON p.topic_id = t.topic_id::text
            GROUP BY t.topic_id, t.name, t.created_at
            ORDER BY t.created_at;
        """, fetch="all")
    finally:
        db.close()


def create_topic(name: str) -> dict:
    db = _db()
    try:
        topic_id = str(uuid4())
        row = db.execute(
            "INSERT INTO topics(topic_id, name) VALUES (%s, %s) RETURNING topic_id, name;",
            (topic_id, name.strip()), "one",
        )
        return {**row, "page_count": 0}
    finally:
        db.close()


def topic_exists(topic_id: str) -> bool:
    db = _db()
    try:
        return db.execute(
            "SELECT 1 FROM topics WHERE topic_id = %s;", (topic_id,), "one"
        ) is not None
    finally:
        db.close()


def rename_topic(topic_id: str, name: str) -> dict | None:
    db = _db()
    try:
        row = db.execute("""
            UPDATE topics SET name = %s WHERE topic_id = %s
            RETURNING topic_id, name;
        """, (name.strip(), topic_id), "one")
        if row:
            row["page_count"] = db.execute(
                "SELECT COUNT(DISTINCT revision_group_id)::int AS n FROM pages WHERE topic_id = %s;",
                (topic_id,), "one",
            )["n"]
        return row
    finally:
        db.close()


def delete_topic(topic_id: str) -> bool:
    db = _db()
    try:
        with db.conn.transaction():
            with db.conn.cursor() as cur:
                cur.execute("DELETE FROM pages WHERE topic_id = %s;", (topic_id,))
                cur.execute("DELETE FROM topics WHERE topic_id = %s RETURNING topic_id;", (topic_id,))
                return cur.fetchone() is not None
    finally:
        db.close()


def list_master_pages(topic_id: str) -> dict:
    db = _db()
    try:
        rows = db.execute("""
            SELECT DISTINCT ON (revision_group_id)
                page_id, revision_group_id, revision_no,
                COUNT(*) OVER (PARTITION BY revision_group_id)::int AS revision_count,
                COALESCE(NULLIF(title, ''), '未命名页面') AS title,
                source_file_name, source_page_no, created_at
            FROM pages WHERE topic_id = %s
            ORDER BY revision_group_id, revision_no DESC;
        """, (topic_id,), "all")
        pages = [{
            "page_id": str(r["page_id"]),
            "revision_group_id": str(r["revision_group_id"]),
            "revision_no": r["revision_no"],
            "revision_count": r["revision_count"],
            "title": r["title"],
            "image_url": f"/files/pages/{r['page_id']}",
            "source_file_name": r["source_file_name"],
            "source_page_no": r["source_page_no"],
            "created_at": _value(r["created_at"]),
        } for r in rows]
        pages.sort(key=lambda p: p["created_at"], reverse=True)
        return {"total": len(pages), "pages": pages}
    finally:
        db.close()


def get_revision_group(group_id: str) -> dict | None:
    db = _db()
    try:
        rows = db.execute("""
            SELECT * FROM pages WHERE revision_group_id = %s ORDER BY revision_no;
        """, (group_id,), "all")
        if not rows:
            return None
        return {
            "revision_group_id": group_id,
            "title": rows[-1].get("title") or "未命名页面",
            "versions": [_version(row) for row in rows],
        }
    finally:
        db.close()


def get_page_path(page_id: str) -> Path | None:
    db = _db()
    try:
        row = db.execute(
            "SELECT screenshot_path FROM pages WHERE page_id = %s;", (page_id,), "one"
        )
        path = Path(row["screenshot_path"]) if row else None
        return path if path and path.is_file() else None
    finally:
        db.close()


def delete_revision(group_id: str, page_id: str) -> dict | None:
    db = _db()
    try:
        with db.conn.transaction():
            with db.conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0));", (group_id,))
                cur.execute("""
                    DELETE FROM pages
                    WHERE revision_group_id = %s AND page_id = %s
                    RETURNING topic_id;
                """, (group_id, page_id))
                deleted = cur.fetchone()
                if not deleted:
                    return None
                cur.execute("""
                    WITH ordered AS (
                        SELECT page_id, ROW_NUMBER() OVER (ORDER BY revision_no)::int AS new_no
                        FROM pages WHERE revision_group_id = %s
                    )
                    UPDATE pages p SET revision_no = ordered.new_no + 1000000
                    FROM ordered WHERE p.page_id = ordered.page_id;
                """, (group_id,))
                cur.execute("""
                    UPDATE pages SET revision_no = revision_no - 1000000
                    WHERE revision_group_id = %s;
                """, (group_id,))
                topic_id = deleted["topic_id"]
        return {"detail": get_revision_group(group_id), "topic_id": topic_id}
    finally:
        db.close()


def delete_revision_group(group_id: str) -> dict | None:
    """删除整个 revision_group（该页全部版本），并 best-effort 清理截图文件。"""
    db = _db()
    try:
        with db.conn.transaction():
            with db.conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0));", (group_id,))
                cur.execute("""
                    DELETE FROM pages WHERE revision_group_id = %s
                    RETURNING topic_id, screenshot_path;
                """, (group_id,))
                rows = cur.fetchall()
    finally:
        db.close()
    if not rows:
        return None
    for row in rows:
        path = Path(row["screenshot_path"]) if row.get("screenshot_path") else None
        if path and path.is_file():
            try:
                path.unlink()
            except OSError:
                pass
    return {"topic_id": str(rows[0]["topic_id"])}


if __name__ == "__main__":
    print(list_topics())
