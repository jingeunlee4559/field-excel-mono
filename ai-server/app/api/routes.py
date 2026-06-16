import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile

from app.config import settings
from app.schemas.ai_schema import (
    FilePathRequest,
    ProcessDocumentRequest,
    StructureTextRequest,
    ValidateRequest,
)
from app.schemas.excel_schema import ExcelPreviewRequest
from app.services.excel.excel_preview_service import build_excel_preview
from app.services.storage.file_path_service import resolve_allowed_file_path
from app.services.ai_pipeline import structure_expense_document
from app.services.adaptive_processing import process_document_adaptive
from app.services.ocr.ocr_engine import extract_text_from_file
from app.services.storage.storage_service import save_document_file, save_template_file
from app.services.validators.expense_validator import validate_expense_document

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "success": True,
        "status": "ok",
        "message": "AI server is running",
        "storage": {
            "uploadDir": str(settings.upload_dir_path),
            "templateDir": str(settings.template_dir_path),
            "resultDir": str(settings.result_dir_path),
        },
    }


@router.post("/api/storage/upload-document")
async def upload_document_file(file: UploadFile = File(...)):
    """
    원천자료 파일을 AI 서버 storage/uploads에 저장한다.
    Node.js 백엔드는 이 API에 파일을 전달하고, 반환된 filePath를 DB에 저장하면 된다.
    """
    saved = await save_document_file(file)

    return {
        "success": True,
        "data": saved,
    }


@router.post("/api/storage/upload-template")
async def upload_template_file(file: UploadFile = File(...)):
    """
    엑셀 템플릿 파일을 AI 서버 storage/templates에 저장한다.
    Node.js 백엔드는 이 API에 파일을 전달하고, 반환된 filePath를 templates.file_path에 저장하면 된다.
    """
    saved = await save_template_file(file)

    return {
        "success": True,
        "data": saved,
    }


@router.post("/api/ai/ocr")
def ocr_document(request: FilePathRequest):
    file_path = resolve_allowed_file_path(request.filePath)
    ocr_text = extract_text_from_file(file_path, mode=getattr(request, "ocrMode", None))

    return {
        "success": True,
        "data": {
            "filePath": request.filePath,
            "resolvedFilePath": str(file_path),
            "originalFileName": request.originalFileName or file_path.name,
            "ocrText": ocr_text,
        },
    }


@router.post("/api/ai/structure")
def structure_text(request: StructureTextRequest):
    extracted_data = structure_expense_document(
        ocr_text=request.ocrText,
        document_type=request.documentType,
        reference_context=request.referenceContext,
        skip_llm=request.skipLlm,
    )

    return {
        "success": True,
        "data": {
            "extractedData": extracted_data,
        },
    }


@router.post("/api/ai/validate")
def validate_document(request: ValidateRequest):
    validation_result = validate_expense_document(
        extracted_data=request.extractedData,
        ocr_text=request.ocrText,
        reference_context=request.referenceContext,
    )

    return {
        "success": True,
        "data": {
            "validationResult": validation_result,
        },
    }


@router.post("/api/ai/process-document")
def process_document(request: ProcessDocumentRequest):
    """
    AI 서버 storage 내부 파일 경로 → OCR → LLM 구조화 → 검증 결과를 반환한다.
    엑셀 생성/DB 저장/보완요청 발송은 Node.js 백엔드가 담당한다.
    """
    file_path = resolve_allowed_file_path(request.filePath)

    result = process_document_adaptive(
        file_path=file_path,
        document_type=request.documentType,
        reference_context=request.referenceContext,
        skip_llm=request.skipLlm,
        requested_ocr_mode=request.ocrMode,
    )

    return {
        "success": True,
        "data": {
            "filePath": request.filePath,
            "resolvedFilePath": str(file_path),
            "originalFileName": request.originalFileName or file_path.name,
            **result,
        },
    }


@router.post("/api/ai/process-upload")
async def process_uploaded_document(
    file: UploadFile = File(...),
    documentType: str = Form("RECEIPT"),
    ocrMode: str | None = Form(None),
    skipLlm: bool | None = Form(None),
    referenceContext: str | None = Form(None),
):
    """
    원천자료를 AI 서버에 저장한 뒤 OCR/LLM/검증까지 한 번에 수행한다.
    Node.js 백엔드가 파일을 받아서 그대로 이 API에 전달할 때 사용한다.
    """
    saved = await save_document_file(file)
    file_path = resolve_allowed_file_path(saved["filePath"])

    parsed_reference_context = None
    if referenceContext:
        try:
            parsed_reference_context = json.loads(referenceContext)
        except Exception:
            parsed_reference_context = None

    result = process_document_adaptive(
        file_path=file_path,
        document_type=documentType,
        reference_context=parsed_reference_context,
        skip_llm=skipLlm,
        requested_ocr_mode=ocrMode,
    )

    return {
        "success": True,
        "data": {
            "file": saved,
            **result,
        },
    }


@router.post("/api/excel/preview")
def excel_preview(request: ExcelPreviewRequest):
    """
    템플릿 매핑 화면용 엑셀 미리보기 API.
    filePath는 AI 서버 storage/templates에 저장된 경로를 사용한다.
    """
    file_path = resolve_allowed_file_path(request.filePath)
    result = build_excel_preview(file_path, sheet_name=request.sheetName)

    return {
        "success": True,
        "data": result,
    }

@router.post("/api/excel/preview-upload")
async def excel_preview_upload(
    file: UploadFile = File(...),
    sheetName: str = Form(""),
):
    """
    Node 백엔드가 보관 중인 엑셀 템플릿 파일을 multipart로 전달하면
    Python openpyxl로 실제 양식 미리보기 데이터를 생성한다.

    이 API를 쓰면 Node/ExcelJS가 아니라 openpyxl 기준으로
    매핑 화면 미리보기와 실제 엑셀 자동 입력 기준을 통일할 수 있다.
    """
    original_name = file.filename or "template.xlsx"
    suffix = Path(original_name).suffix.lower() or ".xlsx"

    if suffix not in {".xlsx", ".xlsm", ".xltx", ".xltm"}:
        return {
            "success": False,
            "message": "엑셀 미리보기는 .xlsx, .xlsm 파일만 지원합니다. .xls 파일은 .xlsx로 변환해서 등록하세요.",
        }

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = Path(temp_file.name)

        result = build_excel_preview(
            temp_path,
            sheet_name=sheetName.strip() or None,
        )

        return {
            "success": True,
            "data": result,
        }
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)

