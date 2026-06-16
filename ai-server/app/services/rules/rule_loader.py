from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[2]
RULE_DIR = BASE_DIR / "resources" / "rules"


def _load_json(filename: str, fallback: Any) -> Any:
    path = RULE_DIR / filename
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return fallback


@lru_cache(maxsize=16)
def get_receipt_rules() -> dict[str, Any]:
    return _load_json("receipt_rules.json", {})


@lru_cache(maxsize=16)
def get_document_type_rules() -> dict[str, Any]:
    return _load_json("document_type_rules.json", {})


@lru_cache(maxsize=16)
def get_validation_rules() -> dict[str, Any]:
    return _load_json("validation_rules.json", {})


@lru_cache(maxsize=16)
def get_expense_category_rules() -> dict[str, Any]:
    return _load_json("expense_category_rules.json", {})
