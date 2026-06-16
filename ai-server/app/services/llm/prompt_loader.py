from functools import lru_cache
from pathlib import Path

PROMPT_DIR = Path(__file__).resolve().parent.parent / "prompts"


@lru_cache(maxsize=32)
def load_prompt(name: str) -> str:
    safe_name = Path(name).name
    path = PROMPT_DIR / safe_name
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def build_prompt(name: str, *, ocr_text: str, reference_context: str = "", extracted_json: str = "") -> str:
    template = load_prompt(name)
    parts = [template.strip()]
    if reference_context:
        parts.append("\n[DB 기준정보 요약]\n" + reference_context.strip())
    if extracted_json:
        parts.append("\n[추출 JSON]\n" + extracted_json.strip())
    parts.append("\n[OCR 원문]\n" + (ocr_text or "").strip())
    return "\n\n".join(part for part in parts if part)
