import json
import os
import re
import sqlite3
from datetime import datetime

import config


class DocumentStore:
    """本地SQLite数据库存储（一个PPT对应一条记录，整份内容存为JSON）"""

    def __init__(self, db_path: str):
        # 确保数据库所在目录存在
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self._init_tables()

    def _init_tables(self):
        """初始化表结构"""
        cursor = self.conn.cursor()

        # 文档表：一个PPT对应一条记录，page_text_list整体存为JSON字符串
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name   TEXT NOT NULL,
                file_path   TEXT,
                message_id  TEXT,
                chat_id     TEXT,
                content     TEXT NOT NULL,
                created_at  TEXT NOT NULL
            )
        """)

        self.conn.commit()

    def save_document(self, file_name: str, page_text_list: list[dict],
                      file_path: str = None, message_id: str = None,
                      chat_id: str = None) -> int:
        """
        保存一个文档（merge_markdown_by_page 的产物整体存为一条JSON记录）
        :param file_name: PPT文件名
        :param page_text_list: merge_markdown_by_page 的返回值 [page_num:, text:]
        :param file_path: 本地文件路径（可选）
        :param message_id: 飞书消息ID（可选）
        :param chat_id: 飞书群ID（可选）
        :return: 新插入文档的ID
        """
        cursor = self.conn.cursor()

        cursor.execute(
            "INSERT INTO documents "
            "(file_name, file_path, message_id, chat_id, content, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (file_name, file_path, message_id, chat_id,
             json.dumps(page_text_list, ensure_ascii=False),
             datetime.now().isoformat())
        )
        doc_id = cursor.lastrowid

        self.conn.commit()
        print(f"💾 已保存到数据库 | 文档ID: {doc_id} | 页数: {len(page_text_list)}")
        return doc_id

    def get_document(self, doc_id: int):
        """查询单个文档（content字段还原为列表）"""
        cursor = self.conn.cursor()

        cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        doc = cursor.fetchone()
        if not doc:
            return None

        return {
            "id": doc[0],
            "file_name": doc[1],
            "file_path": doc[2],
            "message_id": doc[3],
            "chat_id": doc[4],
            "page_text_list": json.loads(doc[5]),
            "created_at": doc[6]
        }

    def is_message_processed(self, message_id: str) -> bool:
        """判断消息是否已成功处理过（查documents表，成功入库才算已处理）"""
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT 1 FROM documents WHERE message_id = ? LIMIT 1",
            (message_id,)
        )
        return cursor.fetchone() is not None

    def find_latest_history(self, base_name: str, exclude_id: int = None):
        """按文件基础名查找最新历史版本（file_name格式: 基础名+V版本号）"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, file_name FROM documents ORDER BY id DESC")
        pattern = re.compile(rf"^{re.escape(base_name)}[Vv]\d+\.[Pp][Pp][Tt][Xx]?$")
        for doc_id, name in cursor.fetchall():
            if doc_id != exclude_id and pattern.match(name):
                return self.get_document(doc_id)
        return None

    def list_documents(self):
        """列出所有文档（不含内容）"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, file_name, created_at FROM documents ORDER BY id")
        return cursor.fetchall()

    def close(self):
        """关闭数据库连接"""
        self.conn.close()


# 全局单例
document_store = DocumentStore(config.DB_PATH)
