from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings
from app.services.ocr.ocr_engine import warmup_ocr


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.ensure_storage_dirs()
    print("=" * 80, flush=True)
    print("[AI SERVER STARTUP]", flush=True)
    print(f"APP_NAME: {settings.APP_NAME}", flush=True)
    print(f"UPLOAD_DIR: {settings.upload_dir_path}", flush=True)
    print(f"TEMPLATE_DIR: {settings.template_dir_path}", flush=True)
    print(f"RESULT_DIR: {settings.result_dir_path}", flush=True)
    print(f"LLM_PROVIDER: {settings.LLM_PROVIDER}", flush=True)
    print(f"LOCAL_LLM_URL: {settings.LOCAL_LLM_URL}", flush=True)
    print(f"LOCAL_LLM_MODEL: {settings.LOCAL_LLM_MODEL}", flush=True)
    print("=" * 80, flush=True)

    try:
        warmup_ocr()
        print("[OCR READY] PaddleOCR 모델이 서버 시작 시 로딩되었습니다.", flush=True)
    except Exception as exc:
        print("[OCR WARMUP FAILED]", flush=True)
        print(str(exc), flush=True)
        print("서버는 계속 실행됩니다. 첫 OCR 요청 시 다시 초기화를 시도합니다.", flush=True)

    yield
    print("[AI SERVER SHUTDOWN]", flush=True)


app = FastAPI(
    title=settings.APP_NAME,
    description="경비 증빙 OCR/LLM 구조화 및 엑셀 템플릿 미리보기 서버",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "success": True,
        "message": "Expense Claim AI server is running",
        "storage": {
            "uploadDir": str(settings.upload_dir_path),
            "templateDir": str(settings.template_dir_path),
            "resultDir": str(settings.result_dir_path),
        },
        "llm": {
            "provider": settings.LLM_PROVIDER,
            "localUrl": settings.LOCAL_LLM_URL,
            "localModel": settings.LOCAL_LLM_MODEL,
        },
    }
