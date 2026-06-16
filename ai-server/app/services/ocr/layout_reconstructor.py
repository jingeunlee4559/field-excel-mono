from __future__ import annotations

from typing import Any

from app.services.ocr.ocr_engine import (
    merge_ocr_texts,
    merge_selected_ocr_texts,
    normalize_ocr_line,
    parse_paddle_result,
    parse_paddle_result_with_scores,
)


def reconstruct_text_from_paddle_result(result: Any) -> str:
    """Convert PaddleOCR raw result into ordered text lines.

    This is the first separation point for future coordinate-based row/table reconstruction.
    """
    return parse_paddle_result(result)


__all__ = [
    "merge_ocr_texts",
    "merge_selected_ocr_texts",
    "normalize_ocr_line",
    "parse_paddle_result",
    "parse_paddle_result_with_scores",
    "reconstruct_text_from_paddle_result",
]
