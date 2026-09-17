# ppt_db_client.py

import uuid
from typing import Optional, List, Dict, Any

import psycopg
from psycopg.rows import dict_row
from pgvector.psycopg import register_vector


class PPTDatabaseClient:
    def __init__(
        self,
        host: str,
        port: int,
        dbname: str,
        user: str,
        password: str,
    ):
        self.conn = psycopg.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            row_factory=dict_row,
        )

        register_vector(self.conn)

    def close(self):
        if self.conn:
            self.conn.close()

    def create_table(self):
        sql = """
        CREATE EXTENSION IF NOT EXISTS vector;

        CREATE TABLE IF NOT EXISTS topics (
            topic_id VARCHAR(255) PRIMARY KEY,
            name TEXT NOT NULL CHECK (btrim(name) <> ''),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pages (
            page_id UUID PRIMARY KEY,
            topic_id VARCHAR(255) NOT NULL,

            source_file_name TEXT NOT NULL,
            source_page_no INTEGER NOT NULL,

            page_hash VARCHAR(128) NOT NULL,
            match_text TEXT,

            embedding VECTOR(2560),

            screenshot_path TEXT,

            revision_group_id UUID NOT NULL,
            revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no > 0),

            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE pages ADD COLUMN IF NOT EXISTS title TEXT;
        ALTER TABLE pages ADD COLUMN IF NOT EXISTS change_note TEXT;
        ALTER TABLE pages ADD COLUMN IF NOT EXISTS source_ppt_path TEXT;

        CREATE TABLE IF NOT EXISTS upload_tasks (
            upload_id UUID PRIMARY KEY,
            file_name TEXT NOT NULL,
            topic_id VARCHAR(255) NOT NULL,
            source_ppt_path TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
            total_pages INTEGER NOT NULL DEFAULT 0,
            processed_pages INTEGER NOT NULL DEFAULT 0,
            new_page_ids UUID[] NOT NULL DEFAULT '{}',
            updated_group_ids UUID[] NOT NULL DEFAULT '{}',
            error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours'
        );

        ALTER TABLE export_tasks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
        UPDATE export_tasks
        SET expires_at = created_at + INTERVAL '24 hours'
        WHERE expires_at IS NULL;
        ALTER TABLE export_tasks
        ALTER COLUMN expires_at SET DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours';
        ALTER TABLE export_tasks ALTER COLUMN expires_at SET NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_export_tasks_expires_at
        ON export_tasks(expires_at);

        CREATE TABLE IF NOT EXISTS export_tasks (
            export_id UUID PRIMARY KEY,
            topic_id VARCHAR(255) NOT NULL,
            page_ids UUID[] NOT NULL,
            status TEXT NOT NULL DEFAULT 'processing'
                CHECK (status IN ('processing', 'completed', 'failed')),
            output_path TEXT,
            error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        DROP INDEX IF EXISTS idx_upload_tasks_topic_file;
        CREATE UNIQUE INDEX idx_upload_tasks_topic_file
        ON upload_tasks(topic_id, file_name) WHERE status <> 'failed';

        CREATE INDEX IF NOT EXISTS idx_pages_topic_id
        ON pages(topic_id);

        CREATE INDEX IF NOT EXISTS idx_pages_page_hash
        ON pages(page_hash);

        CREATE INDEX IF NOT EXISTS idx_pages_revision_group_id
        ON pages(revision_group_id);

        DROP INDEX IF EXISTS idx_pages_source_file_page;
        CREATE UNIQUE INDEX idx_pages_source_file_page
        ON pages(topic_id, source_file_name, source_page_no);

        DROP INDEX IF EXISTS idx_pages_source_file_revision_group;
        CREATE UNIQUE INDEX idx_pages_source_file_revision_group
        ON pages(topic_id, source_file_name, revision_group_id);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_revision_group_revision_no
        ON pages(revision_group_id, revision_no);
        """

        with self.conn.cursor() as cur:
            cur.execute(sql)

        self.conn.commit()

    def insert_page(
        self,
        topic_id: str,
        source_file_name: str,
        source_page_no: int,
        page_hash: str,
        match_text: str,
        embedding: List[float],
        screenshot_path: str,
        title: Optional[str] = None,
        change_note: Optional[str] = None,
        source_ppt_path: Optional[str] = None,
        revision_group_id: Optional[str] = None,
        revision_no: Optional[int] = None,
        page_id: Optional[str] = None,
    ) -> str:

        if page_id is None:
            page_id = str(uuid.uuid4())

        if revision_group_id is None:
            revision_group_id = page_id
            revision_no = 1

        atomic_revision = revision_no is None

        sql = """
        INSERT INTO pages (
            page_id,
            topic_id,
            source_file_name,
            source_page_no,
            page_hash,
            match_text,
            embedding,
            screenshot_path,
            title,
            change_note,
            source_ppt_path,
            revision_group_id,
            revision_no
        )
        VALUES (
            %(page_id)s,
            %(topic_id)s,
            %(source_file_name)s,
            %(source_page_no)s,
            %(page_hash)s,
            %(match_text)s,
            %(embedding)s,
            %(screenshot_path)s,
            %(title)s,
            %(change_note)s,
            %(source_ppt_path)s,
            %(revision_group_id)s,
            %(revision_no)s
        );
        """

        params = {
            "page_id": page_id,
            "topic_id": topic_id,
            "source_file_name": source_file_name,
            "source_page_no": source_page_no,
            "page_hash": page_hash,
            "match_text": match_text,
            "embedding": embedding,
            "screenshot_path": screenshot_path,
            "title": title,
            "change_note": change_note,
            "source_ppt_path": source_ppt_path,
            "revision_group_id": revision_group_id,
            "revision_no": revision_no,
        }

        try:
            with self.conn.cursor() as cur:
                if atomic_revision:
                    cur.execute(
                        "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0));",
                        (revision_group_id,),
                    )
                    cur.execute(
                        """
                        SELECT COALESCE(MAX(revision_no), 0) + 1 AS revision_no
                        FROM pages
                        WHERE revision_group_id = %s;
                        """,
                        (revision_group_id,),
                    )
                    params["revision_no"] = cur.fetchone()["revision_no"]
                cur.execute(sql, params)

            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

        return page_id

    def get_page_by_id(self, page_id: str) -> Optional[Dict[str, Any]]:
        sql = """
        SELECT *
        FROM pages
        WHERE page_id = %s;
        """

        with self.conn.cursor() as cur:
            cur.execute(sql, (page_id,))
            return cur.fetchone()

    def find_by_hash(
        self,
        topic_id: str,
        page_hash: str,
        source_file_name: str,
        excluded_revision_group_ids: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:

        excluded_revision_group_ids = excluded_revision_group_ids or []

        sql = """
        SELECT *
        FROM pages
        WHERE topic_id = %s
          AND page_hash = %s
          AND source_file_name <> %s
          AND revision_group_id <> ALL(%s::uuid[])
        ORDER BY created_at DESC
        LIMIT 1;
        """

        with self.conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    topic_id,
                    page_hash,
                    source_file_name,
                    excluded_revision_group_ids,
                ),
            )
            return cur.fetchone()

    def get_pages_by_topic(
        self,
        topic_id: str,
        source_file_name: str,
        excluded_revision_group_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:

        excluded_revision_group_ids = excluded_revision_group_ids or []

        sql = """
        SELECT *
        FROM pages
        WHERE topic_id = %s
          AND source_file_name <> %s
          AND revision_group_id <> ALL(%s::uuid[])
        ORDER BY created_at DESC;
        """

        with self.conn.cursor() as cur:
            cur.execute(
                sql,
                (topic_id, source_file_name, excluded_revision_group_ids),
            )
            return cur.fetchall()

    def search_similar_pages(
        self,
        topic_id: str,
        embedding: List[float],
        source_file_name: str,
        excluded_revision_group_ids: Optional[List[str]] = None,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:

        excluded_revision_group_ids = excluded_revision_group_ids or []

        sql = """
        WITH latest_pages AS (
            SELECT DISTINCT ON (revision_group_id)
                page_id,
                topic_id,
                source_file_name,
                source_page_no,
                page_hash,
                match_text,
                embedding,
                screenshot_path,
                revision_group_id,
                revision_no,
                created_at
            FROM pages
            WHERE topic_id = %s
              AND embedding IS NOT NULL
              AND source_file_name <> %s
              AND revision_group_id <> ALL(%s::uuid[])
            ORDER BY revision_group_id, revision_no DESC, created_at DESC
        )
        SELECT
            page_id,
            topic_id,
            source_file_name,
            source_page_no,
            page_hash,
            match_text,
            screenshot_path,
            revision_group_id,
            revision_no,
            created_at,
            1 - (embedding <=> %s::vector) AS similarity
        FROM latest_pages
        ORDER BY embedding <=> %s::vector
        LIMIT %s;
        """

        with self.conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    topic_id,
                    source_file_name,
                    excluded_revision_group_ids,
                    embedding,
                    embedding,
                    top_k,
                ),
            )

            return cur.fetchall()

    def update_page(
        self,
        page_id: str,
        **kwargs,
    ):
        allowed_fields = {
            "topic_id",
            "source_file_name",
            "source_page_no",
            "page_hash",
            "match_text",
            "embedding",
            "screenshot_path",
            "revision_group_id",
            "revision_no",
        }

        update_fields = {
            k: v
            for k, v in kwargs.items()
            if k in allowed_fields
        }

        if not update_fields:
            return

        set_clause = ", ".join(
            f"{key} = %({key})s"
            for key in update_fields
        )

        sql = f"""
        UPDATE pages
        SET {set_clause}
        WHERE page_id = %(page_id)s;
        """

        update_fields["page_id"] = page_id

        with self.conn.cursor() as cur:
            cur.execute(sql, update_fields)

        self.conn.commit()

    def delete_page(self, page_id: str):
        sql = """
        DELETE FROM pages
        WHERE page_id = %s;
        """

        with self.conn.cursor() as cur:
            cur.execute(sql, (page_id,))

        self.conn.commit()

    def get_revision_history(
        self,
        revision_group_id: str,
    ) -> List[Dict[str, Any]]:

        sql = """
        SELECT *
        FROM pages
        WHERE revision_group_id = %s
        ORDER BY revision_no ASC;
        """

        with self.conn.cursor() as cur:
            cur.execute(sql, (revision_group_id,))
            return cur.fetchall()

    def execute(self, sql: str, params=(), fetch: str | None = None):
        """Run one transactional statement for the API service layer."""
        try:
            with self.conn.cursor() as cur:
                cur.execute(sql, params)
                if fetch == "one":
                    result = cur.fetchone()
                elif fetch == "all":
                    result = cur.fetchall()
                else:
                    result = None
            self.conn.commit()
            return result
        except Exception:
            self.conn.rollback()
            raise
