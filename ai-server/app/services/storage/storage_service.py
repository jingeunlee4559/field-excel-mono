from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.config import settings
from app.services.storage.file_path_service import to_project_relative_path


# OCR/LLM 원천자료는 이미지/PDF만 허용한다.
# 엑셀은 OCR 대상이 아니라 템플릿 파일로 별도 업로드한다.
ALLOWED_DOCUMENT_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
}

ALLOWED_TEMPLATE_EXTENSIONS = {
    ".xlsx",
    ".xlsm",
    ".xls",
}


def _safe_filename(filename: str) -> str:
    name = Path(filename or "uploaded_file").name
    return name.replace("/", "_").replace("\\", "_").strip() or "uploaded_file"


def _validate_extension(filename: str, allowed_extensions: set[str], label: str) -> str:
    extension = Path(filename).suffix.lower()

    if extension not in allowed_extensions:
        allowed_text = ", ".join(sorted(allowed_extensions))
        raise HTTPException(
            status_code=400,
            detail=f"{label} 파일 형식이 아닙니다. 허용 확장자: {allowed_text}",
        )

    return extension


async def save_upload_file(
    file: UploadFile,
    target_dir: Path,
    allowed_extensions: set[str],
    label: str,
) -> dict:
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail=f"{label} 파일을 업로드하세요.")

    original_name = _safe_filename(file.filename)
    extension = _validate_extension(original_name, allowed_extensions, label)

    target_dir.mkdir(parents=True, exist_ok=True)

    saved_name = f"{uuid4().hex}_{original_name}"
    saved_path = target_dir / saved_name

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="빈 파일은 저장할 수 없습니다.")

    saved_path.write_bytes(content)

    return {
        "originalFileName": original_name,
        "savedFileName": saved_name,
        "filePath": to_project_relative_path(saved_path),
        "absolutePath": str(saved_path.resolve()),
        "fileSize": len(content),
        "fileType": extension.replace(".", ""),
    }


async def save_document_file(file: UploadFile) -> dict:
    return await save_upload_file(
        file=file,
        target_dir=settings.upload_dir_path,
        allowed_extensions=ALLOWED_DOCUMENT_EXTENSIONS,
        label="원천자료",
    )


async def save_template_file(file: UploadFile) -> dict:
    return await save_upload_file(
        file=file,
        target_dir=settings.template_dir_path,
        allowed_extensions=ALLOWED_TEMPLATE_EXTENSIONS,
        label="엑셀 템플릿",
    )
