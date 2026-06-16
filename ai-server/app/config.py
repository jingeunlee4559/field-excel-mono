import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME = os.getenv("APP_NAME", "Expense Claim AI Server")
    APP_ENV = os.getenv("APP_ENV", "local")

    # 프로젝트 루트: expense-ai-server-refined/
    PROJECT_ROOT = Path(__file__).resolve().parent.parent

    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "app/storage/uploads").strip()
    RESULT_DIR = os.getenv("RESULT_DIR", "app/storage/results").strip()
    TEMPLATE_DIR = os.getenv("TEMPLATE_DIR", "app/storage/templates").strip()

    # 필요하면 추가로 접근 허용할 경로를 콤마로 지정
    ALLOWED_FILE_ROOTS = os.getenv("ALLOWED_FILE_ROOTS", "").strip()

    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "local").strip().lower()
    LOCAL_LLM_URL = os.getenv("LOCAL_LLM_URL", "http://localhost:11434/api/generate")
    LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "qwen2.5:7b")

    # OCR/LLM 성능 옵션
    # fast: 원본/resize/enhanced 중심으로 빠르게 처리
    # balanced: fast + 일부 보정 후보
    # deep: 모든 후보를 돌리는 정밀 모드
    OCR_MODE = os.getenv("OCR_MODE", "auto").strip().lower()
    LLM_ONLY_WHEN_NEEDED = os.getenv("LLM_ONLY_WHEN_NEEDED", "true").strip().lower() in {"1", "true", "yes", "y", "on"}
    LLM_REQUIRED_FIELDS = [
        item.strip()
        for item in os.getenv("LLM_REQUIRED_FIELDS", "expense_date,vendor_name,total_amount").split(",")
        if item.strip()
    ]
    LLM_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT_SECONDS", "120"))
    # 상세 품목이 정확히 구조화된 경우에만 LLM 생략
    LLM_REQUIRE_VALID_ITEMS = os.getenv("LLM_REQUIRE_VALID_ITEMS", "true").strip().lower() in {"1", "true", "yes", "y", "on"}
    LLM_ITEM_SUM_TOLERANCE_RATE = float(os.getenv("LLM_ITEM_SUM_TOLERANCE_RATE", "0.03"))


    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    MAX_EXCEL_ROWS = int(os.getenv("MAX_EXCEL_ROWS", "80"))
    MAX_EXCEL_COLS = int(os.getenv("MAX_EXCEL_COLS", "30"))

    def resolve_project_path(self, path_value: str) -> Path:
        path = Path(path_value)
        if path.is_absolute():
            return path.resolve()
        return (self.PROJECT_ROOT / path).resolve()

    @property
    def upload_dir_path(self) -> Path:
        return self.resolve_project_path(self.UPLOAD_DIR)

    @property
    def result_dir_path(self) -> Path:
        return self.resolve_project_path(self.RESULT_DIR)

    @property
    def template_dir_path(self) -> Path:
        return self.resolve_project_path(self.TEMPLATE_DIR)

    @property
    def storage_roots(self) -> list[Path]:
        return [
            self.upload_dir_path,
            self.result_dir_path,
            self.template_dir_path,
        ]

    @property
    def allowed_roots(self) -> list[Path]:
        roots: list[Path] = self.storage_roots.copy()

        if self.ALLOWED_FILE_ROOTS:
            for item in self.ALLOWED_FILE_ROOTS.split(","):
                value = item.strip()
                if value:
                    roots.append(Path(value).resolve())

        return roots

    def ensure_storage_dirs(self) -> None:
        for path in self.storage_roots:
            path.mkdir(parents=True, exist_ok=True)


settings = Settings()
