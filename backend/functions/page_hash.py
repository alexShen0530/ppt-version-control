# page_hash.py

import hashlib
from pathlib import Path
from typing import Union


class PageHash:
    @staticmethod
    def file_hash(
        file_path: Union[str, Path],
        algorithm: str = "sha256",
        chunk_size: int = 1024 * 1024,
    ) -> str:
        """
        计算文件 Hash。
        默认使用 SHA-256。

        Args:
            file_path: 文件路径
            algorithm: sha256 / md5 / sha1 等
            chunk_size: 分块读取大小，默认 1MB

        Returns:
            hash hex string
        """

        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        if not file_path.is_file():
            raise ValueError(f"不是文件: {file_path}")

        try:
            hasher = hashlib.new(algorithm)
        except ValueError:
            raise ValueError(f"不支持的 Hash 算法: {algorithm}")

        with file_path.open("rb") as f:
            while chunk := f.read(chunk_size):
                hasher.update(chunk)

        return hasher.hexdigest()

    @staticmethod
    def text_hash(
        text: str,
        algorithm: str = "sha256",
    ) -> str:
        """
        对文本计算 Hash。
        可用于 match_text 或其他结构化文本。
        """

        if text is None:
            text = ""

        try:
            hasher = hashlib.new(algorithm)
        except ValueError:
            raise ValueError(f"不支持的 Hash 算法: {algorithm}")

        hasher.update(text.encode("utf-8"))

        return hasher.hexdigest()

    @staticmethod
    def bytes_hash(
        data: bytes,
        algorithm: str = "sha256",
    ) -> str:
        """
        对 bytes 数据计算 Hash。
        """

        try:
            hasher = hashlib.new(algorithm)
        except ValueError:
            raise ValueError(f"不支持的 Hash 算法: {algorithm}")

        hasher.update(data)

        return hasher.hexdigest()

if __name__ == "__main__":
    page_hash = PageHash.file_hash(
        r"C:\Users\shen.xin\Downloads\test1.png"
    )

    print(page_hash)

