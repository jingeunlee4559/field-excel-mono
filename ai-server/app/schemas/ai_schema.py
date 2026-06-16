from typing import Any, Optional
from pydantic import BaseModel, Field


class FilePathRequest(BaseModel):
    filePath: str = Field(..., description="AI 서버 storage 내부 파일 경로")
    originalFileName: Optional[str] = None
    documentType: Optional[str] = "RECEIPT"
    ocrMode: Optional[str] = None


class StructureTextRequest(BaseModel):
    ocrText: str
    documentType: Optional[str] = "RECEIPT"
    referenceContext: Optional[dict[str, Any]] = None
    skipLlm: Optional[bool] = None


class ValidateRequest(BaseModel):
    extractedData: dict[str, Any]
    ocrText: Optional[str] = ""
    referenceContext: Optional[dict[str, Any]] = None


class ProcessDocumentRequest(BaseModel):
    filePath: str
    originalFileName: Optional[str] = None
    documentType: Optional[str] = "RECEIPT"
    ocrMode: Optional[str] = None
    referenceContext: Optional[dict[str, Any]] = None
    skipLlm: Optional[bool] = None
