import re
from typing import Any

from app.services.rules.rule_context import (
    required_document_fields,
    validation_condition,
    validation_rule_active,
)

from app.services.rules.constants import (
    CATEGORY_CODE_TO_NAME,
    CATEGORY_NAME_TO_CODE,
    ITEM_NOISE_KEYWORDS,
    MANAGEMENT_REVIEW_ACTION,
    PASS_ACTION,
    SUPPLEMENT_ACTION,
    VALID_CATEGORY_CODES,
    VALID_CATEGORY_NAMES,
)


ITEM_SUM_TOLERANCE_RATE = 0.0
ITEM_SUM_TOLERANCE_MIN = 0
# 품목형 영수증은 품목 합계와 총액이 1원이라도 다르면 검토로 보낸다.
# 3% 허용오차를 두면 쇼핑백 100원 누락 같은 실제 오류가 PASS 처리될 수 있다.


def is_empty(value: Any) -> bool:
    return value is None or value == "" or value == []


def add_issue(
    target: list[dict[str, Any]],
    code: str,
    field_key: str,
    field_label: str,
    message: str,
    action: str = MANAGEMENT_REVIEW_ACTION,
    penalty: float = 0.0,
    **extra: Any,
) -> None:
    target.append(
        {
            "code": code,
            "field": field_key,
            "fieldKey": field_key,
            "fieldLabel": field_label,
            "message": message,
            "action": action,
            "penalty": penalty,
            **extra,
        }
    )


