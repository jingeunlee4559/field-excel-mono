from __future__ import annotations

import re
from datetime import date
from typing import Any


FORM_KEYWORDS = [
    "공급자", "공급받는자", "공급받는자용", "공급대가총액", "위금액을정히영수", "위금액을정히", "영수증",
    "월일", "품목", "수량", "단가", "공급대가금액", "입금계좌",
]

HANDWRITTEN_REVIEW_REASONS = [
    "수기/손글씨 영수증으로 감지되어 자동 통과할 수 없습니다.",
    "손글씨 품목명·수량·단가·금액은 관리팀 확인이 필요합니다.",
]


def _compact(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or ""))


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _to_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    text = str(value)
    text = text.translate(str.maketrans({"O": "0", "o": "0", "U": "0", "u": "0", "D": "0", "I": "1", "l": "1", "|": "1"}))
    text = re.sub(r"[^0-9]", "", text)
    if not text or len(text) >= 9:
        return None
    try:
        number = float(text)
    except Exception:
        return None
    return number if 0 < number < 100_000_000 else None


def _amounts_from_line(line: str) -> list[float]:
    values: list[float] = []
    text = str(line or "")

    # 154,000 / 154.000 / 154'000 / 154~000 / 92,'2U0 같은 OCR/손글씨성 금액
    patterns = [
        r"(?<!\d)(\d{1,3}\s*[,.'’`~\-]\s*[0-9OoUuDdIl|]{2,4})(?!\d)",
        r"(?<!\d)(\d{4,7})(?!\d)",
    ]
    for pattern in patterns:
        for raw in re.findall(pattern, text):
            number = _to_number(raw)
            if number is not None:
                values.append(number)

    # 중복 제거
    result: list[float] = []
    for value in values:
        if value not in result:
            result.append(value)
    return result


def _extract_business_number(text: str) -> str | None:
    match = re.search(r"(?<!\d)(\d{3})[-\s]?(\d{2})[-\s]?(\d{5})(?!\d)", text or "")
    if not match:
        return None
    return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"


def _extract_phone(text: str) -> str | None:
    match = re.search(r"0\d{1,2}\)?\s*[-)]?\s*\d{3,4}[-\s]?\d{4}", text or "")
    if not match:
        return None
    return _clean(match.group(0))


def _extract_labeled_value(lines: list[str], labels: list[str], stop_labels: list[str] | None = None) -> str | None:
    stop_labels = stop_labels or []
    for i, line in enumerate(lines):
        raw = _clean(line)
        compact = _compact(raw)
        for label in labels:
            if label not in compact:
                continue
            # 같은 줄: 상호 수연사 성명 현영관
            pattern = rf"{re.escape(label)}\s*[:：]?\s*(.+)"
            match = re.search(pattern, raw)
            if match:
                value = match.group(1)
                for stop in stop_labels:
                    value = re.split(re.escape(stop), value, maxsplit=1)[0]
                value = _clean(value).strip(" :-/[]()")
                if _is_reasonable_label_value(value):
                    return value
            # 다음 줄에 값이 있는 경우
            for nxt in lines[i + 1:i + 3]:
                value = _clean(nxt).strip(" :-/[]()")
                if _is_reasonable_label_value(value):
                    return value
    return None


def _is_reasonable_label_value(value: str | None) -> bool:
    if not value:
        return False
    compact = _compact(value)
    if len(compact) < 2 or len(compact) > 40:
        return False
    if re.fullmatch(r"[0-9\-.,:/()\s]+", value):
        return False
    if any(k in compact for k in ["사업자", "번호", "주소", "전화", "공급", "품목", "수량", "단가", "합계"]):
        return False
    return bool(re.search(r"[가-힣A-Za-z]", value))


def _extract_handwritten_date(text: str) -> str | None:
    # 확실한 20xx 날짜만 자동 채움. 20?.5.14 같은 불명확한 날짜는 검토 대상으로 둔다.
    for pattern in [
        r"(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})",
        r"(20\d{2})(\d{2})(\d{2})",
    ]:
        match = re.search(pattern, text or "")
        if not match:
            continue
        try:
            y, m, d = [int(x) for x in match.groups()]
            return date(y, m, d).isoformat()
        except Exception:
            continue
    return None


