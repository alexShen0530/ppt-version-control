from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.services.export_service import (
    ExportExpiredError,
    create_export,
    get_export,
    get_export_path,
    list_exports,
)


router = APIRouter()
files_router = APIRouter()


class ExportBody(BaseModel):
    page_ids: list[str]
    topic_id: str


@router.post("/ppt/export")
def start_export(body: ExportBody):
    try:
        return {"export_id": create_export(body.page_ids, body.topic_id)}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/ppt/exports")
def export_history():
    return list_exports()


@router.get("/ppt/exports/{export_id}")
def export_status(export_id: str):
    task = get_export(export_id)
    if not task:
        raise HTTPException(404, "导出任务不存在")
    return task


@files_router.get("/files/exports/{export_id}")
def download_export(export_id: str):
    try:
        path = get_export_path(export_id)
    except ExportExpiredError as exc:
        raise HTTPException(410, "导出文件已过期") from exc
    if not path:
        raise HTTPException(404, "导出文件不存在或尚未生成")
    return FileResponse(
        path,
        filename=f"ppt_pages_{export_id[:8]}.pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )


if __name__ == "__main__":
    import sys
    print(get_export(sys.argv[1]) if len(sys.argv) > 1 else "usage: exports.py EXPORT_ID")
