from __future__ import annotations

import time
import re
from typing import Any

from app.config import settings
from app.services.classifiers.document_classifier import classify_expense_category
from app.services.rules.constants import CATEGORY_CODE_TO_NAME, CATEGORY_NAME_TO_CODE
from app.services.llm.llm_client import call_llm_structure
from app.services.ocr.ocr_engine import get_last_ocr_meta
from app.services.extractors.simple_rule_extractor import build_rule_result, normalize_items, to_number
from app.services.parsers.receipt_item_parser import extract_pos_receipt_items, extract_pos_receipt_item_candidates
from app.services.normalizers.vendor_normalizer import normalize_vendor_name, is_bad_vendor_candidate
from app.services.guards.strict_extraction_guard import apply_strict_extraction_guards, apply_strict_confidence_caps
from app.services.rules.rule_context import classify_category_with_context, normalize_item_name_with_context, normalize_payment_with_context


def structure_expense_document(
    ocr_text: str,
    document_type: str | None = "RECEIPT",
    reference_context: dict[str, Any] | None = None,
    skip_llm: bool | None = None,
) -> dict[str, Any]:
    """End-to-end expense extraction pipeline.

    Pipeline order:
    1. Rule-based extraction from OCR text
    2. Decide whether LLM is actually needed
    3. LLM correction only for missing/ambiguous values
    4. Merge + confidence + review routing
    """
    started_at = time.time()
    text = (ocr_text or "").strip()
    ocr_meta = get_last_ocr_meta()

    rule_data = build_rule_result(text, document_type=document_type, reference_context=reference_context)
    rule_data["ocr_meta"] = ocr_meta
    # OCR 후보 전체를 이용해 품목 후보를 한 번 더 rescue한다.
    # selected OCR 1개가 품목명을 깨뜨려도 다른 후보에 정상 품목명이 남아 있는 경우가 많다.
    enhance_items_from_ocr_candidates(rule_data, ocr_meta, text)
    apply_reference_context_to_result(rule_data, reference_context)
    apply_global_context_to_detail_items(rule_data, reference_context)

    should_skip, llm_decision_reason = decide_skip_llm_with_reason(rule_data, skip_llm=skip_llm)
    llm_data: dict[str, Any] | None = None
    llm_error: str | None = None

    if not should_skip:
        try:
            llm_data = call_llm_structure(
                ocr_text=text,
                document_type=document_type,
                seed_data=rule_data,
                reference_context=reference_context,
            )
        except Exception as exc:
            llm_error = str(exc)

    if llm_data:
        merged = merge_extraction(rule_data, llm_data, text, document_type)
        source = "RULE_PLUS_LLM"
    else:
        merged = dict(rule_data)
        source = "RULE_ONLY" if should_skip else "RULE_ONLY_LLM_FAILED"

    enforce_transport_rule_values(merged, rule_data)
    merged["source"] = source
    merged["patch_version"] = "receipt-adaptive-v3-2026-06-12"
    merged["llm_used"] = bool(llm_data)
    merged["llm_error"] = llm_error
    merged["llm_decision_reason"] = llm_decision_reason
    merged["ocr_meta"] = ocr_meta
    merged["raw_text"] = text
    sanitize_final_fields(merged)
    apply_reference_context_to_result(merged, reference_context)
    apply_global_context_to_detail_items(merged, reference_context)
    apply_strict_extraction_guards(merged)
    apply_reference_context_to_result(merged, reference_context)
    apply_global_context_to_detail_items(merged, reference_context)

    confidence = calculate_confidence(merged)
    merged["confidence_before_validation"] = confidence
    merged["confidence_before_validation_percent"] = int(round(confidence * 100))
    merged["confidence"] = confidence
    merged["confidence_percent"] = int(round(confidence * 100))
    merged["extraction_confidence"] = confidence
    merged["extraction_confidence_percent"] = int(round(confidence * 100))
    merged["ocr_confidence"] = ocr_meta.get("ocr_confidence") or ocr_meta.get("ocr_quality_score")
    merged["ocr_confidence_percent"] = ocr_meta.get("ocr_confidence_percent") or ocr_meta.get("ocr_quality_percent")
    merged["elapsed_seconds"] = round(time.time() - started_at, 3)

    review_reasons = list(merged.get("review_reasons") or merged.get("review_reason") or [])
    if llm_error:
        review_reasons.append(f"LLM 구조화 실패: {llm_error}")
    if confidence < 0.82:
        review_reasons.append("추출 신뢰도가 자동통과 기준보다 낮습니다.")
    merged["review_reasons"] = dedupe(review_reasons)
    merged["review_reason"] = merged["review_reasons"]
    merged["needs_review"] = bool(merged["review_reasons"])

    return merged



