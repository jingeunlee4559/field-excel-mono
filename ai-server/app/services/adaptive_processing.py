from __future__ import annotations

import time
import re
from pathlib import Path
from typing import Any

from app.services.ai_pipeline import structure_expense_document, to_number
from app.services.ocr.ocr_engine import extract_text_from_file
from app.services.validators.expense_validator import apply_validation_penalty, validate_expense_document


def _validation_status(validation_result: dict[str, Any] | None) -> str:
    if not validation_result:
        return "NEED_REVIEW"
    return str(validation_result.get("status") or validation_result.get("validationStatus") or "NEED_REVIEW").upper()


def _processing_status(validation_result: dict[str, Any], extracted_data: dict[str, Any]) -> str:
    status = _validation_status(validation_result)
    if status == "PASS" and not extracted_data.get("needs_review"):
        return "NORMAL"
    if status in {"SUPPLEMENT_REQUIRED_CANDIDATE", "NEED_SUPPLEMENT"}:
        return "SUPPLEMENT_REQUIRED_CANDIDATE"
    return "NEED_REVIEW"


def _ocr_auto_pass_allowed(extracted_data: dict[str, Any]) -> bool:
    if str(extracted_data.get("document_type") or "").upper().startswith("HANDWRITTEN"):
        return False
    if extracted_data.get("handwritten_detected") or extracted_data.get("auto_pass_allowed") is False:
        return False

    ocr_meta = extracted_data.get("ocr_meta") or {}
    input_quality = ocr_meta.get("input_quality") or {}
    if input_quality.get("very_blurry") or input_quality.get("supplement_candidate"):
        return False

    quality = to_number(ocr_meta.get("ocr_quality_score") or ocr_meta.get("ocr_confidence"))
    engine_confidence = to_number(ocr_meta.get("engine_confidence"))
    if quality is not None and quality < 0.65:
        return False
    if engine_confidence is not None and engine_confidence < 0.82:
        return False

    hints = ocr_meta.get("field_hints") or {}
    amount_count = len(hints.get("amounts") or [])
    items = extracted_data.get("items") or []
    if amount_count >= 3 and len(items) <= 1:
        return False

    return True


def _is_auto_pass(validation_result: dict[str, Any], extracted_data: dict[str, Any]) -> bool:
    if _validation_status(validation_result) != "PASS":
        return False
    if extracted_data.get("needs_review"):
        return False
    if not _ocr_auto_pass_allowed(extracted_data):
        return False
    confidence = to_number(extracted_data.get("confidence"))
    if confidence is not None and confidence < 0.82:
        return False
    return True


def _run_pass(
    *,
    file_path: str | Path,
    mode: str,
    document_type: str | None,
    reference_context: dict[str, Any] | None,
    skip_llm: bool | None,
) -> dict[str, Any]:
    started = time.time()
    ocr_text = extract_text_from_file(file_path, mode=mode)
    extracted_data = structure_expense_document(
        ocr_text=ocr_text,
        document_type=document_type,
        reference_context=reference_context,
        skip_llm=skip_llm,
    )
    validation_result = validate_expense_document(extracted_data=extracted_data, ocr_text=ocr_text, reference_context=reference_context)
    extracted_data = apply_validation_penalty(extracted_data, validation_result)
    return {
        "mode": mode,
        "ocrText": ocr_text,
        "extractedData": extracted_data,
        "validationResult": validation_result,
        "processingStatus": _processing_status(validation_result, extracted_data),
        "elapsedSeconds": round(time.time() - started, 3),
    }


def _safe_float(value: Any) -> float | None:
    try:
        number = float(value)
    except Exception:
        return None
    if number != number:
        return None
    return number


def _amount_count_from_text(text: str) -> int:
    return len(set(re.findall(r"\d{1,3}(?:[,\.]\d{3})+", text or "")))


def _date_count_from_text(text: str) -> int:
    return len(set(re.findall(r"20\d{2}[-./년\s]*\d{1,2}[-./월\s]*\d{1,2}|\d{2}[-./]\d{1,2}[-./]\d{1,2}", text or "")))


def _pass_score(result: dict[str, Any]) -> float:
    """fallback OCR이 더 나쁜 텍스트를 만들었는지 판단하기 위한 보수적 점수.

    balanced/deep는 후보가 많아 느릴 뿐 아니라, 과한 이진화/라인 보존 후보가
    품목명을 깨뜨리는데도 품질점수만 높게 잡히는 경우가 있다. 따라서 최종 반환 전
    OCR 텍스트 길이, 금액/날짜 패턴, 품목 수, 검증 상태를 함께 본다.
    """
    data = result.get("extractedData") or {}
    meta = data.get("ocr_meta") or {}
    text = result.get("ocrText") or ""

    score = 0.0

    quality = _safe_float(meta.get("ocr_quality_score") or meta.get("ocr_confidence"))
    engine = _safe_float(meta.get("engine_confidence"))
    confidence = _safe_float(data.get("confidence"))

    if quality is not None:
        score += quality * 0.34
    if engine is not None:
        score += engine * 0.20
    if confidence is not None:
        score += confidence * 0.18

    text_len = len(text.strip())
    if text_len >= 250:
        score += 0.12
    elif text_len >= 120:
        score += 0.08
    elif text_len >= 50:
        score += 0.04

    amount_count = _amount_count_from_text(text)
    date_count = _date_count_from_text(text)
    score += min(0.10, amount_count * 0.025)
    score += min(0.06, date_count * 0.03)

    items = data.get("items") or []
    if isinstance(items, list):
        score += min(0.16, len(items) * 0.04)

    status = _validation_status(result.get("validationResult"))
    if status == "PASS" and not data.get("needs_review"):
        score += 0.20
    elif status in {"NEED_REVIEW", "SUPPLEMENT_REQUIRED_CANDIDATE", "NEED_SUPPLEMENT"}:
        score -= 0.03

    if data.get("handwritten_detected"):
        score -= 0.12

    return round(score, 4)


