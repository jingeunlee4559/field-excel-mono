from __future__ import annotations

from typing import Any

from app.services.extractors.simple_rule_extractor import classify_category as _classify_category
from app.services.extractors.simple_rule_extractor import classify_document_type as _classify_document_type


def classify_document_type(ocr_text: str | None, requested: str | None = None) -> str:
    """Classify source document type before extractor selection."""
    return _classify_document_type(ocr_text, requested)


def classify_expense_category(ocr_text: str | None, document_type: str | None = None) -> tuple[str, str]:
    """Return expense_category_code, expense_category_name."""
    return _classify_category(ocr_text, document_type)


def build_classifier_result(ocr_text: str | None, requested: str | None = None) -> dict[str, Any]:
    document_type = classify_document_type(ocr_text, requested)
    category_code, category_name = classify_expense_category(ocr_text, document_type)
    return {
        "document_type": document_type,
        "expense_category_code": category_code,
        "expense_category_name": category_name,
    }
