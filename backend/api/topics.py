from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from backend.services import page_pool_service as service


router = APIRouter()


class TopicBody(BaseModel):
    name: str


def _name(body: TopicBody) -> str:
    if not body.name.strip():
        raise HTTPException(400, "主题名称不能为空")
    return body.name.strip()


@router.get("/topics")
def list_topics():
    return service.list_topics()


@router.post("/topics")
def create_topic(body: TopicBody):
    return service.create_topic(_name(body))


@router.patch("/topics/{topic_id}")
def rename_topic(topic_id: str, body: TopicBody):
    topic = service.rename_topic(topic_id, _name(body))
    if not topic:
        raise HTTPException(404, "主题不存在")
    return topic


@router.delete("/topics/{topic_id}", status_code=204)
def delete_topic(topic_id: str):
    if not service.delete_topic(topic_id):
        raise HTTPException(404, "主题不存在")
    return Response(status_code=204)


if __name__ == "__main__":
    print(service.list_topics())