def validate_expense_document(
    extracted_data: dict[str, Any],
    ocr_text: str | None = "",
    reference_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    경비 증빙 추출 결과 검증.

    핵심 정책:
    - 필수값 누락은 보완요청 후보 또는 관리팀 검토로 분류한다.
    - 품목별 상세내역을 사용하는 경우 items 합계와 total_amount가 맞지 않으면 PASS 금지.
    - OCR이 표를 완벽히 복원하지 못해 일부 품목만 추출된 경우 NEED_REVIEW로 막는다.
    - 검증은 자동 전송이 아니라 recommendedAction만 반환한다.
    """
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    missing_fields: list[str] = []

    text = (ocr_text or extracted_data.get("raw_text") or "").strip()

    if not text:
        add_issue(
            errors,
            "OCR_TEXT_EMPTY",
            "ocr_text",
            "OCR 원문",
            "OCR 텍스트가 비어 있습니다. 파일 흐림, 손상, 판독 불가 가능성이 있습니다.",
            SUPPLEMENT_ACTION,
            penalty=0.18,
        )

    validate_ocr_quality(extracted_data, errors, warnings)
    validate_required_fields(extracted_data, errors, warnings, missing_fields, reference_context)
    validate_main_amounts(extracted_data, errors, warnings)
    validate_categories(extracted_data, errors, warnings, text)
    validate_items(extracted_data, errors, warnings)
    if validation_rule_active(reference_context, "ITEM_SUM_TOTAL_CHECK", True):
        detail_summary = validate_item_sum(extracted_data, errors, warnings, reference_context)
    else:
        detail_summary = build_detail_item_summary(items=extracted_data.get("items") or [], total_amount=to_number_or_none(extracted_data.get("total_amount")), tolerance_override=None)
    validate_extraction_consistency(extracted_data, errors, warnings, detail_summary)
    if validation_rule_active(reference_context, "LOW_CONFIDENCE", True):
        validate_confidence(extracted_data, warnings, reference_context)

    status = "PASS"
    recommended_action = PASS_ACTION

    if any(issue.get("action") == SUPPLEMENT_ACTION for issue in errors):
        status = "SUPPLEMENT_REQUIRED_CANDIDATE"
        recommended_action = SUPPLEMENT_ACTION
    elif errors or warnings:
        status = "NEED_REVIEW"
        recommended_action = MANAGEMENT_REVIEW_ACTION

    review_messages = []

    for issue in errors + warnings:
        message = issue.get("message")
        if message:
            review_messages.append(message)

    return {
        "status": status,
        "recommendedAction": recommended_action,
        "errors": errors,
        "warnings": warnings,
        "missingFields": sorted(set(missing_fields)),
        "reviewRequired": status != "PASS",
        "reviewMessages": dedupe_list(review_messages),
        "errorCount": len(errors),
        "warningCount": len(warnings),
        "detailItemSummary": detail_summary,
        # llm_service.py 호환용 snake_case
        # warnings만 있어도 자동 저장/PASS는 금지한다.
        "is_valid": status == "PASS",
        "review_required": status != "PASS",
        "review_messages": dedupe_list(review_messages),
        "error_count": len(errors),
        "warning_count": len(warnings),
        "detail_item_summary": detail_summary,
    }


def validate_extracted_expense_document(data: dict[str, Any]) -> dict[str, Any]:
    return validate_expense_document(
        extracted_data=data,
        ocr_text=data.get("raw_text") or "",
        reference_context=data.get("reference_context") if isinstance(data.get("reference_context"), dict) else None,
    )


def validate_ocr_quality(
    extracted_data: dict[str, Any],
    errors: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
) -> None:
    """
    OCR 원문 품질 검증.

    핵심 정책:
    - OCR 품질이 낮으면 자동 PASS를 금지한다.
    - 매우 낮은 품질은 원본 보완요청 후보로 분류한다.
    - LLM이 생략된 경우도 검토 사유로 남긴다.
    """
    ocr_meta = extracted_data.get("ocr_meta") or {}
    source = clean_text_value(extracted_data.get("source")) or ""

    quality = to_number_or_none(
        ocr_meta.get("ocr_quality_score")
        or ocr_meta.get("ocr_confidence")
        or extracted_data.get("ocr_confidence")
    )

    selected_count = ocr_meta.get("selected_count")

    if selected_count == 0:
        add_issue(
            errors,
            "OCR_NO_USABLE_CANDIDATE",
            "ocr_text",
            "OCR 원문",
            "사용 가능한 OCR 후보가 없습니다. 파일 화질 또는 방향을 확인해야 합니다.",
            SUPPLEMENT_ACTION,
            penalty=0.18,
            ocrMeta=ocr_meta,
        )
        return

    if quality is None:
        return

    if quality < 0.35:
        add_issue(
            errors,
            "OCR_QUALITY_TOO_LOW",
            "ocr_text",
            "OCR 원문",
            "OCR 품질 점수가 너무 낮습니다. 원본 재업로드 또는 보완 요청이 필요합니다.",
            SUPPLEMENT_ACTION,
            penalty=0.18,
            currentValue=quality,
            ocrMeta=ocr_meta,
        )
    elif quality < 0.50:
        add_issue(
            warnings,
            "OCR_QUALITY_LOW",
            "ocr_text",
            "OCR 원문",
            "OCR 품질 점수가 낮습니다. 자동 통과하지 않고 원본 확인이 필요합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.10,
            currentValue=quality,
            ocrMeta=ocr_meta,
        )

    input_quality = ocr_meta.get("input_quality") or {}
    supplement = ocr_meta.get("supplement_candidate") or {}
    if supplement.get("is_candidate") or input_quality.get("too_small") or input_quality.get("low_contrast"):
        reasons = supplement.get("reasons") or input_quality.get("issues") or []
        add_issue(
            warnings,
            "OCR_SOURCE_QUALITY_CHECK",
            "ocr_text",
            "OCR 원문",
            "원본 이미지 품질 이슈가 있습니다: " + (", ".join(map(str, reasons)) if reasons else "해상도/대비 확인 필요"),
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.06,
            ocrMeta=ocr_meta,
        )

    if source == "RULE_FALLBACK_LOW_OCR":
        add_issue(
            warnings,
            "LLM_SKIPPED_LOW_OCR",
            "ocr_text",
            "OCR 원문",
            "OCR 품질 기준 미달로 LLM 구조화를 생략했습니다. 관리팀 검토가 필요합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.08,
            currentValue=quality,
        )


def validate_required_fields(
    extracted_data: dict[str, Any],
    errors: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
    missing_fields: list[str],
    reference_context: dict[str, Any] | None = None,
) -> None:
    dynamic_required = required_document_fields(reference_context, extracted_data.get("document_type") or "RECEIPT")
    field_labels = {
        "expense_date": "사용일자",
        "vendor_name": "사용처",
        "total_amount": "지출총액",
        "amount": "금액",
        "expense_category_name": "항목",
    }
    # document_type_fields 기준 필수 필드를 먼저 점검한다.
    # 다만 site/user/department 같은 업로드 배치 헤더 필드는 Backend에서 보강하므로 여기서는 경비 핵심 필드만 강하게 본다.
    core_required = {"expense_date", "vendor_name", "total_amount", "amount", "expense_category_name"}
    for row in dynamic_required:
        field_key = str(row.get("fieldKey") or row.get("field_key") or "")
        if field_key not in core_required:
            continue
        if field_key == "amount":
            value = extracted_data.get("amount") or extracted_data.get("total_amount")
        else:
            value = extracted_data.get(field_key)
        if is_empty(value):
            code = f"REQ_{field_key.upper()}"
            if code not in [issue.get("code") for issue in errors + warnings]:
                add_issue(
                    errors if field_key in {"vendor_name", "total_amount", "amount"} else warnings,
                    code,
                    field_key,
                    field_labels.get(field_key, field_key),
                    f"{field_labels.get(field_key, field_key)} 필수값이 추출되지 않았습니다.",
                    SUPPLEMENT_ACTION if field_key in {"vendor_name", "total_amount", "amount"} else MANAGEMENT_REVIEW_ACTION,
                    penalty=0.10,
                )
            missing_fields.append(field_key)

    if is_empty(extracted_data.get("vendor_name")):
        add_issue(
            errors,
            "REQ_VENDOR_NAME",
            "vendor_name",
            "사용처",
            "사용처가 추출되지 않았습니다. 원본 확인 또는 보완 요청이 필요합니다.",
            SUPPLEMENT_ACTION,
            penalty=0.12,
        )
        missing_fields.append("vendor_name")

    if is_empty(extracted_data.get("expense_date")):
        add_issue(
            warnings,
            "REQ_RECEIPT_DATE",
            "receipt_date",
            "사용일자",
            "사용일자가 추출되지 않았습니다. 원본 확인 또는 관리팀 검토가 필요합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.08,
        )
        missing_fields.append("receipt_date")

    if is_empty(extracted_data.get("total_amount")):
        add_issue(
            errors,
            "REQ_AMOUNT",
            "amount",
            "금액",
            "금액이 추출되지 않았습니다.",
            SUPPLEMENT_ACTION,
            penalty=0.15,
        )
        missing_fields.append("amount")


def validate_main_amounts(
    extracted_data: dict[str, Any],
    errors: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
) -> None:
    total_amount = to_number_or_none(extracted_data.get("total_amount"))
    supply_amount = to_number_or_none(extracted_data.get("supply_amount"))
    tax_amount = to_number_or_none(extracted_data.get("tax_amount"))

    if not is_empty(extracted_data.get("total_amount")):
        if total_amount is None:
            add_issue(
                errors,
                "AMOUNT_NUMBER",
                "amount",
                "금액",
                "금액은 숫자여야 합니다.",
                MANAGEMENT_REVIEW_ACTION,
                penalty=0.15,
            )
        elif total_amount <= 0:
            add_issue(
                errors,
                "AMOUNT_NUMBER",
                "amount",
                "금액",
                "금액은 0보다 커야 합니다.",
                MANAGEMENT_REVIEW_ACTION,
                penalty=0.15,
            )
        elif total_amount >= 100_000_000:
            add_issue(
                warnings,
                "AMOUNT_TOO_LARGE",
                "amount",
                "금액",
                "금액이 비정상적으로 큽니다. 원본 확인이 필요합니다.",
                MANAGEMENT_REVIEW_ACTION,
                penalty=0.08,
                currentValue=total_amount,
            )

    if total_amount is not None and supply_amount is not None and tax_amount is not None:
        expected = supply_amount + tax_amount
        tolerance = max(ITEM_SUM_TOLERANCE_MIN, total_amount * ITEM_SUM_TOLERANCE_RATE)

        if abs(expected - total_amount) > tolerance:
            add_issue(
                warnings,
                "SUPPLY_TAX_TOTAL_MISMATCH",
                "amount",
                "금액",
                "공급가액 + 부가세가 총액과 일치하지 않습니다.",
                MANAGEMENT_REVIEW_ACTION,
                penalty=0.08,
                expectedValue=expected,
                currentValue=total_amount,
            )


CATEGORY_EVIDENCE_KEYWORDS: dict[str, list[str]] = {
    "MEAL": [
        "식당", "음식점", "분식", "한식", "중식", "일식", "양식", "국밥", "찌개", "탕",
        "김치", "두부김치", "전집", "김치전", "모듬전", "파전", "전병", "소주", "맥주",
        "막걸리", "하이볼", "음료", "커피", "라떼", "카페", "베이커리", "빵", "샌드위치",
        "치킨", "피자", "버거", "도시락", "메뉴", "테이블명",
    ],
    "TRANSPORT": [
        "택시", "버스", "지하철", "KTX", "SRT", "철도", "승차권", "운임", "요금",
        "주차", "통행료", "터미널", "출발", "도착", "승차",
    ],
    "LODGING": ["호텔", "모텔", "숙박", "리조트", "게스트하우스", "객실", "체크인", "체크아웃"],
    "FUEL": ["주유", "휘발유", "경유", "LPG", "충전소", "유류", "리터"],
    "COMMUNICATION": ["통신", "휴대폰", "인터넷", "전화요금", "통신요금"],
    "MATERIAL": ["자재", "철물", "건재", "배관", "전선", "케이블", "시멘트", "레미콘", "목재"],
    "SUPPLIES": ["문구", "소모품", "비품", "사무용품", "테이프", "장갑", "마스크", "봉투", "파일", "클립"],
}


def _category_evidence_source(extracted_data: dict[str, Any], ocr_text: str | None) -> str:
    parts = [
        str(ocr_text or ""),
        str(extracted_data.get("raw_text") or ""),
        str(extracted_data.get("vendor_name") or ""),
        str(extracted_data.get("item_description") or extracted_data.get("description") or ""),
    ]
    for item in extracted_data.get("items") or extracted_data.get("detail_items") or []:
        if isinstance(item, dict):
            parts.append(str(item.get("item_name") or item.get("description") or ""))
    return " ".join(parts)


def infer_category_from_evidence(extracted_data: dict[str, Any], ocr_text: str | None) -> tuple[str | None, int, dict[str, int]]:
    source = _category_evidence_source(extracted_data, ocr_text)
    compacted = re.sub(r"\s+", "", source).lower()
    scores: dict[str, int] = {}

    for code, keywords in CATEGORY_EVIDENCE_KEYWORDS.items():
        hit_terms = set()
        for keyword in keywords:
            key = re.sub(r"\s+", "", keyword).lower()
            if len(key) <= 1:
                continue
            if key and key in compacted:
                hit_terms.add(keyword)
        if hit_terms:
            scores[code] = len(hit_terms)

    if not scores:
        return None, 0, {}

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    top_code, top_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0

    # 단일 약한 근거 하나만으로 기존 카테고리를 뒤집지는 않는다.
    if top_score < 2 and not (top_code in {"TRANSPORT", "FUEL", "LODGING"} and top_score >= 1):
        return None, top_score, scores

    # 근거가 비슷하면 충돌로 단정하지 않는다.
    if second_score and (top_score - second_score) < 2:
        return None, top_score, scores

    return top_code, top_score, scores


def validate_categories(
    extracted_data: dict[str, Any],
    errors: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
    ocr_text: str | None = "",
) -> None:
    category_code = extracted_data.get("expense_category_code")
    category_name = extracted_data.get("expense_category_name") or extracted_data.get("category")

    if category_name in CATEGORY_NAME_TO_CODE and not category_code:
        category_code = CATEGORY_NAME_TO_CODE[category_name]

    if category_code not in VALID_CATEGORY_CODES or category_name not in VALID_CATEGORY_NAMES:
        add_issue(
            warnings,
            "CATEGORY_CHECK",
            "expense_item",
            "항목",
            "경비 항목이 기준정보와 일치하지 않습니다. 식비/교통비/숙박비/소모품비/유류비/통신비/자재비/기타 중 하나로 검토하세요.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.08,
            currentValue={
                "expense_category_code": category_code,
                "expense_category_name": category_name,
            },
        )
        return

    evidence_code, evidence_score, evidence_scores = infer_category_from_evidence(extracted_data, ocr_text)
    if evidence_code and category_code and evidence_code != category_code:
        add_issue(
            warnings,
            "CATEGORY_EVIDENCE_CONFLICT",
            "expense_category_name",
            "항목",
            f"OCR/품목 근거는 '{CATEGORY_CODE_TO_NAME.get(evidence_code, evidence_code)}'에 가깝지만 현재 항목은 '{category_name}'입니다. 자동확정하지 말고 경비 항목을 검토하세요.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.15,
            currentValue={
                "expense_category_code": category_code,
                "expense_category_name": category_name,
            },
            suggestedValue={
                "expense_category_code": evidence_code,
                "expense_category_name": CATEGORY_CODE_TO_NAME.get(evidence_code),
            },
            evidenceScore=evidence_score,
            evidenceScores=evidence_scores,
        )


def validate_items(
    extracted_data: dict[str, Any],
    errors: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
) -> None:
    items = extracted_data.get("items") or []
    total_amount = to_number_or_none(extracted_data.get("total_amount"))

    if not isinstance(items, list):
        add_issue(
            errors,
            "ITEMS_INVALID_TYPE",
            "items",
            "세부 품목",
            "세부 품목 목록 형식이 올바르지 않습니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.12,
        )
        return

    if not items:
        add_issue(
            warnings,
            "ITEMS_EMPTY",
            "items",
            "세부 품목",
            "세부 품목이 추출되지 않았습니다. 원본 확인이 필요합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.08,
        )
        return

    for index, item in enumerate(items):
        if not isinstance(item, dict):
            add_issue(
                errors,
                "ITEM_INVALID_TYPE",
                f"items[{index}]",
                "세부 품목",
                f"{index + 1}번 품목 형식이 올바르지 않습니다.",
                MANAGEMENT_REVIEW_ACTION,
                penalty=0.08,
            )
            continue

        validate_item_category(item, index, warnings)
        validate_item_description(item, index, errors, warnings)
        validate_item_amount(item, index, total_amount, errors, warnings)
        validate_item_calculation(item, index, warnings)


def validate_item_category(
    item: dict[str, Any],
    index: int,
    warnings: list[dict[str, Any]],
) -> None:
    item_code = item.get("expense_category_code")
    item_name = item.get("expense_category_name")

    if item_name in CATEGORY_NAME_TO_CODE and not item_code:
        item_code = CATEGORY_NAME_TO_CODE[item_name]

    if item_code not in VALID_CATEGORY_CODES or item_name not in VALID_CATEGORY_NAMES:
        add_issue(
            warnings,
            "CATEGORY_CHECK",
            f"items[{index}].expense_item",
            "항목",
            f"{index + 1}번 품목별 경비 항목이 기준정보와 일치하지 않습니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.05,
            currentValue={
                "expense_category_code": item_code,
                "expense_category_name": item_name,
            },
        )


def validate_item_description(
    item: dict[str, Any],
    index: int,
    errors: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
) -> None:
    description = clean_text_value(item.get("description"))

    if is_empty(description):
        add_issue(
            warnings,
            "ITEM_DESCRIPTION_MISSING",
            f"items[{index}].description",
            "적요",
            f"{index + 1}번 품목명이 누락되었습니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.08,
        )
        return

    if is_invalid_item_description(description, vendor_name=item.get("vendor_name")):
        add_issue(
            warnings,
            "INVALID_ITEM_DESCRIPTION",
            f"items[{index}].description",
            "적요",
            f"{index + 1}번 품목명이 상품명이 아닌 정보로 보입니다: {description}",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.12,
            currentValue=description,
        )


def validate_item_amount(
    item: dict[str, Any],
    index: int,
    total_amount: float | None,
    errors: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
) -> None:
    raw_amount = item.get("amount")
    amount = to_number_or_none(raw_amount)

    if is_empty(raw_amount):
        add_issue(
            warnings,
            "ITEM_AMOUNT_MISSING",
            f"items[{index}].amount",
            "금액",
            f"{index + 1}번 품목 금액이 추출되지 않았습니다. 상세항목 확인이 필요합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.08,
        )
        return

    if amount is None:
        add_issue(
            warnings,
            "ITEM_AMOUNT_PARSE_FAILED",
            f"items[{index}].amount",
            "금액",
            f"{index + 1}번 품목 금액은 숫자여야 합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.08,
            currentValue=raw_amount,
        )
        return

    if amount <= 0:
        add_issue(
            warnings,
            "INVALID_ITEM_AMOUNT",
            f"items[{index}].amount",
            "금액",
            f"{index + 1}번 품목 금액이 0 이하입니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.08,
            currentValue=amount,
        )

    if total_amount is not None and amount > total_amount:
        add_issue(
            warnings,
            "ITEM_AMOUNT_EXCEEDS_TOTAL",
            f"items[{index}].amount",
            "금액",
            f"{index + 1}번 품목 금액이 지출총액보다 큽니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.14,
            currentValue=amount,
            totalAmount=total_amount,
        )


def validate_item_calculation(
    item: dict[str, Any],
    index: int,
    warnings: list[dict[str, Any]],
) -> None:
    quantity = item.get("quantity")
    unit_price = item.get("unit_price")
    item_amount = item.get("amount")

    if quantity is None or unit_price is None or item_amount is None:
        return

    qty = to_number_or_none(quantity)
    price = to_number_or_none(unit_price)
    amount = to_number_or_none(item_amount)

    if qty is None or price is None or amount is None:
        add_issue(
            warnings,
            "ITEM_AMOUNT_PARSE_FAILED",
            f"items[{index}].amount",
            "금액",
            f"{index + 1}번 품목 금액 계산 검증을 수행할 수 없습니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.05,
        )
        return

    expected = qty * price

    if abs(expected - amount) > max(1, amount * 0.03):
        add_issue(
            warnings,
            "AMOUNT_CALCULATION_MISMATCH",
            f"items[{index}].amount",
            "금액",
            "수량 × 단가와 금액이 일치하지 않습니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.08,
            expectedValue=expected,
            currentValue=amount,
            quantity=qty,
            unitPrice=price,
        )


def validate_item_sum(
    extracted_data: dict[str, Any],
    errors: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
    reference_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    items = extracted_data.get("items") or []
    claim_amount = to_number_or_none(extracted_data.get("claim_amount") or extracted_data.get("paid_amount") or extracted_data.get("total_amount"))
    sale_total_amount = to_number_or_none(extracted_data.get("sale_total_amount") or extracted_data.get("gross_amount"))
    discount_amount = to_number_or_none(extracted_data.get("discount_amount")) or 0
    document_type = clean_text_value(extracted_data.get("document_type")) or ""

    expected_item_total = sale_total_amount
    if expected_item_total is None and claim_amount is not None:
        expected_item_total = claim_amount + discount_amount if discount_amount else claim_amount

    tolerance_override = validation_condition(reference_context, "ITEM_SUM_TOTAL_CHECK", "tolerance", None)
    summary = build_detail_item_summary(items=items, total_amount=expected_item_total, tolerance_override=tolerance_override)
    summary["claimAmount"] = claim_amount
    summary["saleTotalAmount"] = sale_total_amount
    summary["discountAmount"] = discount_amount
    summary["expectedItemTotal"] = expected_item_total

    if not isinstance(items, list) or not items or expected_item_total is None:
        return summary

    # 승차권은 보통 문서 1장 = 1건으로 처리하므로, 단일 item이 total과 같으면 통과.
    if document_type == "TRANSPORT_TICKET" and summary.get("matched"):
        return summary

    item_sum = summary.get("itemSum")
    diff = summary.get("diff")
    tolerance = summary.get("tolerance")
    amount_count = summary.get("amountCount") or 0
    item_count = summary.get("itemCount") or 0

    # 결제금액/할인 관계도 별도 확인한다. 예: 품목합계 3,000 - 포인트 100 = 결제 2,900
    if claim_amount is not None and sale_total_amount is not None and discount_amount:
        paid_expected = sale_total_amount - discount_amount
        if abs(paid_expected - claim_amount) > max(1, claim_amount * 0.01):
            add_issue(
                warnings,
                "SALE_DISCOUNT_PAID_MISMATCH",
                "amount",
                "금액",
                f"판매합계 - 할인/포인트가 실제 결제금액과 일치하지 않습니다. 판매합계 {format_won(sale_total_amount)}, 할인 {format_won(discount_amount)}, 결제 {format_won(claim_amount)}입니다.",
                MANAGEMENT_REVIEW_ACTION,
                penalty=0.12,
                **summary,
            )

    if amount_count == 0:
        add_issue(
            warnings,
            "ITEM_SUM_NOT_CALCULABLE",
            "items",
            "세부 품목",
            "품목 금액이 추출되지 않아 상세항목 합계를 검증할 수 없습니다. 원본 확인이 필요합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.12,
            **summary,
        )
        return summary

    if diff is not None and tolerance is not None and diff > tolerance:
        code = "ITEM_SUM_EXCEEDS_TOTAL" if item_sum is not None and item_sum > expected_item_total else "ITEM_SUM_LESS_THAN_TOTAL"
        extra_hint = ""
        if diff in {10, 20, 30, 50, 100, 150, 200}:
            extra_hint = " 봉투/쇼핑백/포장비 등 소액 품목 누락 가능성이 있습니다."
        message = (
            f"상세항목 합계가 기준금액과 일치하지 않습니다. "
            f"기준금액 {format_won(expected_item_total)}, 상세합계 {format_won(item_sum)}, 차이 {format_won(diff)}입니다."
            f"{extra_hint} OCR이 상품 표를 일부만 읽었을 수 있으므로 저장 전 상세항목을 확인하세요."
        )
        add_issue(
            warnings,
            code,
            "items",
            "세부 품목",
            message,
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.18,
            **summary,
        )

    elif item_count > 0 and amount_count < item_count:
        add_issue(
            warnings,
            "ITEM_AMOUNT_PARTIAL_MISSING",
            "items",
            "세부 품목",
            f"일부 품목 금액이 비어 있습니다. 총 {item_count}개 품목 중 {amount_count}개 품목만 금액 검증이 가능합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.10,
            **summary,
        )

    return summary

def validate_extraction_consistency(
    extracted_data: dict[str, Any],
    errors: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
    detail_summary: dict[str, Any],
) -> None:
    """
    confidence 계산 또는 후처리 단계에서 이미 review_reason이 만들어졌다면
    validation_result도 PASS가 되지 않도록 경고로 반영한다.
    """
    review_reason = extracted_data.get("review_reason") or []
    if isinstance(review_reason, str):
        review_reason = [review_reason]

    reasons = [str(reason).strip() for reason in review_reason if str(reason).strip()]
    if not reasons:
        return

    already_item_sum_warning = any(
        issue.get("code") in {"ITEM_SUM_EXCEEDS_TOTAL", "ITEM_SUM_LESS_THAN_TOTAL"}
        for issue in errors + warnings
    )

    # 단순 confidence 문구만 중복 추가하지 않되, 금액/품목/날짜 관련 사유는 validation에도 남긴다.
    important_reasons = [
        reason for reason in reasons
        if any(keyword in reason for keyword in ["금액", "상세", "품목", "합계", "날짜", "사용일자"])
    ]

    if important_reasons and not already_item_sum_warning:
        add_issue(
            warnings,
            "EXTRACTION_REVIEW_REASON",
            "extraction",
            "추출 결과",
            "추출 결과에 검토 사유가 있습니다: " + " / ".join(dedupe_list(important_reasons)),
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.06,
        )


def validate_confidence(
    extracted_data: dict[str, Any],
    warnings: list[dict[str, Any]],
    reference_context: dict[str, Any] | None = None,
) -> None:
    confidence = to_number_or_none(extracted_data.get("confidence"))
    if confidence is None:
        confidence = 0.5

    min_confidence = validation_condition(reference_context, "LOW_CONFIDENCE", "min_confidence", 0.80)
    try:
        min_confidence = float(min_confidence)
    except Exception:
        min_confidence = 0.80

    if confidence < min_confidence:
        add_issue(
            warnings,
            "LOW_CONFIDENCE",
            "confidence",
            "신뢰도",
            "AI 추출 신뢰도가 낮습니다. 관리팀 검토가 필요합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.04,
            confidence=confidence,
        )


def sanitize_items(data: dict[str, Any]) -> dict[str, Any]:
    """
    공통 영수증 기준으로 품목이 아닌 라인을 제거한다.
    실제 상품명은 amount가 없어도 보존해서 관리팀이 수정할 수 있게 한다.
    """
    items = data.get("items") or []
    total_amount = to_number_or_none(data.get("total_amount"))
    root_vendor = clean_text_value(data.get("vendor_name"))

    if not isinstance(items, list):
        data["items"] = []
        return data

    sanitized: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue

        description = clean_text_value(item.get("description") or item.get("item_name") or item.get("name"))
        vendor_name = clean_text_value(item.get("vendor_name")) or root_vendor
        amount = to_number_or_none(item.get("amount"))

        if not description:
            continue

        if is_invalid_item_description(description, vendor_name=vendor_name):
            continue

        cleaned_item = dict(item)
        cleaned_item["description"] = description
        cleaned_item["vendor_name"] = vendor_name

        if amount is None or amount <= 0:
            cleaned_item["amount"] = None
        elif total_amount is not None and amount > total_amount:
            cleaned_item["amount"] = None
        else:
            cleaned_item["amount"] = amount

        quantity = to_number_or_none(cleaned_item.get("quantity"))
        unit_price = to_number_or_none(cleaned_item.get("unit_price"))

        if quantity is not None:
            cleaned_item["quantity"] = quantity
        if unit_price is not None:
            cleaned_item["unit_price"] = unit_price

        sanitized.append(cleaned_item)

    data["items"] = remove_duplicate_items(sanitized)
    return data


def apply_validation_penalty(
    data: dict[str, Any],
    validation_result: dict[str, Any],
) -> dict[str, Any]:
    confidence = to_number_or_none(data.get("confidence"))

    if confidence is None:
        confidence = 0.0

    errors = validation_result.get("errors") or []
    warnings = validation_result.get("warnings") or []

    total_penalty = 0.0

    for error in errors:
        total_penalty += to_number_or_none(error.get("penalty")) or 0.08

    for warning in warnings:
        total_penalty += to_number_or_none(warning.get("penalty")) or 0.04

    total_penalty = min(total_penalty, 0.75)
    adjusted = max(0.0, min(1.0, confidence - total_penalty))

    data["confidence_before_validation"] = round(confidence, 4)
    data["confidence_before_validation_percent"] = round(confidence * 100)
    data["validation_penalty"] = round(total_penalty, 4)
    data["confidence"] = round(adjusted, 4)
    data["confidence_percent"] = round(adjusted * 100)
    data["validation_result"] = validation_result
    data["detail_item_summary"] = validation_result.get("detail_item_summary") or validation_result.get("detailItemSummary")
    data["detailItemSummary"] = data["detail_item_summary"]

    existing_reasons = data.get("review_reason") or []
    if isinstance(existing_reasons, str):
        existing_reasons = [existing_reasons]

    validation_reasons = (
        validation_result.get("reviewMessages")
        or validation_result.get("review_messages")
        or []
    )

    data["review_reason"] = dedupe_list(existing_reasons + validation_reasons)
    data["needs_review"] = (
        adjusted < 0.82
        or validation_result.get("reviewRequired", False)
        or validation_result.get("review_required", False)
        or validation_result.get("status") != "PASS"
    )

    notes = data.get("notes") or []
    if isinstance(notes, str):
        notes = [notes]

    if validation_result.get("errorCount", 0) > 0 or validation_result.get("error_count", 0) > 0:
        notes.append("검증 오류가 있어 신뢰도를 낮췄습니다.")
    elif validation_result.get("warningCount", 0) > 0 or validation_result.get("warning_count", 0) > 0:
        notes.append("검증 경고가 있어 검토가 필요합니다. 저장 전 상세항목을 확인하세요.")

    data["notes"] = dedupe_list(notes)
    return data


def build_detail_item_summary(items: Any, total_amount: float | None, tolerance_override: Any = None) -> dict[str, Any]:
    if not isinstance(items, list):
        items = []

    valid_items = []
    amount_items = []

    for item in items:
        if not isinstance(item, dict):
            continue

        description = clean_text_value(item.get("description"))
        if not description:
            continue

        valid_items.append(item)
        amount = to_number_or_none(item.get("amount"))
        if amount is not None and amount > 0:
            amount_items.append(amount)

    item_sum = sum(amount_items) if amount_items else 0.0
    diff = None
    tolerance = None
    matched = False

    if total_amount is not None:
        diff = abs(total_amount - item_sum)
        if tolerance_override is not None:
            try:
                tolerance = float(tolerance_override)
            except Exception:
                tolerance = max(ITEM_SUM_TOLERANCE_MIN, total_amount * ITEM_SUM_TOLERANCE_RATE)
        else:
            tolerance = max(ITEM_SUM_TOLERANCE_MIN, total_amount * ITEM_SUM_TOLERANCE_RATE)
        matched = diff <= tolerance

    return {
        "totalAmount": total_amount,
        "itemSum": item_sum,
        "diff": diff,
        "tolerance": tolerance,
        "matched": matched,
        "itemCount": len(valid_items),
        "amountCount": len(amount_items),
        "missingAmountCount": max(0, len(valid_items) - len(amount_items)),
    }


def is_invalid_item_description(description: str | None, vendor_name: str | None = None) -> bool:
    if not description:
        return True

    value = clean_text_value(description) or ""
    compact = re.sub(r"\s+", "", value).lower()

    if len(value) < 2 or len(value) > 100:
        return True

    vendor = clean_text_value(vendor_name)
    if vendor:
        vendor_compact = re.sub(r"\s+", "", vendor).lower()
        if compact == vendor_compact:
            return True
        if len(vendor_compact) >= 4 and (compact in vendor_compact or vendor_compact in compact):
            return True

    for keyword in ITEM_NOISE_KEYWORDS:
        if not keyword:
            continue
        key = str(keyword).strip()
        if key and (key in value or key.replace(" ", "").lower() in compact):
            return True

    # 사업자/회사/지점/주소/연락처/승인번호성 라인 공통 제외
    patterns = [
        r"\(주\)|㈜|주식회사|유한회사|합자회사|합명회사",
        r"사업자\s*번호|사업자번호|대표자?|가맹점|점포|지점|매장",
        r"\d{2,4}-\d{3,4}-\d{4}",
        r"[가-힣A-Za-z0-9]+로\s*\d+",
        r"[가-힣A-Za-z0-9]+길\s*\d+",
        r"번길\s*\d*",
        r"\d+\s*층|\d+\s*호",
        r"\d+\s*\(?[가-힣A-Za-z0-9]+동\)?",
        r"시\s*[가-힣A-Za-z0-9]+구",
        r"군\s*[가-힣A-Za-z0-9]+읍",
        r"\[[0-9A-Za-z\-]{3,30}\]",
    ]

    if any(re.search(pattern, value, flags=re.IGNORECASE) for pattern in patterns):
        return True

    if is_receipt_code_line(value):
        return True
    if is_barcode_like(value):
        return True
    if is_mostly_number(value):
        return True
    if re.fullmatch(r"[A-Za-z0-9]{1,6}", value):
        return True

    digit_count = len(re.findall(r"\d", value))
    alpha_ko_count = len(re.findall(r"[가-힣A-Za-z]", value))
    if digit_count >= 4 and digit_count > alpha_ko_count * 2:
        return True

    if not has_korean(value) and len(re.sub(r"[^A-Za-z]", "", value)) < 3:
        return True

    return False


def remove_duplicate_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()

    for item in items:
        description = clean_text_value(item.get("description")) or ""
        amount = to_number_or_none(item.get("amount"))
        amount_key = int(amount) if amount is not None else -1
        key = (normalize_for_compare(description), amount_key)

        if key in seen:
            continue

        seen.add(key)
        result.append(item)

    return result


def to_number_or_none(value: Any) -> float | None:
    if value is None or value == "":
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        cleaned = (
            value.replace(",", "")
            .replace("원", "")
            .replace("₩", "")
            .replace(" ", "")
            .strip()
        )

        # OCR에서 51.700처럼 천 단위 구분점이 들어온 경우
        if re.fullmatch(r"\d{1,3}\.\d{3}", cleaned):
            cleaned = cleaned.replace(".", "")

        try:
            return float(cleaned)
        except ValueError:
            return None

    return None


def clean_text_value(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "undefined", "nan"}:
        return None

    return re.sub(r"\s+", " ", text)


def has_korean(text: str) -> bool:
    return bool(re.search(r"[가-힣]", text or ""))


def is_receipt_code_line(line: str) -> bool:
    value = str(line or "").strip()

    if re.fullmatch(r"\[[0-9A-Za-z\-]{3,30}\]", value):
        return True
    if re.fullmatch(r"\*?[0-9]{8,30}\*?", value):
        return True
    if re.fullmatch(r"[0-9A-Za-z\-*#]{8,35}", value) and not has_korean(value):
        return True

    return False


def is_barcode_like(text: str | None) -> bool:
    if not text:
        return False

    value = str(text).strip()
    digits = re.sub(r"\D", "", value)

    return len(digits) >= 10 and len(digits) >= len(value.replace(" ", "")) * 0.7


def is_mostly_number(text: str | None) -> bool:
    if not text:
        return False

    value = str(text).strip()
    if not value:
        return False

    digits = len(re.findall(r"\d", value))
    letters = len(re.findall(r"[가-힣A-Za-z]", value))

    return digits >= 3 and digits > letters * 2


def normalize_for_compare(value: str) -> str:
    text = str(value or "").lower()
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"[^0-9a-z가-힣]", "", text)
    return text


def dedupe_list(values: list[Any]) -> list[Any]:
    result = []
    seen = set()

    for value in values:
        key = str(value)
        if key in seen:
            continue
        seen.add(key)
        result.append(value)

    return result


def format_won(value: Any) -> str:
    number = to_number_or_none(value)
    if number is None:
        return "확인 필요"
    return f"{number:,.0f}원"

# =============================================================================
# V9 STRICT VALIDATION PATCH
# Conservative NORMAL policy: anything uncertain goes to NEED_REVIEW.
# =============================================================================

def _v9_num(value: Any) -> float | None:
    try:
        return to_number_or_none(value)  # type: ignore[name-defined]
    except Exception:
        if value is None or value == "":
            return None
        try:
            text = str(value).replace(",", "").replace("원", "")
            text = re.sub(r"[^0-9.\-]", "", text)
            return float(text) if text else None
        except Exception:
            return None


def _v9_clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _v9_issue(code: str, field: str, label: str, message: str, severity: str = "WARNING", action: str = MANAGEMENT_REVIEW_ACTION, **extra: Any) -> dict[str, Any]:
    return {
        "code": code,
        "field": field,
        "fieldKey": field,
        "fieldLabel": label,
        "message": message,
        "severity": severity,
        "action": action,
        **extra,
    }


def _v9_amount_after_label(text: str, labels: list[str]) -> float | None:
    lines = [_v9_clean(x) for x in str(text or "").splitlines() if _v9_clean(x)]
    for i, line in enumerate(lines):
        c = re.sub(r"\s+", "", line)
        if not any(label in c for label in labels):
            continue
        values = re.findall(r"(?<!\d)(\d{1,3}(?:[,\.]\d{3})+|\d{3,7})\s*원?", line)
        if values:
            return _v9_num(values[-1])
        for nxt in lines[i + 1:i + 4]:
            if any(label in re.sub(r"\s+", "", nxt) for label in ["영수액", "운임요금", "할인금액", "합계", "부가세"]):
                if not re.search(r"\d", nxt):
                    break
            values = re.findall(r"(?<!\d)(\d{1,3}(?:[,\.]\d{3})+|\d{3,7})\s*원?", nxt)
            if values:
                return _v9_num(values[0])
    return None


_VENDOR_DOCUMENT_TITLE_BAD_KEYWORDS = [
    "중간계산", "중간계산서", "숲간계산서", "계산서", "간이영수증", "카드영수증", "현금영수증",
    "카드매출전표", "신용승인", "승인전표", "거래명세서", "거래명세표", "주문서", "접수증",
    "판매영수증", "매출영수증", "영수증서",
]


def _v9_vendor_compact(value: Any) -> str:
    return re.sub(r"[\s,._\-:;|/\\()\[\]{}'\"<>【】·`]+", "", str(value or ""))


def _v9_is_weak_vendor(value: Any) -> bool:
    text = _v9_clean(value)
    c = _v9_vendor_compact(text)
    if not c:
        return True
    known_short_vendors = {"다이소", "쿠팡", "이마트", "홈플러스", "코레일"}
    if c in known_short_vendors:
        return False

    title_compact = [ _v9_vendor_compact(keyword) for keyword in _VENDOR_DOCUMENT_TITLE_BAD_KEYWORDS if _v9_vendor_compact(keyword) ]
    for key in title_compact:
        if c == key:
            return True
        if c.startswith(key) and len(c) <= len(key) + 4:
            return True
        if key in c:
            return True

    if len(c) <= 3:
        return True
    bad = [
        "영수증", "승차권", "상품명", "제품명", "품명", "금액", "수량", "단가", "주소", "전화",
        "대표", "이벤트", "응모", "카드번호", "승인번호", "사업자", "사업자번호", "사업자등록번호",
        "합계", "총액", "결제금액", "받을금액", "받은금액", "부가세", "공급가액", "테이블", "주문자", "고객수",
    ]
    if any(b in c for b in bad):
        return True
    if re.search(r"\d{2,4}-\d{3,4}-\d{4}|\d{3}-?\d{2}-?\d{5}", c):
        return True
    # Broken rail OCR should not pass as confirmed vendor.
    if "RAIL" in c.upper() or "철도공사" in c:
        if not ("KORAIL" in c.upper() or "한국철도공사" in c):
            return True
    return False



def _v10_text_quality(text: str) -> dict[str, Any]:
    lines = [_v9_clean(x) for x in str(text or "").splitlines() if _v9_clean(x)]
    if not lines:
        return {
            "score": 0.0,
            "lineCount": 0,
            "shortLineRatio": 1.0,
            "amountCount": 0,
            "dateCount": 0,
            "keywordCount": 0,
        }

    short_or_noise = 0
    for line in lines:
        compact = re.sub(r"\s+", "", line)
        letters = len(re.findall(r"[가-힣A-Za-z]", compact))
        digits = len(re.findall(r"\d", compact))
        # 금액/날짜가 아닌 한두 글자, 또는 숫자/기호 위주 라인은 OCR 레이아웃 붕괴 가능성이 높다.
        if len(compact) <= 2:
            short_or_noise += 1
        elif digits >= 4 and letters <= 1 and not re.search(r"[,\.]\d{3}|원|합계|금액|결제|판매|영수|운임", compact):
            short_or_noise += 1
        elif letters == 0 and digits == 0:
            short_or_noise += 1

    text_all = "\n".join(lines)
    amount_count = len(re.findall(r"(?<!\d)(\d{1,3}(?:[,\.]\d{3})+|\d{4,7})\s*원?(?!\d)", text_all))
    date_count = len(re.findall(r"20\d{2}[-./년\s]*\d{1,2}[-./월\s]*\d{1,2}", text_all))
    keyword_count = sum(1 for k in ["영수", "판매", "상품", "수량", "단가", "금액", "부가세", "공급", "승인", "카드", "테이블", "사업자"] if k in text_all)
    korean_count = len(re.findall(r"[가-힣]", text_all))
    digit_count = len(re.findall(r"\d", text_all))

    short_ratio = short_or_noise / max(1, len(lines))
    score = 0.45
    if amount_count >= 2:
        score += 0.15
    if date_count >= 1:
        score += 0.12
    if keyword_count >= 3:
        score += 0.12
    if korean_count >= 20:
        score += 0.08
    if digit_count >= 20:
        score += 0.04
    if short_ratio > 0.45:
        score -= 0.20
    elif short_ratio > 0.30:
        score -= 0.10

    return {
        "score": round(max(0.0, min(1.0, score)), 4),
        "lineCount": len(lines),
        "shortLineRatio": round(short_ratio, 4),
        "amountCount": amount_count,
        "dateCount": date_count,
        "keywordCount": keyword_count,
        "koreanCount": korean_count,
        "digitCount": digit_count,
    }


def _v10_ocr_review_issues(data: dict[str, Any], text: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    ocr_meta = data.get("ocr_meta") or {}
    metrics = ocr_meta.get("metrics") or {}

    engine_confidence = _v9_num(
        ocr_meta.get("engine_confidence")
        or metrics.get("engine_confidence")
        or data.get("engine_confidence")
    )
    quality_score = _v9_num(
        ocr_meta.get("ocr_quality_score")
        or ocr_meta.get("ocr_confidence")
        or data.get("ocr_confidence")
    )

    if engine_confidence is not None and engine_confidence < 0.78:
        result.append(_v9_issue(
            "OCR_ENGINE_CONFIDENCE_LOW",
            "ocr_text",
            "OCR 원문",
            f"OCR 엔진 신뢰도가 낮습니다({engine_confidence:.3f}). 이미지 품질 점수가 높아도 글자 인식 결과는 검토해야 합니다.",
            currentValue=engine_confidence,
            ocrQualityScore=quality_score,
        ))

    text_quality = _v10_text_quality(text)
    if text_quality.get("score", 1.0) < 0.62:
        result.append(_v9_issue(
            "OCR_TEXT_SEMANTIC_QUALITY_LOW",
            "ocr_text",
            "OCR 원문",
            "OCR 텍스트에 짧은 조각/숫자열/깨진 단어가 많아 구조화 결과를 자동 통과할 수 없습니다.",
            currentValue=text_quality,
        ))

    hints = ocr_meta.get("field_hints") or {}
    vendor_candidates = hints.get("vendor_candidates") or []
    if vendor_candidates and not data.get("vendor_name"):
        result.append(_v9_issue(
            "VENDOR_CANDIDATE_NOT_CONFIRMED",
            "vendor_name",
            "사용처",
            "OCR에서 사용처 후보는 발견됐지만 확정 가능한 상호로 보기 어렵습니다.",
            currentValue=vendor_candidates[:5],
        ))

    # 품질 점수와 엔진 신뢰도의 차이가 큰 경우: 원본 사진은 선명하지만 OCR 텍스트가 틀어진 상황.
    if quality_score is not None and engine_confidence is not None and quality_score >= 0.90 and engine_confidence < 0.80:
        result.append(_v9_issue(
            "OCR_IMAGE_TEXT_CONFIDENCE_GAP",
            "ocr_text",
            "OCR 원문",
            "이미지 품질 점수는 높지만 OCR 엔진 신뢰도가 낮습니다. 회전/표 구조/글자 순서 복원 문제 가능성이 있습니다.",
            currentValue={"ocrQualityScore": quality_score, "engineConfidence": engine_confidence},
        ))

    return result

def validate_expense_document(  # type: ignore[override]
    extracted_data: dict[str, Any],
    ocr_text: str | None = "",
    reference_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    missing_fields: list[str] = []

    data = extracted_data or {}
    text = str(ocr_text or data.get("raw_text") or "")
    document_type = str(data.get("document_type") or "RECEIPT")

    if "HANDWRITTEN" in document_type.upper() or data.get("handwritten_detected"):
        warnings.append(_v9_issue(
            "HANDWRITTEN_RECEIPT_REVIEW",
            "document_type",
            "문서유형",
            "수기/손글씨 영수증은 자동 확정하지 않고 관리팀 검토가 필요합니다.",
            currentValue=document_type,
        ))

    if not text.strip():
        errors.append(_v9_issue("OCR_TEXT_EMPTY", "ocr_text", "OCR 원문", "OCR 텍스트가 비어 있습니다.", "ERROR", SUPPLEMENT_ACTION))

    total = _v9_num(data.get("claim_amount") or data.get("paid_amount") or data.get("total_amount"))
    sale_total = _v9_num(data.get("sale_total_amount") or data.get("gross_amount"))
    discount = _v9_num(data.get("discount_amount")) or 0
    expected_item_total = sale_total if sale_total is not None else ((total + discount) if total is not None and discount else total)
    if not data.get("expense_date"):
        warnings.append(_v9_issue("REQ_EXPENSE_DATE", "expense_date", "사용일자", "사용일자가 추출되지 않았습니다."))
        missing_fields.append("expense_date")
    if not data.get("vendor_name"):
        warnings.append(_v9_issue("REQ_VENDOR_NAME", "vendor_name", "사용처", "사용처가 확정되지 않았습니다. 원본 확인이 필요합니다."))
        missing_fields.append("vendor_name")
    elif _v9_is_weak_vendor(data.get("vendor_name")):
        warnings.append(_v9_issue("VENDOR_NAME_WEAK_OCR", "vendor_name", "사용처", "사용처가 OCR 노이즈이거나 깨진 상호 후보입니다. 원본 확인이 필요합니다.", currentValue=data.get("vendor_name")))
    if total is None or total <= 0:
        errors.append(_v9_issue("REQ_TOTAL_AMOUNT", "total_amount", "지출총액", "지출총액이 추출되지 않았거나 올바르지 않습니다.", "ERROR", SUPPLEMENT_ACTION, currentValue=data.get("total_amount")))
        missing_fields.append("total_amount")

    # OCR quality metadata
    # 단순 저해상도/저대비 자체만으로 자동통과를 막지 않는다.
    # OCR 텍스트 품질이나 엔진 신뢰도까지 낮을 때만 검토로 보낸다.
    ocr_meta = data.get("ocr_meta") or {}
    input_quality = ocr_meta.get("input_quality") or {}
    issues = input_quality.get("issues") or []
    severe_issues = [x for x in issues if str(x) in {"심한 흐림", "매우 흐림", "너무 어두움", "너무 밝음", "파일 판독 실패"}]
    minor_issues = [x for x in issues if x not in severe_issues]
    engine_confidence = _v9_num(ocr_meta.get("engine_confidence") or ocr_meta.get("ocr_confidence"))
    text_quality = _v10_text_quality(text)
    if severe_issues or (minor_issues and ((engine_confidence is not None and engine_confidence < 0.80) or text_quality.get("score", 0) < 0.62)):
        warnings.append(_v9_issue("OCR_INPUT_QUALITY_REVIEW", "ocr_text", "OCR 원문", "이미지 품질 이슈가 있습니다: " + ", ".join(map(str, issues)), currentValue=issues))

    # OCR semantic quality: image quality score alone must not be treated as text extraction accuracy.
    warnings.extend(_v10_ocr_review_issues(data, text))

    # Explicit review flags from parser/LLM.
    parser_reasons = data.get("review_reason") or data.get("review_reasons") or []
    if isinstance(parser_reasons, str):
        parser_reasons = [parser_reasons]
    for reason in parser_reasons:
        if reason:
            warnings.append(_v9_issue("PARSER_REVIEW_REQUIRED", "extracted_data", "추출결과", str(reason)))

    # 카테고리 근거 충돌 방어: 기준정보에 존재하는 코드라도 OCR/품목 근거와 반대면 자동 PASS 금지.
    current_category_code = str(data.get("expense_category_code") or "").upper().strip()
    current_category_name = str(data.get("expense_category_name") or data.get("category") or "").strip()
    if not current_category_code and current_category_name in CATEGORY_NAME_TO_CODE:
        current_category_code = CATEGORY_NAME_TO_CODE[current_category_name]
    evidence_code, evidence_score, evidence_scores = infer_category_from_evidence(data, text)
    if evidence_code and current_category_code and evidence_code != current_category_code:
        warnings.append(_v9_issue(
            "CATEGORY_EVIDENCE_CONFLICT",
            "expense_category_name",
            "항목",
            f"OCR/품목 근거는 '{CATEGORY_CODE_TO_NAME.get(evidence_code, evidence_code)}'에 가깝지만 현재 항목은 '{current_category_name or CATEGORY_CODE_TO_NAME.get(current_category_code, current_category_code)}'입니다. 자동확정하지 말고 경비 항목을 검토하세요.",
            currentValue={
                "expense_category_code": current_category_code,
                "expense_category_name": current_category_name,
            },
            suggestedValue={
                "expense_category_code": evidence_code,
                "expense_category_name": CATEGORY_CODE_TO_NAME.get(evidence_code),
            },
            evidenceScore=evidence_score,
            evidenceScores=evidence_scores,
            penalty=0.15,
        ))

    items = data.get("items") or []
    if not isinstance(items, list):
        errors.append(_v9_issue("ITEMS_INVALID_TYPE", "items", "세부 품목", "세부 품목 형식이 올바르지 않습니다.", "ERROR"))
        items = []

    item_sum = 0.0
    amount_count = 0
    missing_amount_count = 0
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            errors.append(_v9_issue("ITEM_INVALID_TYPE", f"items[{idx}]", "세부 품목", f"{idx + 1}번 품목 형식이 올바르지 않습니다.", "ERROR"))
            continue
        name = item.get("item_name") or item.get("description") or item.get("item_description")
        amount = _v9_num(item.get("amount"))
        if amount is None:
            missing_amount_count += 1
        else:
            amount_count += 1
            item_sum += amount
        if not name:
            warnings.append(_v9_issue("ITEM_NAME_EMPTY", f"items[{idx}].item_name", "품목명", f"{idx + 1}번 품목명이 비어 있습니다."))
        else:
            name_text = _v9_clean(name)
            non_item_keywords = ["합계", "총액", "부가세", "공급가액", "승인금액", "결제금액", "카드번호", "승인번호", "포인트", "거스름돈", "이벤트", "응모"]
            if any(k in name_text for k in non_item_keywords):
                errors.append(_v9_issue("ITEM_NON_ITEM_KEYWORD", f"items[{idx}].item_name", "품목명", "정산/결제/홍보 문구가 품목에 들어갔습니다.", "ERROR", currentValue=name_text))

    if document_type == "ITEM_RECEIPT" and not items:
        warnings.append(_v9_issue("ITEMS_EMPTY", "items", "세부 품목", "품목형 영수증인데 세부 품목이 추출되지 않았습니다."))

    if expected_item_total is not None and items:
        diff = abs(item_sum - expected_item_total)
        if diff > 0:
            hint = ""
            if diff in {10, 20, 30, 50, 100, 150, 200}:
                hint = " 봉투/쇼핑백/포장비 등 소액 품목 누락 가능성이 있습니다."
            warnings.append(_v9_issue(
                "ITEM_SUM_TOTAL_MISMATCH",
                "amount",
                "금액",
                f"상세 품목 합계({item_sum:,.0f})와 기준금액({expected_item_total:,.0f})이 일치하지 않습니다.{hint}",
                currentValue=item_sum,
                expectedValue=expected_item_total,
            ))

    if total is not None and sale_total is not None and discount:
        paid_expected = sale_total - discount
        if abs(paid_expected - total) > max(1, total * 0.01):
            warnings.append(_v9_issue(
                "SALE_DISCOUNT_PAID_MISMATCH",
                "amount",
                "금액",
                f"판매합계({sale_total:,.0f}) - 할인/포인트({discount:,.0f})이 결제금액({total:,.0f})과 일치하지 않습니다.",
                currentValue=total,
                expectedValue=paid_expected,
            ))

    if document_type == "TRANSPORT_RECEIPT":
        receipt_amount = _v9_amount_after_label(text, ["영수액", "영수금액", "결제금액", "승인금액", "받은금액", "받을금액"])
        fare_amount = _v9_amount_after_label(text, ["운임요금", "운임", "정상운임", "기준운임"])
        discount_amount = _v9_amount_after_label(text, ["할인금액", "할인"])
        if receipt_amount is not None and total is not None and abs(receipt_amount - total) > 0:
            errors.append(_v9_issue("TRANSPORT_RECEIPT_AMOUNT_MISMATCH", "total_amount", "지출총액", f"교통 영수증의 영수액({receipt_amount:,.0f})과 추출 총액({total:,.0f})이 다릅니다.", "ERROR", currentValue=total, expectedValue=receipt_amount))
        if fare_amount is not None and discount_amount is not None and total is not None and abs(total - fare_amount) == 0:
            errors.append(_v9_issue("TRANSPORT_FARE_USED_AS_TOTAL", "total_amount", "지출총액", "운임요금을 실제 지출총액으로 사용했습니다. 영수액/결제금액을 확인해야 합니다.", "ERROR", currentValue=total))
        if discount_amount is not None and total is not None and abs(total - discount_amount) == 0:
            errors.append(_v9_issue("TRANSPORT_DISCOUNT_USED_AS_TOTAL", "total_amount", "지출총액", "할인금액을 실제 지출총액으로 사용했습니다.", "ERROR", currentValue=total))
        if not data.get("departure_place") or not data.get("arrival_place"):
            warnings.append(_v9_issue("TRANSPORT_ROUTE_UNCERTAIN", "route", "출발/도착", "교통 영수증의 출발지/도착지가 불확실합니다."))

    detail_summary = {
        "totalAmount": expected_item_total,
        "claimAmount": total,
        "saleTotalAmount": sale_total,
        "discountAmount": discount,
        "expectedItemTotal": expected_item_total,
        "itemSum": item_sum,
        "diff": abs(item_sum - expected_item_total) if expected_item_total is not None else None,
        "tolerance": 0,
        "matched": bool(expected_item_total is not None and abs(item_sum - expected_item_total) == 0),
        "itemCount": len(items),
        "amountCount": amount_count,
        "missingAmountCount": missing_amount_count,
    }

    status = "PASS"
    recommended_action = PASS_ACTION
    if any(issue.get("action") == SUPPLEMENT_ACTION for issue in errors):
        status = "SUPPLEMENT_REQUIRED_CANDIDATE"
        recommended_action = SUPPLEMENT_ACTION
    elif errors or warnings:
        status = "NEED_REVIEW"
        recommended_action = MANAGEMENT_REVIEW_ACTION

    review_messages = []
    for issue in errors + warnings:
        if issue.get("message"):
            review_messages.append(issue["message"])
    try:
        review_messages = dedupe_list(review_messages)  # type: ignore[name-defined]
    except Exception:
        review_messages = list(dict.fromkeys(review_messages))

    return {
        "status": status,
        "recommendedAction": recommended_action,
        "errors": errors,
        "warnings": warnings,
        "missingFields": sorted(set(missing_fields)),
        "reviewRequired": status != "PASS",
        "reviewMessages": review_messages,
        "errorCount": len(errors),
        "warningCount": len(warnings),
        "detailItemSummary": detail_summary,
        "is_valid": status == "PASS",
        "review_required": status != "PASS",
        "review_messages": review_messages,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "detail_item_summary": detail_summary,
    }


def validate_extracted_expense_document(data: dict[str, Any]) -> dict[str, Any]:  # type: ignore[override]
    return validate_expense_document(data, data.get("raw_text") or "", reference_context=data.get("reference_context") if isinstance(data.get("reference_context"), dict) else None)

# -----------------------------------------------------------------------------
# Strict conservative validation overlay (2026-06-15)
# 기존 validate_expense_document 결과 위에 치명 오류/신뢰도 제한 사유를 추가한다.
# 목적: 오답을 NORMAL처럼 보이게 하지 않고, 상세 품목/금액 근거가 약하면 반드시 검토로 보낸다.
# -----------------------------------------------------------------------------
try:
    from app.services.guards.strict_extraction_guard import (
        apply_strict_extraction_guards as _strict_apply_extraction_guards,
        compact as _strict_compact,
        is_handwritten_form_text as _strict_is_handwritten_form_text,
        to_number as _strict_to_number,
    )
except Exception:  # pragma: no cover
    _strict_apply_extraction_guards = None
    _strict_compact = lambda value: re.sub(r"\s+", "", str(value or ""))
    _strict_is_handwritten_form_text = lambda text: False
    _strict_to_number = lambda value: None

_PRE_STRICT_VALIDATE_EXPENSE_DOCUMENT = validate_expense_document  # type: ignore[name-defined]


def _strict_make_issue(code: str, field: str, label: str, message: str, severity: str = "WARNING", action: str = MANAGEMENT_REVIEW_ACTION, **extra: Any) -> dict[str, Any]:
    return {
        "code": code,
        "field": field,
        "fieldKey": field,
        "fieldLabel": label,
        "message": message,
        "severity": severity,
        "action": action,
        "penalty": extra.pop("penalty", 0.0),
        **extra,
    }


def _strict_issue_exists(result: dict[str, Any], code: str) -> bool:
    return any(issue.get("code") == code for issue in (result.get("errors") or []) + (result.get("warnings") or []))


def _strict_add_error(result: dict[str, Any], code: str, field: str, label: str, message: str, action: str = MANAGEMENT_REVIEW_ACTION, **extra: Any) -> None:
    if not _strict_issue_exists(result, code):
        result.setdefault("errors", []).append(_strict_make_issue(code, field, label, message, "ERROR", action, **extra))


def _strict_add_warning(result: dict[str, Any], code: str, field: str, label: str, message: str, action: str = MANAGEMENT_REVIEW_ACTION, **extra: Any) -> None:
    if not _strict_issue_exists(result, code):
        result.setdefault("warnings", []).append(_strict_make_issue(code, field, label, message, "WARNING", action, **extra))


def _strict_recompute_validation_status(result: dict[str, Any]) -> dict[str, Any]:
    errors = result.get("errors") or []
    warnings = result.get("warnings") or []
    if any(issue.get("action") == SUPPLEMENT_ACTION for issue in errors):
        status = "SUPPLEMENT_REQUIRED_CANDIDATE"
        action = SUPPLEMENT_ACTION
    elif errors or warnings:
        status = "NEED_REVIEW"
        action = MANAGEMENT_REVIEW_ACTION
    else:
        status = "PASS"
        action = PASS_ACTION

    messages = []
    for issue in errors + warnings:
        msg = issue.get("message")
        if msg:
            messages.append(str(msg))
    try:
        messages = dedupe_list(messages)  # type: ignore[name-defined]
    except Exception:
        messages = list(dict.fromkeys(messages))

    result["status"] = status
    result["recommendedAction"] = action
    result["reviewRequired"] = status != "PASS"
    result["review_required"] = status != "PASS"
    result["is_valid"] = status == "PASS"
    result["reviewMessages"] = messages
    result["review_messages"] = messages
    result["errorCount"] = len(errors)
    result["warningCount"] = len(warnings)
    result["error_count"] = len(errors)
    result["warning_count"] = len(warnings)
    return result


def validate_expense_document(extracted_data: dict[str, Any], ocr_text: str | None = "", reference_context: dict[str, Any] | None = None) -> dict[str, Any]:  # type: ignore[override]
    data = dict(extracted_data or {})
    if _strict_apply_extraction_guards is not None:
        _strict_apply_extraction_guards(data)

    result = _PRE_STRICT_VALIDATE_EXPENSE_DOCUMENT(data, ocr_text or data.get("raw_text") or "", reference_context=reference_context)
    text = str(ocr_text or data.get("raw_text") or "")
    doc_type = str(data.get("document_type") or "").upper()
    items = data.get("items") or []
    candidates = data.get("item_candidates") or []
    total = _strict_to_number(data.get("total_amount") or data.get("claim_amount") or data.get("paid_amount"))
    expected = _strict_to_number(data.get("sale_total_amount") or data.get("gross_amount")) or total
    meta = data.get("ocr_meta") or {}
    hints = meta.get("field_hints") or {}
    amount_hint_count = len(hints.get("amounts") or []) if isinstance(hints.get("amounts") or [], list) else 0
    input_quality = meta.get("input_quality") or {}
    metrics = meta.get("metrics") or {}

    if data.get("vendor_name") and _v9_is_weak_vendor(data.get("vendor_name")):
        _strict_add_error(
            result,
            "STRICT_VENDOR_NAME_INVALID",
            "vendor_name",
            "사용처",
            "사용처가 문서 제목, 정산 메타, 금액/주소/결제 정보 또는 OCR 노이즈로 보입니다. 원본 기준으로 사용처를 확인해야 합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.18,
            currentValue=data.get("vendor_name"),
        )

    if "HANDWRITTEN" in doc_type or data.get("handwritten_detected") or _strict_is_handwritten_form_text(text):
        _strict_add_error(
            result,
            "HANDWRITTEN_RECEIPT_REVIEW_REQUIRED",
            "document_type",
            "문서유형",
            "수기/손글씨 영수증은 자동 확정할 수 없습니다. 금액·품목·일자를 원본으로 확인해야 합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.25,
        )
        if not data.get("total_amount"):
            _strict_add_error(
                result,
                "HANDWRITTEN_TOTAL_NOT_CONFIRMED",
                "total_amount",
                "총금액",
                "수기 금액이 확정 가능한 형식으로 추출되지 않았습니다.",
                MANAGEMENT_REVIEW_ACTION,
                penalty=0.18,
            )

    if data.get("item_confirmation_status") and data.get("item_confirmation_status") != "CONFIRMED":
        _strict_add_error(
            result,
            "DETAIL_ITEMS_NOT_CONFIRMED",
            "items",
            "세부 품목",
            "상세 품목이 확정 기준을 통과하지 못했습니다. 저장 전 원본과 상세항목을 확인해야 합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.22,
            currentValue=data.get("item_confirmation_status"),
        )

    if expected is not None and items:
        item_sum = sum(float(_strict_to_number(item.get("amount")) or 0) for item in items if isinstance(item, dict))
        if abs(round(item_sum) - round(expected)) > 0:
            _strict_add_error(
                result,
                "STRICT_ITEM_SUM_MISMATCH",
                "items",
                "세부 품목",
                f"상세 품목 합계({item_sum:,.0f})와 기준금액({expected:,.0f})이 일치하지 않아 자동 확정할 수 없습니다.",
                MANAGEMENT_REVIEW_ACTION,
                penalty=0.25,
                currentValue=item_sum,
                expectedValue=expected,
            )

    if amount_hint_count >= 5 and len(items) <= 1 and "TRANSPORT" not in doc_type:
        _strict_add_error(
            result,
            "STRICT_ITEM_COUNT_TOO_LOW",
            "items",
            "세부 품목",
            f"OCR 금액 후보가 {amount_hint_count}개인데 확정 품목이 {len(items)}개입니다. 품목표가 누락되었을 가능성이 높습니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.22,
        )

    if total is None:
        _strict_add_error(
            result,
            "STRICT_TOTAL_AMOUNT_EMPTY",
            "total_amount",
            "총금액",
            "총금액이 확정되지 않았습니다.",
            SUPPLEMENT_ACTION if not text else MANAGEMENT_REVIEW_ACTION,
            penalty=0.20,
        )
    elif total < 1000 and re.search(r"합계|총액|공급대가|결제|승인", text):
        _strict_add_error(
            result,
            "STRICT_TOTAL_AMOUNT_SUSPICIOUS_SMALL",
            "total_amount",
            "총금액",
            "총금액이 1,000원 미만으로 인식되었지만 원문상 합계/결제 라벨이 있어 금액 오인식 가능성이 높습니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.25,
            currentValue=total,
        )

    if metrics.get("money_pattern") is False:
        _strict_add_error(
            result,
            "STRICT_OCR_MONEY_PATTERN_MISSING",
            "ocr_text",
            "OCR 원문",
            "OCR 메타에서 금액 패턴을 안정적으로 찾지 못했습니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.20,
        )

    if input_quality.get("very_blurry") or input_quality.get("too_small"):
        _strict_add_warning(
            result,
            "STRICT_IMAGE_QUALITY_REVIEW",
            "ocr_text",
            "OCR 원문",
            "이미지 품질 이슈가 있어 자동 확정 신뢰도를 제한합니다.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.10,
            currentValue=input_quality.get("issues"),
        )

    if candidates and not items:
        _strict_add_warning(
            result,
            "STRICT_ITEM_CANDIDATES_ONLY",
            "items",
            "세부 품목",
            "품목 후보는 있으나 확정 품목으로 저장하지 않았습니다. 원본 확인 후 필요한 항목만 수동 확정하세요.",
            MANAGEMENT_REVIEW_ACTION,
            penalty=0.12,
        )

    return _strict_recompute_validation_status(result)


def validate_extracted_expense_document(data: dict[str, Any]) -> dict[str, Any]:  # type: ignore[override]
    return validate_expense_document(data, data.get("raw_text") or "", reference_context=data.get("reference_context") if isinstance(data.get("reference_context"), dict) else None)