def expected_item_total_for_data(data: dict[str, Any]) -> float | None:
    total = to_number(data.get("sale_total_amount") or data.get("gross_amount"))
    if total is not None:
        return total
    paid = to_number(data.get("total_amount") or data.get("claim_amount") or data.get("paid_amount"))
    discount = to_number(data.get("discount_amount")) or 0
    if paid is not None and discount:
        return paid + discount
    return paid


def item_sum(items: Any) -> float:
    if not isinstance(items, list):
        return 0.0
    return float(sum(float(to_number(item.get("amount")) or 0) for item in items if isinstance(item, dict)))


def item_name_risk(value: Any) -> float:
    """OCR 후보 세트 선택용 품목명 위험 점수. 낮을수록 좋다."""
    text = str(value or "").strip()
    if not text:
        return 100.0
    compacted = re.sub(r"\s+", "", text)
    risk = 0.0
    if not (re.search(r"[가-힣]{2,}", compacted) or re.search(r"[A-Za-z]{2,}", compacted)):
        risk += 50.0
    if re.search(r"\d{1,3}(?:[,\.]\d{3})+", text):
        risk += 25.0
    letters = len(re.findall(r"[가-힣A-Za-z]", compacted))
    digits = len(re.findall(r"\d", compacted))
    if digits and digits >= letters:
        risk += 20.0
    if re.search(r"[^가-힣A-Za-z0-9\s()!+&%./-]", text):
        risk += 6.0
    return risk


def item_set_score(items: list[dict[str, Any]], expected: float | None) -> tuple[float, float, float, int]:
    """품목 후보 세트 점수. 합계 일치 + 정상 품목명 + 많은 품목을 우선한다."""
    if not items:
        return (10**12, 10**12, 10**12, 0)
    s = item_sum(items)
    diff = abs(round(s) - round(expected)) if expected is not None else 0
    risk = sum(item_name_risk(item.get("item_name") or item.get("description")) for item in items if isinstance(item, dict))
    return (diff, risk, -len(items), int(s))



def apply_reference_context_to_result(data: dict[str, Any], reference_context: dict[str, Any] | None = None) -> None:
    """DB Rule Context를 최종 구조화 결과에 적용한다.

    - CATEGORY 사전은 상단 분류가 비어 있거나 기타일 때 우선 적용한다.
    - ITEM/OCR_TEXT 사전은 상세 품목명에 적용한다.
    - PAYMENT 사전은 결제수단에 적용한다.
    """
    if not isinstance(data, dict) or not reference_context:
        return

    data["rule_context_applied"] = True
    data["rule_context_version"] = reference_context.get("version")

    context_source = " ".join([
        str(data.get("raw_text") or ""),
        str(data.get("vendor_name") or ""),
        str(data.get("item_description") or ""),
    ])
    context_category = classify_category_with_context(context_source, data.get("document_type"), reference_context)
    current_code = clean_category_code(data.get("expense_category_code"))
    current_name = clean_category_name(data.get("expense_category_name") or data.get("category"))
    if context_category and (not current_code or current_code == "ETC" or current_name in {None, "기타"}):
        data["expense_category_code"], data["expense_category_name"] = context_category
        data["category"] = context_category[1]
        data["category_source"] = "DB_RULE_CONTEXT"

    payment = normalize_payment_with_context(data.get("payment_method"), reference_context)
    if payment:
        data["payment_method"] = payment

    for key in ["items", "detail_items", "item_candidates"]:
        items = data.get(key)
        if not isinstance(items, list):
            continue
        fixed = []
        for raw in items:
            if not isinstance(raw, dict):
                continue
            item = dict(raw)
            normalized_name = normalize_item_name_with_context(item.get("item_name") or item.get("description"), reference_context)
            if normalized_name:
                item["item_name"] = normalized_name
                item["description"] = normalized_name
            fixed.append(item)
        data[key] = fixed