def _fallback_is_materially_worse(first: dict[str, Any], second: dict[str, Any]) -> bool:
    """balanced/deep 결과가 fast 결과보다 명백히 나쁘면 fast 결과를 유지한다."""
    first_text = first.get("ocrText") or ""
    second_text = second.get("ocrText") or ""

    first_score = _pass_score(first)
    second_score = _pass_score(second)

    first_amounts = _amount_count_from_text(first_text)
    second_amounts = _amount_count_from_text(second_text)
    first_dates = _date_count_from_text(first_text)
    second_dates = _date_count_from_text(second_text)

    first_len = len(first_text.strip())
    second_len = len(second_text.strip())

    # 자동통과라면 fallback을 사용한다. 단, 이 함수는 fallback이 명백히 나쁜 경우만 거른다.
    if _is_auto_pass(second.get("validationResult") or {}, second.get("extractedData") or {}):
        return False

    if first_len >= 80 and second_len < first_len * 0.55:
        return True

    if first_amounts >= 2 and second_amounts == 0:
        return True

    if first_dates >= 1 and second_dates == 0 and second_score <= first_score + 0.05:
        return True

    if second_score + 0.08 < first_score:
        return True

    return False


def process_document_adaptive(
    *,
    file_path: str | Path,
    document_type: str | None = "RECEIPT",
    reference_context: dict[str, Any] | None = None,
    skip_llm: bool | None = None,
    requested_ocr_mode: str | None = None,
) -> dict[str, Any]:
    """Fast-first OCR → rule extraction → validation → fallback OCR/LLM.

    1차는 항상 빠르게 1~2개 OCR 후보만 사용하고 LLM을 호출하지 않는다.
    통과하지 못한 경우에만 balanced/deep OCR과 LLM 보정을 사용한다.
    단, fallback OCR이 fast보다 명백히 나쁜 텍스트를 만들면 fast 결과를 보존한다.
    """
    started = time.time()
    requested = (requested_ocr_mode or "auto").strip().lower()

    first = _run_pass(
        file_path=file_path,
        mode="fast",
        document_type=document_type,
        reference_context=reference_context,
        skip_llm=True,
    )
    first["passNo"] = 1
    first["llmUsed"] = False

    if _is_auto_pass(first["validationResult"], first["extractedData"]):
        first["adaptiveProcessing"] = {
            "strategy": "FAST_FIRST_RULE_THEN_SAFE_FALLBACK",
            "finalPass": 1,
            "fallbackUsed": False,
            "requestedOcrMode": requested,
            "totalElapsedSeconds": round(time.time() - started, 3),
            "passes": [{
                "passNo": 1,
                "mode": first["mode"],
                "llmUsed": False,
                "status": first["processingStatus"],
                "score": _pass_score(first),
                "elapsedSeconds": first["elapsedSeconds"],
            }],
        }
        return first

    fallback_mode = "deep" if requested == "deep" else "balanced"
    second_skip_llm = skip_llm if skip_llm is not None else None
    second = _run_pass(
        file_path=file_path,
        mode=fallback_mode,
        document_type=document_type,
        reference_context=reference_context,
        skip_llm=second_skip_llm,
    )
    second["passNo"] = 2
    second["llmUsed"] = bool(second.get("extractedData", {}).get("llm_used"))

    first_score = _pass_score(first)
    second_score = _pass_score(second)
    fallback_rejected = _fallback_is_materially_worse(first, second)
    final = first if fallback_rejected else second
    final_pass_no = 1 if fallback_rejected else 2

    final["adaptiveProcessing"] = {
        "strategy": "FAST_FIRST_RULE_THEN_SAFE_FALLBACK",
        "finalPass": final_pass_no,
        "fallbackUsed": True,
        "fallbackRejected": fallback_rejected,
        "fallbackRejectReason": "fallback OCR text looked materially worse than fast OCR" if fallback_rejected else None,
        "requestedOcrMode": requested,
        "totalElapsedSeconds": round(time.time() - started, 3),
        "passes": [
            {
                "passNo": 1,
                "mode": first["mode"],
                "llmUsed": False,
                "status": first["processingStatus"],
                "score": first_score,
                "textLength": len(first.get("ocrText") or ""),
                "elapsedSeconds": first["elapsedSeconds"],
            },
            {
                "passNo": 2,
                "mode": second["mode"],
                "llmUsed": second["llmUsed"],
                "status": second["processingStatus"],
                "score": second_score,
                "textLength": len(second.get("ocrText") or ""),
                "elapsedSeconds": second["elapsedSeconds"],
            },
        ],
        "firstPassValidationStatus": _validation_status(first["validationResult"]),
    }
    return final
