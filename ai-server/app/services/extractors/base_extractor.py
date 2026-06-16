from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseExtractor(ABC):
    """Base class for document-type specific extractors."""

    document_type: str = "RECEIPT"

    @abstractmethod
    def extract(self, ocr_text: str, reference_context: dict[str, Any] | None = None, skip_llm: bool | None = None) -> dict[str, Any]:
        raise NotImplementedError
