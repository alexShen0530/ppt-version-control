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

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_pages_topic_id
        ON pages(topic_id);

        CREATE INDEX IF NOT EXISTS idx_pages_page_hash
        ON pages(page_hash);

        CREATE INDEX IF NOT EXISTS idx_pages_revision_group_id
        ON pages(revision_group_id);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_source_file_page
        ON pages(source_file_name, source_page_no);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_source_file_revision_group
        ON pages(source_file_name, revision_group_id);
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
        revision_group_id: Optional[str] = None,
        revision_no: int = 1,
        page_id: Optional[str] = None,
    ) -> str:

        if page_id is None:
            page_id = str(uuid.uuid4())

        if revision_group_id is None:
            revision_group_id = page_id

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
            "revision_group_id": revision_group_id,
            "revision_no": revision_no,
        }

        with self.conn.cursor() as cur:
            cur.execute(sql, params)

        self.conn.commit()

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
        FROM pages
        WHERE topic_id = %s
          AND embedding IS NOT NULL
          AND source_file_name <> %s
          AND revision_group_id <> ALL(%s::uuid[])
        ORDER BY embedding <=> %s::vector
        LIMIT %s;
        """

        with self.conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    embedding,
                    topic_id,
                    source_file_name,
                    excluded_revision_group_ids,
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