def apply_global_context_to_detail_items(data: dict[str, Any], reference_context: dict[str, Any] | None = None) -> None:
    """상단 추출값과 상세 품목의 날짜/사용처/카테고리를 일관화한다.

    OCR 후보 rescue 단계에서 나온 품목은 기본 분류가 ETC로 들어올 수 있다.
    상단 문서 분류가 MEAL/TRANSPORT/SUPPLIES 등으로 이미 결정되어 있으면 상세 품목도 이를 따라야
    화면에서 한 영수증 안에 `식비`와 `기타`가 섞이는 문제가 없다.
    """
    items = data.get("items") or data.get("detail_items") or []
    if not isinstance(items, list):
        return

    category_code = clean_category_code(data.get("expense_category_code"))
    category_name = clean_category_name(data.get("expense_category_name") or data.get("category"))
    if not category_code and category_name:
        category_code = CATEGORY_NAME_TO_CODE.get(category_name)
    context_text = " ".join([
        str(data.get("raw_text") or ""),
        str(data.get("vendor_name") or ""),
        " ".join(str(item.get("item_name") or item.get("description") or "") for item in items if isinstance(item, dict)),
    ])
    context_category = classify_category_with_context(context_text, data.get("document_type"), reference_context)
    if context_category and (not category_code or category_code == "ETC" or category_name in {None, "기타"}):
        category_code, category_name = context_category
    elif category_code:
        category_name = CATEGORY_CODE_TO_NAME.get(category_code, category_name or "기타")
    else:
        category_code = "ETC"
        category_name = category_name or "기타"

    vendor = data.get("vendor_name")
    expense_date = data.get("expense_date")
    fixed_items: list[dict[str, Any]] = []
    alcohol_re = re.compile(r"소주|맥주|막걸리|와인|하이볼|참이슬|카스|테라|코젤|주류|생맥", re.I)

    for idx, raw in enumerate(items, start=1):
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        normalized_name = normalize_item_name_with_context(item.get("item_name") or item.get("description"), reference_context)
        if normalized_name:
            item["item_name"] = normalized_name
            item["description"] = normalized_name
        item["line_no"] = item.get("line_no") or idx
        item["expense_date"] = item.get("expense_date") or expense_date
        if is_bad_vendor_candidate(item.get("vendor_name")):
            item["vendor_name"] = None
        item["vendor_name"] = item.get("vendor_name") or vendor

        item_code = clean_category_code(item.get("expense_category_code"))
        item_name = clean_category_name(item.get("expense_category_name"))
        # 상세 row가 비어 있거나 기타이면 상단 확정 카테고리를 우선 적용한다.
        if category_code and (not item_code or item_code == "ETC" or item_name in {None, "기타"}):
            item["expense_category_code"] = category_code
            item["expense_category_name"] = category_name
        else:
            item["expense_category_code"] = item_code or category_code
            item["expense_category_name"] = CATEGORY_CODE_TO_NAME.get(item["expense_category_code"], item_name or category_name)

        desc = str(item.get("item_name") or item.get("description") or "")
        if category_code == "MEAL" and alcohol_re.search(desc):
            memo = str(item.get("memo") or item.get("note") or "").strip()
            if "주류 포함" not in memo:
                memo = f"{memo}, 주류 포함".strip(", ") if memo else "주류 포함"
            item["memo"] = memo
            item["note"] = item.get("note") or memo
        fixed_items.append(item)

    data["items"] = fixed_items
    data["detail_items"] = fixed_items
    if fixed_items:
        data["item_candidates"] = data.get("item_candidates") or fixed_items


def enhance_items_from_ocr_candidates(data: dict[str, Any], ocr_meta: dict[str, Any], selected_text: str) -> None:
    doc_type = str(data.get("document_type") or "").upper()
    if "TRANSPORT" in doc_type or "HANDWRITTEN" in doc_type:
        return

    expected = expected_item_total_for_data(data)
    if expected is None:
        return

    texts: list[str] = []
    if selected_text:
        texts.append(selected_text)
    for cand in (ocr_meta.get("candidates") or []):
        if not isinstance(cand, dict):
            continue
        cand_text = str(cand.get("text") or "").strip()
        if cand_text and cand_text not in texts:
            texts.append(cand_text)

    if not texts:
        return

    candidate_sets: list[list[dict[str, Any]]] = []
    for candidate_text in texts:
        try:
            confirmed = extract_pos_receipt_items(
                ocr_text=candidate_text,
                total_amount=expected,
                expense_date=data.get("expense_date"),
                vendor_name=data.get("vendor_name"),
                payment_method=data.get("payment_method"),
            )
            all_candidates = extract_pos_receipt_item_candidates(
                ocr_text=candidate_text,
                total_amount=expected,
                expense_date=data.get("expense_date"),
                vendor_name=data.get("vendor_name"),
                payment_method=data.get("payment_method"),
            )
        except Exception:
            continue
        if confirmed:
            candidate_sets.append(confirmed)
        if all_candidates:
            candidate_sets.append(all_candidates)

    if not candidate_sets:
        return

    best = sorted(candidate_sets, key=lambda items: item_set_score(items, expected))[0]
    current = data.get("items") if isinstance(data.get("items"), list) else []
    best_diff = abs(round(item_sum(best)) - round(expected))
    current_diff = abs(round(item_sum(current)) - round(expected)) if current else 10**12

    if best and (not current or best_diff < current_diff or (best_diff == current_diff and len(best) > len(current))):
        data["items"] = best
        data["detail_items"] = best
        data["item_candidates"] = best
        data["candidate_item_sum"] = item_sum(best)
        if best_diff == 0:
            data["item_rescue_status"] = "CANDIDATE_SUM_MATCHED"
        else:
            data["item_rescue_status"] = "CANDIDATE_REVIEW_REQUIRED"
        apply_global_context_to_detail_items(data)


