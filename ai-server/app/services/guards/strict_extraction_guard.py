from __future__ import annotations

import re
from typing import Any


def to_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    text = str(value).strip()
    text = text.translate(str.maketrans({"O": "0", "o": "0", "U": "0", "u": "0", "D": "0", "I": "1", "l": "1", "|": "1"}))
    text = text.replace(",", "")
    if re.fullmatch(r"\d{1,6}\.\d{2,3}", text):
        text = text.replace(".", "")
    text = re.sub(r"[^0-9\-]", "", text)
    if not text or text == "-":
        return None
    try:
        n = float(text)
    except Exception:
        return None
    if n <= 0 or n >= 100_000_000:
        return None
    return n


def compact(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or ""))


def dedupe(values: list[Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value or "").strip()
        if text and text not in seen:
            seen.add(text)
            out.append(text)
    return out


HANDWRITTEN_HINTS = [
    "공급받는자용", "공급대가총액", "위금액을정히", "정히영수", "입금계좌",
    "품목수량단가", "공급대가금액", "부가가치세법시행규칙", "영수증으로개정",
]

NON_ITEM_KEYWORDS = [
    "합계", "총계", "총액", "판매합계", "받을금액", "받은금액", "결제", "카드", "승인",
    "공급가", "공급가액", "부가세", "세액", "과세", "면세", "입금계좌", "사업자", "전화",
    "주소", "대표", "매장명", "영수증", "계산서", "주문자", "고객수", "테이블", "일시불",
    "포인트", "멤버십", "가맹점", "카드번호", "승인번호", "승인일시",
]

KNOWN_SHORT_ITEMS: set[str] = set()  # 특정 품목명 예외 금지

PRODUCT_WORD_RE = re.compile(r"[가-힣A-Za-z]{2,}")  # 품목 사전 대신 문자 구조만 확인
FOREIGN_NOISE_RE = re.compile(r"[ρπγ∗×Ω℃♥★◆◇□■●○▲△▼▽♣♠※^{}<>_=|`~]")
ALLOWED_DIGIT_CONTEXT_RE = re.compile(
    r"(\d+\s*(개|개입|입|매|장|롤|팩|봉|병|잔|인분|인|세트|SET|set|종|호|ml|mL|ML|g|G|kg|KG|L|l)|"
    r"(제로|ZERO|zero)|(1\+1|2\+1))"
)


def has_meaningful_item_letters(name: Any) -> bool:
    text = str(name or "").strip()
    if not text:
        return False
    compacted = re.sub(r"[0-9,.'`~\-:;_/\\()\[\]{}\s]+", "", text)
    compacted = re.sub(r"^(개|EA|ea|x|X)+", "", compacted)
    if re.search(r"[가-힣]{2,}", compacted):
        return True
    english = "".join(re.findall(r"[A-Za-z]", compacted))
    digits = re.findall(r"\d", text)
    if len(english) >= 2 and not digits:
        return True
    if len(english) >= 4 and len(digits) <= 1:
        return True
    return False


def item_name_quality_score(name: Any) -> float:
    text = str(name or "").strip()
    c = compact(text)
    if not c:
        return 0.0
    if c in KNOWN_SHORT_ITEMS:
        return 1.0
    if any(k in c for k in NON_ITEM_KEYWORDS):
        return 0.0
    if re.fullmatch(r"[0-9,.'`~\-:;_/\\()\[\]{}\s]+", text):
        return 0.0
    if re.search(r"\d{3}-?\d{2}-?\d{5}|\d{2,4}-?\d{3,4}-?\d{4}", c):
        return 0.0
    if re.search(r"[가-힣0-9]+(?:길|로)\d+|번지|\d+호", c):
        return 0.0

    length = max(len(c), 1)
    korean = len(re.findall(r"[가-힣]", c))
    english = len(re.findall(r"[A-Za-z]", c))
    digits = len(re.findall(r"\d", c))
    symbols = len(re.findall(r"[^가-힣A-Za-z0-9]", c))
    letters = korean + english
    score = 1.0

    if len(c) < 2 or len(c) > 45:
        score -= 0.45
    if letters < 2:
        score -= 0.65
    if not has_meaningful_item_letters(text):
        score -= 0.70
    if FOREIGN_NOISE_RE.search(text):
        score -= 0.50
    if re.search(r"[\\/]", text):
        score -= 0.45
    if symbols / length >= 0.08:
        score -= min(0.50, (symbols / length) * 1.7)
    if digits > 0 and not ALLOWED_DIGIT_CONTEXT_RE.search(text):
        # 상품명에는 모델명/규격 숫자가 붙을 수 있다.
        # 특정 품목 사전 없이, 문자 비율이 충분한 경우에는 감점을 약하게 준다.
        # 단, 전화번호/사업자번호/주소는 위에서 이미 제외한다.
        digit_ratio = digits / length
        if letters >= 3 and digit_ratio <= 0.45:
            score -= min(0.22, digit_ratio * 0.45)
        else:
            score -= min(0.55, 0.25 + digit_ratio)
    if letters / length < 0.65:
        score -= 0.30
    if re.search(r"[A-Za-z]", c) and re.search(r"[가-힣]", c) and not PRODUCT_WORD_RE.search(text):
        score -= 0.25
    return max(0.0, min(1.0, score))


def is_handwritten_form_text(text: str | None) -> bool:
    c = compact(text)
    if not c:
        return False
    score = sum(1 for hint in HANDWRITTEN_HINTS if hint in c)
    has_receipt = "영수증" in c
    has_table = ("품목" in c and "수량" in c and "단가" in c) or "품목수량단가" in c
    has_account_or_phrase = "입금계좌" in c or "정히영수" in c or "위금액" in c
    has_supplier_like = "사업자" in c or "등록번호" in c or re.search(r"\d{3}-?\d{2}-?\d{5}", c)
    return bool(has_receipt and has_table and has_account_or_phrase and has_supplier_like and score >= 2)


def is_bad_item_name(name: Any) -> bool:
    text = str(name or "").strip()
    c = compact(text)
    if not c:
        return True
    if c in KNOWN_SHORT_ITEMS:
        return False
    quality = item_name_quality_score(text)
    if quality < 0.70:
        # 정상 상품명에 규격 숫자가 붙는 경우는 구조 규칙으로 허용한다.
        if not (PRODUCT_WORD_RE.search(text) and quality >= 0.55):
            return True
    if len(c) < 2 or len(c) > 45:
        return True
    if any(k in c for k in NON_ITEM_KEYWORDS):
        return True
    if re.fullmatch(r"[0-9,.'`~\-:;_/\\()\[\]{}\s]+", text):
        return True
    if re.search(r"\d{3}-?\d{2}-?\d{5}|\d{2,4}-?\d{3,4}-?\d{4}", c):
        return True
    if re.search(r"[가-힣0-9]+(?:길|로)\d+|번지|\d+호", c):
        return True

    letters = re.findall(r"[가-힣A-Za-z]", c)
    if len(letters) < 2:
        return True
    if not has_meaningful_item_letters(text):
        return True

    # OCR 깨짐 라인: 특수문자/숫자 비율이 높거나 의미 없는 영문/기호가 섞인 품목명.
    weird = re.findall(r"[^가-힣A-Za-z0-9\s]", text)
    digits = re.findall(r"\d", c)
    if len(weird) >= 3:
        return True
    if len(digits) >= len(letters) and not (PRODUCT_WORD_RE.search(text)):
        return True
    # 영문+숫자 혼합 모델명/규격은 상품명일 수 있으므로,
    # 한글/영문 문자 구조가 충분하면 제외하지 않는다.
    if re.search(r"[{}πγρΩ<>^]|['`’]{2,}|\d[A-Za-z]{3,}", text):
        return True
    if re.search(r"[A-Za-z]{4,}\d", text) and len(letters) < 4:
        return True
    if re.fullmatch(r"[A-Za-z0-9\-_. ]+", text):
        return True
    return False


def _expected_item_total(data: dict[str, Any]) -> float | None:
    gross = to_number(data.get("sale_total_amount") or data.get("gross_amount"))
    if gross is not None:
        return gross
    total = to_number(data.get("total_amount") or data.get("claim_amount") or data.get("paid_amount"))
    discount = to_number(data.get("discount_amount")) or 0
    if total is not None and discount:
        return total + discount
    return total


def _amount_hint_count(data: dict[str, Any]) -> int:
    meta = data.get("ocr_meta") or {}
    hints = meta.get("field_hints") or {}
    amounts = hints.get("amounts") or []
    if isinstance(amounts, list):
        return len(amounts)
    return 0


def _money_pattern_false(data: dict[str, Any]) -> bool:
    meta = data.get("ocr_meta") or {}
    metrics = meta.get("metrics") or {}
    return metrics.get("money_pattern") is False


def _set_review(data: dict[str, Any], reason: str) -> None:
    reasons = []
    for key in ("review_reasons", "review_reason"):
        value = data.get(key)
        if isinstance(value, list):
            reasons.extend(value)
        elif value:
            reasons.append(value)
    reasons.append(reason)
    reasons = dedupe(reasons)
    data["review_reasons"] = reasons
    data["review_reason"] = reasons
    data["needs_review"] = True


def _filter_items(items: list[Any], expected: float | None) -> tuple[list[dict[str, Any]], list[str]]:
    valid: list[dict[str, Any]] = []
    reject_reasons: list[str] = []
    seen: set[tuple[str, int]] = set()

    for raw in items or []:
        if not isinstance(raw, dict):
            reject_reasons.append("품목 형식이 올바르지 않은 후보 제외")
            continue
        item = dict(raw)
        name = item.get("item_name") or item.get("description") or item.get("item_description") or item.get("name")
        amount = to_number(item.get("amount") or item.get("total_amount"))
        qty = to_number(item.get("quantity") or item.get("qty") or item.get("count")) or 1
        unit = to_number(item.get("unit_price") or item.get("unitPrice") or item.get("price"))

        if is_bad_item_name(name):
            reject_reasons.append(f"품목명이 깨졌거나 정산/메타 라인으로 보이는 후보 제외: {str(name or '')[:40]}")
            continue
        if amount is None or amount <= 0:
            reject_reasons.append(f"금액이 없는 품목 후보 제외: {str(name or '')[:30]}")
            continue
        if amount < 100 and not re.search(r"봉투|쇼핑백|비닐|포장", str(name or "")):
            reject_reasons.append(f"비정상 소액 품목 후보 제외: {name} {amount:g}")
            continue
        if expected is not None and amount > max(expected + 100, expected * 1.05):
            reject_reasons.append(f"총액보다 큰 품목 후보 제외: {name} {amount:g}")
            continue
        if unit is not None and qty and amount:
            expected_line = unit * qty
            # 금액 행은 단가×수량=금액이 거의 맞아야 확정한다.
            if abs(expected_line - amount) > max(10, amount * 0.05):
                reject_reasons.append(f"단가×수량과 금액이 맞지 않는 품목 후보 제외: {name}")
                continue

        key = (compact(name).lower(), int(round(amount)))
        if key in seen:
            continue
        seen.add(key)
        item["item_name"] = str(name).strip()
        item["description"] = str(name).strip()
        item["amount"] = amount
        item["quantity"] = qty
        if unit is None:
            unit = amount / qty if qty else amount
        item["unit_price"] = unit
        valid.append(item)

    return valid, reject_reasons


def apply_strict_extraction_guards(data: dict[str, Any]) -> dict[str, Any]:
    """보수적 후처리 방어막.

    이 함수의 목적은 값을 더 만들어내는 것이 아니라, 근거가 약한 상세 품목/금액을
    확정값으로 저장하지 못하게 막는 것이다.
    """
    if not isinstance(data, dict):
        return data

    raw_text = str(data.get("raw_text") or "")
    doc_type = str(data.get("document_type") or "").upper()
    is_transport = "TRANSPORT" in doc_type
    is_handwritten = "HANDWRITTEN" in doc_type or data.get("handwritten_detected") or is_handwritten_form_text(raw_text)

    if is_handwritten:
        data["document_type"] = "HANDWRITTEN_FORM_RECEIPT"
        data["handwritten_detected"] = True
        data["auto_pass_allowed"] = False
        original_items = data.get("items") or data.get("detail_items") or []
        if original_items:
            data["item_candidates"] = original_items
        data["items"] = []
        data["detail_items"] = []
        data["item_confirmation_status"] = "HANDWRITTEN_REVIEW_ONLY"
        data["item_description"] = "수기 영수증 검토 필요"
        data["description"] = "수기 영수증 검토 필요"
        total = to_number(data.get("total_amount"))
        # 수기 양식에서 원154 / 합계 원154n 같은 값은 154원이 아니라 판독 실패로 본다.
        if total is not None and total < 1000:
            data["estimated_total_amount"] = total * 1000
            for key in ["total_amount", "claim_amount", "paid_amount", "gross_amount", "sale_total_amount"]:
                data[key] = None
            _set_review(data, "수기 금액이 154처럼 불완전하게 인식되어 총액 확정값에서 제외했습니다.")
        _set_review(data, "수기/손글씨 영수증은 품목·수량·단가·금액 자동 확정이 불가하여 관리팀 검토가 필요합니다.")
        data["strict_confidence_cap"] = min(float(data.get("strict_confidence_cap") or 1), 0.25 if data.get("total_amount") in (None, "", []) else 0.35)
        return data

    if is_transport:
        return data

    items = data.get("items") or data.get("detail_items") or []
    if not isinstance(items, list):
        data["item_candidates"] = items
        data["items"] = []
        data["detail_items"] = []
        data["item_confirmation_status"] = "INVALID_ITEM_FORMAT"
        data["strict_confidence_cap"] = min(float(data.get("strict_confidence_cap") or 1), 0.30)
        _set_review(data, "상세 품목 형식이 올바르지 않아 확정 품목에서 제외했습니다.")
        return data

    expected = _expected_item_total(data)
    filtered, reject_reasons = _filter_items(items, expected)
    if reject_reasons:
        data["item_reject_reasons"] = dedupe(reject_reasons)[:12]
        _set_review(data, "품목 후보 중 깨진 문자열/정산 라인/금액 불일치 후보를 제외했습니다.")

    amount_hints = _amount_hint_count(data)
    if expected is not None and filtered:
        item_sum = sum(float(to_number(item.get("amount")) or 0) for item in filtered)
        diff = abs(round(item_sum) - round(expected))
        data["item_sum"] = item_sum
        data["expected_item_total"] = expected
        data["item_sum_diff"] = diff
        if diff > 0:
            data["item_candidates"] = filtered
            data["candidate_item_sum"] = item_sum
            data["confirmed_items"] = []
            data["items"] = []
            data["detail_items"] = []
            data["item_confirmation_status"] = "UNCONFIRMED_SUM_MISMATCH"
            data["item_description"] = "상세 품목 검토 필요"
            data["description"] = "상세 품목 검토 필요"
            # 후보는 남겨서 관리팀이 바로 수정할 수 있게 하되, 자동 확정만 막는다.
            # 총액/상호/날짜가 맞는데 품목만 검토인 경우 0%로 떨어뜨리지 않는다.
            ratio = diff / max(expected, 1)
            cap = 0.55 if ratio >= 0.10 else 0.68
            data["strict_confidence_cap"] = min(float(data.get("strict_confidence_cap") or 1), cap)
            _set_review(data, f"품목 후보 합계({item_sum:,.0f})와 기준금액({expected:,.0f})이 일치하지 않아 자동 확정하지 않았습니다. 후보 품목은 검토용으로 유지합니다.")
            return data

    if amount_hints >= 5 and len(filtered) <= 1:
        data["item_candidates"] = filtered
        data["items"] = []
        data["detail_items"] = []
        data["item_confirmation_status"] = "UNCONFIRMED_TOO_FEW_ITEMS"
        data["item_description"] = "상세 품목 검토 필요"
        data["description"] = "상세 품목 검토 필요"
        data["strict_confidence_cap"] = min(float(data.get("strict_confidence_cap") or 1), 0.45)
        _set_review(data, "OCR 금액 후보는 여러 개인데 확정 품목이 1개 이하라 상세 품목을 확정하지 않았습니다. 후보 품목은 검토용으로 유지합니다.")
        return data

    data["items"] = filtered
    data["detail_items"] = filtered
    if filtered:
        data["confirmed_items"] = filtered
        data["item_candidates"] = data.get("item_candidates") or filtered
        data["candidate_item_sum"] = sum(float(to_number(item.get("amount")) or 0) for item in filtered)
        if len(filtered) == 1:
            data["item_description"] = filtered[0].get("item_name") or filtered[0].get("description")
        else:
            first = filtered[0].get("item_name") or filtered[0].get("description") or "상세 품목"
            data["item_description"] = f"{first} 외 {len(filtered) - 1}건"
        data["description"] = data["item_description"]
        data["item_confirmation_status"] = "CONFIRMED"
    elif items:
        data["item_candidates"] = items
        data["item_confirmation_status"] = "UNCONFIRMED_ALL_REJECTED"
        data["item_description"] = "상세 품목 검토 필요"
        data["description"] = "상세 품목 검토 필요"
        data["strict_confidence_cap"] = min(float(data.get("strict_confidence_cap") or 1), 0.30)
        _set_review(data, "추출된 품목 후보가 모두 확정 기준을 통과하지 못했습니다.")

    total = to_number(data.get("total_amount"))
    if total is not None and total < 1000 and re.search(r"합계|총액|공급대가|결제|승인", raw_text):
        data["suspicious_total_amount"] = total
        for key in ["total_amount", "claim_amount", "paid_amount"]:
            data[key] = None
        data["strict_confidence_cap"] = min(float(data.get("strict_confidence_cap") or 1), 0.25)
        _set_review(data, "총액이 1,000원 미만으로 인식되었으나 원문상 합계/결제 라벨이 있어 금액 오인식으로 판단했습니다.")

    if _money_pattern_false(data):
        data["strict_confidence_cap"] = min(float(data.get("strict_confidence_cap") or 1), 0.30)
        _set_review(data, "OCR 메타 기준 금액 패턴을 안정적으로 찾지 못했습니다.")

    return data


def apply_strict_confidence_caps(data: dict[str, Any], score: float) -> float:
    caps: list[float] = []
    explicit = to_number(data.get("strict_confidence_cap"))
    if explicit is not None:
        caps.append(explicit)

    doc_type = str(data.get("document_type") or "").upper()
    if "HANDWRITTEN" in doc_type or data.get("handwritten_detected"):
        caps.append(0.25 if data.get("total_amount") in (None, "", []) else 0.35)

    status = str(data.get("item_confirmation_status") or "")
    if status.startswith("UNCONFIRMED"):
        expected = _expected_item_total(data)
        candidate_sum = to_number(data.get("candidate_item_sum"))
        if expected is not None and candidate_sum is not None and round(expected) == round(candidate_sum):
            caps.append(0.72)
        else:
            caps.append(0.55)
    if status == "HANDWRITTEN_REVIEW_ONLY":
        caps.append(0.25 if data.get("total_amount") in (None, "", []) else 0.35)

    if data.get("total_amount") in (None, "", []):
        caps.append(0.30)

    meta = data.get("ocr_meta") or {}
    input_quality = meta.get("input_quality") or {}
    if input_quality.get("very_blurry"):
        caps.append(0.35)
    elif input_quality.get("blurry"):
        caps.append(0.60)
    if input_quality.get("too_small") and ("HANDWRITTEN" in doc_type or data.get("handwritten_detected")):
        caps.append(0.25)

    hints = meta.get("field_hints") or {}
    if len(hints.get("amounts") or []) >= 5 and len(data.get("items") or []) <= 1 and "TRANSPORT" not in doc_type:
        expected = _expected_item_total(data)
        candidate_sum = to_number(data.get("candidate_item_sum"))
        if expected is not None and candidate_sum is not None and round(expected) == round(candidate_sum):
            caps.append(0.72)
        else:
            caps.append(0.55)

    if _money_pattern_false(data):
        caps.append(0.30)

    vendor = data.get("vendor_name")
    if vendor and is_bad_item_name(vendor):
        # 상호 검증은 품목명보다 느슨해야 하지만, 정산/메타/깨진 문자열이면 높게 줄 수 없다.
        caps.append(0.40)

    return min(score, min(caps)) if caps else score
