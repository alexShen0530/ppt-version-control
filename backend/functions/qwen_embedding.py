import requests
from typing import List, Union


class QwenEmbeddingClient:
    def __init__(
        self,
        base_url: str = "http://172.16.200.96:7091",
        model: str = "qwen3-embedding-4b",
        timeout: int = 60
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def embed(self, text: str) -> List[float]:
        """
        单条文本生成 embedding
        """
        url = f"{self.base_url}/v1/embeddings"

        payload = {
            "model": self.model,
            "input": text
        }

        response = requests.post(
            url,
            json=payload,
            timeout=self.timeout
        )
        response.raise_for_status()

        data = response.json()
        return data["data"][0]["embedding"]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        批量文本生成 embedding
        """
        url = f"{self.base_url}/v1/embeddings"

        payload = {
            "model": self.model,
            "input": texts
        }

        response = requests.post(
            url,
            json=payload,
            timeout=self.timeout
        )
        response.raise_for_status()

        data = response.json()

        # 按 index 排序，避免顺序问题
        items = sorted(
            data["data"],
            key=lambda x: x["index"]
        )

        return [
            item["embedding"]
            for item in items
        ]

    def health_check(self) -> bool:
        """
        检查服务是否可用
        """
        try:
            response = requests.get(
                f"{self.base_url}/v1/models",
                timeout=5
            )
            return response.status_code == 200
        except Exception:
            return False


if __name__ == "__main__":
    client = QwenEmbeddingClient()

    print("service ready:", client.health_check())

    embedding = client.embed(
        "企业级 AIGC Portal，支持知识库问答和权限控制型 RAG"
    )

    print("embedding dim:", len(embedding))
    print("first 5:", embedding[:5])