def decide_skip_llm(data: dict[str, Any], skip_llm: bool | None = None) -> bool:
    return decide_skip_llm_with_reason(data, skip_llm=skip_llm)[0]


def decide_skip_llm_with_reason(data: dict[str, Any], skip_llm: bool | None = None) -> tuple[bool, str]:
    if skip_llm is True:
        return True, "강제 LLM 생략"
    if skip_llm is False:
        return False, "강제 LLM 사용"
    if not settings.LLM_ONLY_WHEN_NEEDED:
        return False, "환경설정상 LLM 항상 사용"

    document_type = str(data.get("document_type") or "").upper()
    if "HANDWRITTEN" in document_type or data.get("handwritten_detected"):
        # 현재 로컬 LLM은 텍스트 LLM이므로 손글씨 이미지 판독 자체를 보정하지 못한다.
        # 인쇄 영역만 규칙 추출하고 수기 영역은 검토로 보내는 것이 속도/정확도상 안전하다.
        return True, "수기 영수증: 텍스트 LLM 생략 후 검토"

    if data.get("needs_review"):
        return False, "규칙 추출 결과에 검토 사유 존재"

    ocr_meta = data.get("ocr_meta") or {}
    input_quality = ocr_meta.get("input_quality") or {}
    quality = to_number(ocr_meta.get("ocr_quality_score") or ocr_meta.get("ocr_confidence"))
    engine_confidence = to_number(ocr_meta.get("engine_confidence"))
    if input_quality.get("very_blurry") or (quality is not None and quality < 0.65):
        return False, "OCR 품질 낮음"
    if engine_confidence is not None and engine_confidence < 0.82:
        return False, "OCR 엔진 신뢰도 낮음"

    for field in settings.LLM_REQUIRED_FIELDS:
        if data.get(field) in (None, "", []):
            return False, f"필수 필드 누락: {field}"

    total = to_number(data.get("claim_amount") or data.get("paid_amount") or data.get("total_amount"))

    # 교통권은 품목표가 아니라 노선/실결제액이 핵심이다.
    if "TRANSPORT" in document_type:
        if data.get("departure_place") and data.get("arrival_place") and total is not None:
            return True, "교통 영수증 규칙 검증 충분"
        return False, "교통 노선/금액 불확실"

    vendor = data.get("vendor_name")
    if not vendor or is_bad_vendor_candidate(vendor):
        return False, "사용처 후보 불확실"
    if re.search(r"매장명|영수증|계산서|상품명|합계|총액", str(vendor)):
        return False, "사용처에 라벨/정산 문구 혼입"

    items = data.get("items") or []
    if not items or total is None:
        return False, "품목 또는 총액 부족"

    hints = ocr_meta.get("field_hints") or {}
    amount_count = len(hints.get("amounts") or [])
    if amount_count >= 3 and len(items) <= 1:
        return False, "OCR 금액 후보 대비 상세 품목 부족"

    amount_sources = data.get("amount_sources") or {}
    if amount_sources.get("total") == "max_money_fallback":
        return False, "총액 라벨 없는 최대금액 fallback"

    sale_total = to_number(data.get("sale_total_amount") or data.get("gross_amount"))
    discount = to_number(data.get("discount_amount")) or 0
    expected = sale_total if sale_total is not None else ((total + discount) if discount else total)
    item_sum = sum(float(to_number(item.get("amount")) or 0) for item in items if isinstance(item, dict))
    if round(item_sum) != round(float(expected)):
        return False, "품목 합계와 기준금액 불일치"

    return True, "규칙 추출 및 합계 검증 통과"


