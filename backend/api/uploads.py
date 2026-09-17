from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Form, HTTPException, UploadFile

from backend import config
from backend.db.ppt_db_client import PPTDatabaseClient
from backend.services.upload_service import create_upload, get_upload, list_uploads, upload_path


router = APIRouter()


@router.post("/ppt/upload")
async def upload_ppt(file: UploadFile, topic_id: Annotated[str, Form()]):
    file_name = Path(file.filename or "").name
    if Path(file_name).suffix.lower() not in {".ppt", ".pptx"}:
        raise HTTPException(400, "仅支持 .ppt 和 .pptx 文件")

    db = PPTDatabaseClient(**config.DB_CONFIG)
    try:
        if not db.execute("SELECT 1 FROM topics WHERE topic_id = %s;", (topic_id,), "one"):
            raise HTTPException(404, "主题不存在")
        if db.execute("""
            SELECT 1 FROM pages WHERE topic_id = %s AND source_file_name = %s
            UNION ALL
            SELECT 1 FROM upload_tasks
            WHERE topic_id = %s AND file_name = %s AND status <> 'failed'
            LIMIT 1;
        """, (topic_id, file_name, topic_id, file_name), "one"):
            raise HTTPException(409, "该主题下已存在同名 PPT")
    finally:
        db.close()

    upload_id = str(uuid4())
    target = upload_path(upload_id, file_name)
    with target.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            output.write(chunk)
    create_upload(file_name, topic_id, str(target), upload_id)
    return {"upload_id": upload_id}


@router.get("/uploads")
def upload_history():
    return list_uploads()


@router.get("/uploads/{upload_id}")
def upload_status(upload_id: str):
    task = get_upload(upload_id)
    if not task:
        raise HTTPException(404, "上传任务不存在")
    return task


if __name__ == "__main__":
    import sys
    print(get_upload(sys.argv[1]) if len(sys.argv) > 1 else "usage: uploads.py UPLOAD_ID")
