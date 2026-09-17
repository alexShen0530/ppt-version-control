from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse

from backend.services import page_pool_service as service


router = APIRouter()
files_router = APIRouter()


@router.get("/topics/{topic_id}/master-pages")
def master_pages(topic_id: str):
    if not service.topic_exists(topic_id):
        raise HTTPException(404, "主题不存在")
    return service.list_master_pages(topic_id)


@router.get("/revision-groups/{group_id}")
def revision_group(group_id: str):
    detail = service.get_revision_group(group_id)
    if not detail:
        raise HTTPException(404, "版本组不存在")
    return detail


@router.delete("/revision-groups/{group_id}/versions/{page_id}")
def delete_revision(group_id: str, page_id: str):
    result = service.delete_revision(group_id, page_id)
    if not result:
        raise HTTPException(404, "页面版本不存在")
    return result


@router.delete("/revision-groups/{group_id}")
def delete_revision_group(group_id: str):
    result = service.delete_revision_group(group_id)
    if not result:
        raise HTTPException(404, "版本组不存在")
    return result


@files_router.get("/files/pages/{page_id}")
def page_image(page_id: str):
    path = service.get_page_path(page_id)
    if not path:
        raise HTTPException(404, "页面图片不存在")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=31536000, immutable"})


if __name__ == "__main__":
    import sys
    print(service.get_revision_group(sys.argv[1]) if len(sys.argv) > 1 else "usage: pages.py GROUP_ID")