def merge_extraction(rule_data: dict[str, Any], llm_data: dict[str, Any], ocr_text: str, document_type: str | None) -> dict[str, Any]:
    merged = dict(rule_data)

    scalar_fields = [
        "document_type", "expense_date", "vendor_name", "raw_vendor_name", "normalized_vendor_name", "business_number", "payment_method",
        "total_amount", "claim_amount", "paid_amount", "sale_total_amount", "gross_amount", "supply_amount", "tax_amount",
        "transport_type", "departure_place", "arrival_place", "fare_amount", "discount_amount",
    ]
    protected_amount_fields = {"total_amount", "claim_amount", "paid_amount", "sale_total_amount", "gross_amount", "supply_amount", "tax_amount", "fare_amount", "discount_amount"}
    is_transport_rule = str(rule_data.get("document_type") or "").upper() == "TRANSPORT_RECEIPT"
    protected_transport_fields = {"document_type", "transport_type", "departure_place", "arrival_place", "fare_amount", "discount_amount", "total_amount", "payment_method"}
    for field in scalar_fields:
        value = llm_data.get(field)
        current = merged.get(field)

        # 교통 노선/방향은 규칙 파서가 한 번 잡으면 LLM이 뒤집지 못하게 한다.
        if is_transport_rule and field in protected_transport_fields and current not in (None, "", []):
            continue

        # 규칙 기반 금액이 이미 있으면 LLM이 다른 금액으로 덮어쓰지 못하게 한다.
        # LLM은 OCR 표 구조가 깨진 경우 결제금액/공급가액/수량을 혼동하는 사례가 많다.
        if field in protected_amount_fields and current not in (None, "", []):
            cand_num = to_number(value)
            cur_num = to_number(current)
            if cand_num is None or cur_num is None:
                continue
            if abs(cand_num - cur_num) > max(10, cur_num * 0.03):
                continue

        # 사용처는 품목명/정산 라인으로 대체하지 않는다.
        if field in {"vendor_name", "raw_vendor_name", "normalized_vendor_name"}:
            if is_bad_vendor_candidate(value):
                continue
            if current not in (None, "", []) and not is_bad_vendor_candidate(current):
                continue

        if is_better_value(value, current):
            merged[field] = value

    rule_category_code = clean_category_code(merged.get("expense_category_code"))
    rule_category_name = clean_category_name(merged.get("expense_category_name") or merged.get("category"))

    llm_category_code = clean_category_code(llm_data.get("expense_category_code"))
    llm_category_name = clean_category_name(llm_data.get("expense_category_name") or llm_data.get("category"))
    if not llm_category_code and llm_category_name:
        llm_category_code = CATEGORY_NAME_TO_CODE.get(llm_category_name)

    # 카테고리는 품목/상호/금액처럼 OCR 원문 근거가 강한 필드다.
    # LLM이 다른 카테고리를 제시하더라도 규칙 기반 결과가 ETC가 아니면 덮어쓰지 않는다.
    if rule_category_code and rule_category_code != "ETC":
        category_code = rule_category_code
        category_name = CATEGORY_CODE_TO_NAME.get(category_code, rule_category_name or "기타")
        if llm_category_code and llm_category_code != rule_category_code:
            reasons = list(merged.get("review_reasons") or [])
            reasons.append(
                f"LLM 경비 항목({CATEGORY_CODE_TO_NAME.get(llm_category_code, llm_category_code)})이 "
                f"규칙 기반 항목({category_name})과 달라 규칙 기반 값을 유지했습니다."
            )
            merged["review_reasons"] = dedupe(reasons)
            merged["review_reason"] = merged["review_reasons"]
    elif llm_category_code:
        category_code = llm_category_code
        category_name = CATEGORY_CODE_TO_NAME.get(category_code, llm_category_name or "기타")
    else:
        category_code, category_name = classify_expense_category(ocr_text, document_type)

    merged["expense_category_code"] = category_code
    merged["expense_category_name"] = category_name
    merged["category"] = category_name

    llm_items = llm_data.get("items") or llm_data.get("detail_items") or []
    if is_transport_rule:
        llm_items = []
    if isinstance(llm_items, list):
        norm_llm_items = normalize_items(
            llm_items,
            expense_date=merged.get("expense_date"),
            vendor_name=merged.get("vendor_name"),
            category_code=category_code,
            category_name=category_name,
        )
        # LLM이 OCR에 없는 단어(예: THY)나 공급가액/부가세를 품목처럼 만든 경우가 있어
        # 품목 교체는 OCR 원문 근거가 충분할 때만 허용한다.
        if should_replace_items(merged.get("items") or [], norm_llm_items, merged.get("total_amount")) and llm_items_have_evidence(norm_llm_items, ocr_text):
            merged["items"] = norm_llm_items
            merged["detail_items"] = norm_llm_items
        elif norm_llm_items and not llm_items_have_evidence(norm_llm_items, ocr_text):
            reasons = list(merged.get("review_reasons") or [])
            reasons.append("LLM 품목 후보가 OCR 원문 근거와 맞지 않아 규칙 기반 품목을 유지했습니다.")
            merged["review_reasons"] = dedupe(reasons)
            merged["review_reason"] = merged["review_reasons"]


    # 전역 사용처/날짜/분류를 상세 품목에 일관되게 복사한다.
    if merged.get("items"):
        fixed_items = []
        for idx, item in enumerate(merged.get("items") or [], start=1):
            fixed = dict(item)
            fixed.setdefault("line_no", idx)
            fixed["expense_date"] = fixed.get("expense_date") or merged.get("expense_date")
            fixed["vendor_name"] = fixed.get("vendor_name") if not is_bad_vendor_candidate(fixed.get("vendor_name")) else None
            fixed["vendor_name"] = fixed.get("vendor_name") or merged.get("vendor_name")
            fixed["expense_category_code"] = fixed.get("expense_category_code") or merged.get("expense_category_code")
            fixed["expense_category_name"] = fixed.get("expense_category_name") or merged.get("expense_category_name")
            fixed_items.append(fixed)
        merged["items"] = fixed_items
        merged["detail_items"] = fixed_items

    sanitize_final_fields(merged)

    review_reasons = []
    for key in ["review_reasons", "review_reason"]:
        val = rule_data.get(key)
        if isinstance(val, list):
            review_reasons.extend(str(x) for x in val if x)
        elif val:
            review_reasons.append(str(val))
        val = llm_data.get(key)
        if isinstance(val, list):
            review_reasons.extend(str(x) for x in val if x)
        elif val:
            review_reasons.append(str(val))
    merged["review_reasons"] = dedupe(review_reasons)
    merged["review_reason"] = merged["review_reasons"]
    merged["needs_review"] = bool(merged["review_reasons"] or llm_data.get("needs_review") or rule_data.get("needs_review"))
    enforce_transport_rule_values(merged, rule_data)
    return merged




