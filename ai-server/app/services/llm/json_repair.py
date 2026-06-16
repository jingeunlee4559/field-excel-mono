from __future__ import annotations

import json
import re
from typing import Any


def extract_json_object(raw: Any) -> dict[str, Any] | None:
    """Extract a single JSON object from LLM output.

    Local LLMs sometimes wrap JSON in Markdown or prepend text. This helper keeps
    JSON repair isolated from the extraction pipeline.
    """
    if isinstance(raw, dict):
        return raw
    text = str(raw or "").strip()
    if not text:
        return None
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(text[start:end + 1])
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None