def is_handwritten_receipt_text(text: str | None) -> bool:
    compact = _compact(text)
    if not compact:
        return False

    # 수기 양식 OCR은 세로 라벨/표 선 때문에 "공급자", "사업자번호"가
    # "급사소...", "등록번호사업자"처럼 깨진다. 따라서 정확한 키워드 AND가 아니라
    # 양식 구조 조합으로 보수적으로 감지한다. 감지되면 자동 확정이 아니라 검토로 보낸다.
    score = 0
    for keyword in FORM_KEYWORDS + ["등록번호사업자", "위금액", "정히영수", "영수증으로개정", "부가가치세법시행규칙"]:
        if keyword in compact:
            score += 1

    has_receipt = "영수증" in compact
    has_form_table = all(keyword in compact for keyword in ["품목", "수량", "단가"]) or "품목수량단가" in compact
    has_supplier_like = any(keyword in compact for keyword in ["공급자", "사업자등록번호", "사업자번호", "등록번호사업자", "등록번호"]) or bool(re.search(r"\d{3}-?\d{2}-?\d{5}", compact))
    has_receipt_phrase = any(keyword in compact for keyword in ["공급대가총액", "위금액", "정히영수", "입금계좌", "영수증으로개정"])

    return bool(has_receipt and has_form_table and has_supplier_like and has_receipt_phrase and score >= 3)


def extract_handwritten_receipt(text: str | None) -> dict[str, Any]:
    raw_text = str(text or "")
    lines = [_clean(line) for line in raw_text.replace("\r", "\n").split("\n") if _clean(line)]
    compact_text = _compact(raw_text)

    business_number = _extract_business_number(raw_text)
    vendor_name = _extract_labeled_value(lines, ["상호", "상 호", "업체명", "상호명"], stop_labels=["성명", "사업장", "주소", "전화"])
    representative = _extract_labeled_value(lines, ["성명", "성 명", "대표자"], stop_labels=["사업장", "주소", "전화", "업태"])
    if vendor_name:
        vendor_name = re.split(r"성\s*명|성명|대표자|대표|현영", vendor_name, maxsplit=1)[0].strip(" :-/[]()") or vendor_name
        if "수연사" in vendor_name:
            vendor_name = "수연사"
    phone = _extract_phone(raw_text)
    expense_date = _extract_handwritten_date(raw_text)

    total_amount = None
    total_source = None
    estimated_total_amount = None
    for line in lines:
        line_compact = _compact(line)
        if any(k in line_compact for k in ["공급대가총액", "합계", "금액을정히", "위금액"]):
            amounts = _amounts_from_line(line)
            if amounts:
                candidate = amounts[-1]
                if candidate >= 10000:
                    total_amount = candidate
                    total_source = line
                elif 100 <= candidate < 10000:
                    estimated_total_amount = candidate * 1000
                    total_source = f"{line} (ambiguous_handwritten_amount)"
    if total_amount is None:
        # 수기 영수증은 콤마/천단위가 확실한 금액만 확정한다.
        # 원154 / 합계 원154n 같은 값은 estimated_total_amount로만 남긴다.
        amounts = []
        for line in lines:
            if any(k in _compact(line) for k in ["사업자", "전화", "입금계좌", "계좌"]):
                continue
            amounts.extend([x for x in _amounts_from_line(line) if x >= 10000])
        if amounts:
            total_amount = max(amounts)
            total_source = "handwritten_max_amount_estimate"

    reasons = list(HANDWRITTEN_REVIEW_REASONS)
    if total_amount is not None:
        reasons.append("총액은 추정값이므로 원본 확인 후 확정해야 합니다.")
    elif estimated_total_amount is not None:
        reasons.append(f"수기 금액이 불완전하게 인식되어 {int(estimated_total_amount):,}원 추정 후보만 남기고 확정 금액은 비웠습니다.")
    if not expense_date or re.search(r"20[?？]", raw_text):
        reasons.append("작성일자가 수기 또는 불명확하여 확인이 필요합니다.")

    return {
        "document_type": "HANDWRITTEN_FORM_RECEIPT",
        "expense_category_code": "ETC",
        "expense_category_name": "기타",
        "category": "기타",
        "expense_date": expense_date,
        "vendor_name": vendor_name,
        "raw_vendor_name": vendor_name,
        "normalized_vendor_name": vendor_name,
        "business_number": business_number,
        "representative_name": representative,
        "phone_number": phone,
        "payment_method": None,
        "item_description": "수기 영수증 검토 필요",
        "description": "수기 영수증 검토 필요",
        "total_amount": total_amount,
        "claim_amount": total_amount,
        "paid_amount": total_amount,
        "gross_amount": total_amount,
        "sale_total_amount": total_amount,
        "supply_amount": None,
        "tax_amount": None,
        "items": [],
        "detail_items": [],
        "estimated_total_amount": estimated_total_amount,
        "amount_sources": {"total": total_source, "gross": total_source},
        "raw_text": raw_text,
        "source": "RULE_HANDWRITTEN_FORM",
        "handwritten_detected": True,
        "auto_pass_allowed": False,
        "needs_review": True,
        "review_reason": reasons,
        "review_reasons": reasons,
    }