def enforce_transport_rule_values(merged: dict[str, Any], rule_data: dict[str, Any]) -> None:
    """교통 영수증의 노선 방향은 규칙 파서 값을 최우선으로 고정한다.

    LLM은 `횡계 동서울`처럼 좌우 표기된 승차권을 문장으로 재구성하면서
    출발/도착을 뒤집는 경우가 있다. 따라서 규칙 파서가 출발/도착을
    잡은 경우에는 LLM 값으로 덮어쓰지 않는다.
    """
    if str(rule_data.get("document_type") or "").upper() != "TRANSPORT_RECEIPT":
        return
    for field in [
        "document_type", "transport_type", "departure_place", "arrival_place",
        "fare_amount", "discount_amount", "total_amount", "payment_method",
    ]:
        if rule_data.get(field) not in (None, "", []):
            merged[field] = rule_data.get(field)

    if rule_data.get("items"):
        merged["items"] = rule_data.get("items")
        merged["detail_items"] = rule_data.get("items")

    t = merged.get("transport_type") or rule_data.get("transport_type") or "교통"
    dep = merged.get("departure_place")
    arr = merged.get("arrival_place")
    if dep and arr:
        desc = f"{t} {dep} → {arr}"
    else:
        desc = str(rule_data.get("item_description") or rule_data.get("description") or t or "교통비")
    merged["item_description"] = desc
    merged["description"] = desc
    if merged.get("items"):
        first = dict(merged["items"][0])
        first["item_name"] = desc
        first["description"] = desc
        merged["items"] = [first]
        merged["detail_items"] = merged["items"]

