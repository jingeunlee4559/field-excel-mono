from typing import Optional
from pydantic import BaseModel, Field


class ExcelPreviewRequest(BaseModel):
    filePath: str = Field(..., description="미리보기로 변환할 AI 서버 storage 내부 엑셀 파일 경로")
    sheetName: Optional[str] = None
