from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from backend import config
from backend.api.pages import files_router, router as pages_router
from backend.api.exports import files_router as export_files_router, router as exports_router
from backend.api.topics import router as topics_router
from backend.api.uploads import router as uploads_router
from backend.db.ppt_db_client import PPTDatabaseClient


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db = PPTDatabaseClient(**config.DB_CONFIG)
    try:
        db.create_table()
    finally:
        db.close()
    yield


app = FastAPI(title="PPT Page Version API", lifespan=lifespan)
app.include_router(topics_router, prefix="/api")
app.include_router(pages_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")
app.include_router(exports_router, prefix="/api")
app.include_router(files_router)
app.include_router(export_files_router)


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException):
    return JSONResponse({"message": str(exc.detail)}, status_code=exc.status_code)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api.app:app", host="127.0.0.1", port=8000, reload=True)