def sanitize_final_fields(data: dict[str, Any]) -> None:
    """LLM/후처리 결과의 최종 방어막.

    - 품목명이 사용처로 들어간 경우 제거한다.
    - 대표 적요는 항상 확정된 상세 품목 또는 교통 경로에서 다시 만든다.
    - LLM이 세금/공급가액 라인을 대표 적요로 덮어쓴 결과를 차단한다.
    """
    vendor = data.get("vendor_name")
    items = data.get("items") or []

    if vendor and is_bad_vendor_candidate(vendor):
        data["vendor_name"] = None
        if is_bad_vendor_candidate(data.get("normalized_vendor_name")):
            data["normalized_vendor_name"] = None

    # 사용처가 상세 품목명과 같거나 품목명을 포함하면 제거한다.
    vendor_compact = re.sub(r"\s+", "", str(data.get("vendor_name") or "")).lower()
    if vendor_compact:
        for item in items:
            name = str(item.get("item_name") or item.get("description") or "")
            name_compact = re.sub(r"\s+", "", name).lower()
            if name_compact and (vendor_compact == name_compact or vendor_compact in name_compact or name_compact in vendor_compact):
                data["vendor_name"] = None
                data["normalized_vendor_name"] = None
                break

    # 상세 품목에는 정리된 전역 사용처만 넣는다. 확실하지 않으면 '-'가 아니라 null로 둔다.
    if items:
        fixed_items = []
        for idx, item in enumerate(items, start=1):
            fixed = dict(item)
            fixed["line_no"] = fixed.get("line_no") or idx
            if is_bad_vendor_candidate(fixed.get("vendor_name")):
                fixed["vendor_name"] = None
            fixed["vendor_name"] = fixed.get("vendor_name") or data.get("vendor_name")
            fixed_items.append(fixed)
        data["items"] = fixed_items
        data["detail_items"] = fixed_items

    # 대표 적요는 LLM 값이 아니라 상세 품목/교통 경로 기준으로 재생성한다.
    if data.get("document_type") == "TRANSPORT_RECEIPT" and data.get("departure_place") and data.get("arrival_place"):
        t = data.get("transport_type") or "교통"
        desc = f"{t} {data.get('departure_place')} → {data.get('arrival_place')}"
        data["item_description"] = desc
        data["description"] = desc
        if data.get("items"):
            data["items"][0]["item_name"] = desc
            data["items"][0]["description"] = desc
            data["detail_items"] = data["items"]
    elif data.get("items"):
        first = str(data["items"][0].get("item_name") or data["items"][0].get("description") or "").strip()
        if first:
            desc = first if len(data["items"]) == 1 else f"{first} 외 {len(data['items']) - 1}건"
            data["item_description"] = desc
            data["description"] = desc


def llm_items_have_evidence(items: list[dict[str, Any]], ocr_text: str) -> bool:
    if not items:
        return False
    text_compact = re.sub(r"\s+", "", str(ocr_text or "")).lower()
    if not text_compact:
        return False
    ok = 0
    for item in items:
        name = str(item.get("item_name") or item.get("description") or "").strip()
        name_compact = re.sub(r"\s+", "", name).lower()
        # 짧은 영문 OCR 잡음은 품목명으로 인정하지 않는다.
        if re.fullmatch(r"[a-z]{2,6}", name_compact):
            return False
        if len(name_compact) < 2:
            return False
        # 긴 상품명은 일부만 OCR에 있어도 허용, 짧은 명칭은 전체 포함 필요
        probe = name_compact[:8] if len(name_compact) >= 8 else name_compact
        if probe and probe in text_compact:
            ok += 1
    return ok == len(items)

def is_better_value(candidate: Any, current: Any) -> bool:
    if candidate in (None, "", []):
        return False
    if current in (None, "", []):
        return True
    if isinstance(candidate, (int, float)) and not isinstance(candidate, bool):
        return True
    if isinstance(candidate, str) and isinstance(current, str):
        return len(candidate.strip()) > len(current.strip()) and len(candidate.strip()) <= 60
    return False


def should_replace_items(current_items: list[dict[str, Any]], new_items: list[dict[str, Any]], total_amount: Any) -> bool:
    if not new_items:
        return False
    if not current_items:
        return True
    total = to_number(total_amount)
    current_sum = sum(float(to_number(item.get("amount")) or 0) for item in current_items)
    new_sum = sum(float(to_number(item.get("amount")) or 0) for item in new_items)
    if total is not None:
        current_diff = abs(round(current_sum) - round(total))
        new_diff = abs(round(new_sum) - round(total))
        if new_diff < current_diff:
            return True
        if new_diff == current_diff and len(new_items) > len(current_items):
            return True
    return len(new_items) > len(current_items) and new_sum > 0


