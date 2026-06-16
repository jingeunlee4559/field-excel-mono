from pathlib import Path
from fastapi import HTTPException

from app.config import settings


def resolve_allowed_file_path(file_path: str) -> Path:
    """
    AI 서버 내부 storage 경로를 실제 파일 경로로 변환한다.

    허용 방식:
    1. 절대 경로
    2. AI 서버 프로젝트 루트 기준 상대 경로
       예: app/storage/templates/xxx.xlsx
    3. uploads/templates/xxx.xlsx 처럼 넘어온 경우에도 storage 하위에서 탐색
    """
    if not file_path or not str(file_path).strip():
        raise HTTPException(status_code=400, detail="filePath가 비어 있습니다.")

    raw_value = str(file_path).strip().replace("\\", "/")
    raw_path = Path(raw_value)

    candidates: list[Path] = []

    if raw_path.is_absolute():
        candidates.append(raw_path)
    else:
        candidates.append(settings.PROJECT_ROOT / raw_path)

        # 파일명만 또는 uploads/templates 형태로 들어온 경우 보정
        candidates.append(settings.upload_dir_path / raw_path.name)
        candidates.append(settings.template_dir_path / raw_path.name)
        candidates.append(settings.result_dir_path / raw_path.name)

    allowed_roots = settings.allowed_roots

    for candidate in candidates:
        resolved = candidate.resolve()

        if not resolved.exists():
            continue

        is_allowed = any(
            resolved == root or root in resolved.parents
            for root in allowed_roots
        )

        if not is_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"허용되지 않은 파일 경로입니다: {resolved}",
            )

        return resolved

    raise HTTPException(
        status_code=404,
        detail=f"파일을 찾을 수 없습니다: {file_path}",
    )


def to_project_relative_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(settings.PROJECT_ROOT).as_posix()
    except ValueError:
        return resolved.as_posix()
