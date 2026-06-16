from __future__ import annotations

from typing import Any

from app.services.ai_pipeline import structure_expense_document
from app.services.extractors.base_extractor import BaseExtractor


class ItemReceiptExtractor(BaseExtractor):
    document_type = "ITEM_RECEIPT"

    def extract(self, ocr_text: str, reference_context: dict[str, Any] | None = None, skip_llm: bool | None = None) -> dict[str, Any]:
        return structure_expense_document(
            ocr_text=ocr_text,
            document_type=self.document_type,
            reference_context=reference_context,
            skip_llm=skip_llm,
        )


def extract_item_receipt(ocr_text: str, reference_context: dict[str, Any] | None = None, skip_llm: bool | None = None) -> dict[str, Any]:
    return ItemReceiptExtractor().extract(ocr_text, reference_context, skip_llm)