def calculate_confidence(data: dict[str, Any]) -> float:
    score = 0.50

    vendor = data.get("vendor_name")
    if vendor and not is_bad_vendor_candidate(vendor):
        score += 0.10
    elif vendor:
        score -= 0.08

    if data.get("expense_date"):
        score += 0.10
    if to_number(data.get("total_amount")) is not None:
        score += 0.12
    if data.get("payment_method"):
        score += 0.04

    items = data.get("items") or []
    candidates = data.get("item_candidates") if isinstance(data.get("item_candidates"), list) else []
    expected_item_total = to_number(data.get("sale_total_amount") or data.get("gross_amount"))
    if expected_item_total is None:
        total = to_number(data.get("total_amount"))
        discount = to_number(data.get("discount_amount"))
        expected_item_total = (total + discount) if total is not None and discount is not None else total

    if items:
        score += 0.07
        if expected_item_total is not None:
            confirmed_sum = sum(float(to_number(item.get("amount")) or 0) for item in items)
            if round(confirmed_sum) == round(expected_item_total):
                score += 0.08
            else:
                score -= 0.12
    elif candidates:
        # 확정 품목은 아니지만 검토용 후보가 남아 있으면 OCR/파싱이 완전 실패한 것은 아니다.
        score += 0.02
        if expected_item_total is not None:
            candidate_sum = sum(float(to_number(item.get("amount")) or 0) for item in candidates if isinstance(item, dict))
            if round(candidate_sum) == round(expected_item_total):
                score += 0.05
            else:
                score -= 0.06
    else:
        score -= 0.10

    ocr_meta = data.get("ocr_meta") or {}
    quality = to_number(ocr_meta.get("ocr_quality_score") or ocr_meta.get("ocr_confidence"))
    if quality is not None:
        if quality < 0.35:
            score -= 0.25
        elif quality < 0.50:
            score -= 0.16
        elif quality < 0.65:
            score -= 0.08
        elif quality > 0.82:
            score += 0.02

    if data.get("llm_used"):
        # LLM은 보정 근거이지 신뢰도 보너스가 아니다. OCR/검증 근거 없으면 오히려 과신 방지.
        score -= 0.01

    if data.get("needs_review"):
        score -= 0.05

    score = apply_confidence_caps(data, score)
    return round(max(0.0, min(0.99, score)), 4)


def apply_confidence_caps(data: dict[str, Any], score: float) -> float:
    ocr_meta = data.get("ocr_meta") or {}
    input_quality = ocr_meta.get("input_quality") or {}
    caps: list[float] = []

    if input_quality.get("very_blurry"):
        caps.append(0.55)
    elif input_quality.get("blurry"):
        caps.append(0.78)
    if input_quality.get("too_dark") or input_quality.get("too_bright"):
        caps.append(0.75)
    if input_quality.get("too_small"):
        caps.append(0.85)
    if input_quality.get("low_contrast"):
        caps.append(0.85)

    hints = ocr_meta.get("field_hints") or {}
    normalized_dates = set()
    for item in hints.get("dates") or []:
        raw = str(item.get("raw") or "")
        m = re.search(r"(20\d{2})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})", raw) or re.search(r"(20\d{2})(\d{2})(\d{2})", raw)
        if m:
            try:
                normalized_dates.add(f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}")
            except Exception:
                pass
    if len(normalized_dates) >= 2:
        caps.append(0.80)

    if "HANDWRITTEN" in str(data.get("document_type") or "").upper() or data.get("handwritten_detected"):
        caps.append(0.55)

    if data.get("items"):
        expected = to_number(data.get("sale_total_amount") or data.get("gross_amount") or data.get("total_amount"))
        if expected is not None:
            s = sum(float(to_number(item.get("amount")) or 0) for item in data.get("items") or [])
            if abs(round(s) - round(expected)) > 0:
                caps.append(0.72)

    hints = (data.get("ocr_meta") or {}).get("field_hints") or {}
    if len(hints.get("amounts") or []) >= 3 and len(data.get("items") or []) <= 1:
        caps.append(0.70)

    if data.get("vendor_name") and is_bad_vendor_candidate(data.get("vendor_name")):
        caps.append(0.70)

    if caps:
        score = min(score, min(caps))
    return apply_strict_confidence_caps(data, score)

def clean_category_code(value: Any) -> str | None:
    text = str(value or "").strip().upper()
    return text if text in CATEGORY_CODE_TO_NAME else None


def clean_category_name(value: Any) -> str | None:
    text = str(value or "").strip()
    return text if text in CATEGORY_NAME_TO_CODE else None


def dedupe(items: list[Any]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        text = str(item or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        result.append(text)
    return result
