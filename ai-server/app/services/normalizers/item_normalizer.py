import itertools
import re
from typing import Any


NON_ITEM_KEYWORDS = [
    # 합계/정산/세금
    "합계", "총계", "총액", "판매합계", "판매 합계", "총매출액", "받을금액", "받은금액", "거스름돈",
    "과세", "면세", "부가세", "부 가 세", "공급가액", "공급가", "급가액", "물품가액", "세액", "가액",
    # 결제/승인/할인
    "카드", "간편결제", "결제", "승인번호", "승인금액", "승인", "일시불", "할부", "카드번호",
    "포인트", "적립", "가용포인트", "사용포인트", "멤버십", "쿠폰", "할인", "토스페이", "머니", "계좌",
    # 사업자/매장/안내
    "전화", "TEL", "본사", "대표", "대표자", "매장", "주소", "사업자", "사업자번호", "가맹점",
    "교환", "환불", "영수증", "문의", "인증기업", "체크카드", "취소", "소요", "재발행", "전표",
    "POS", "P0S", "BILL", "CASHIER", "고객용", "바코드",
    # 홍보/이벤트
    "이벤트", "응모", "응모기간", "직관", "팬미팅", "기회", "프로모션", "스탬프", "안내",
]

OPTION_ONLY_KEYWORDS = ["1개", "1개기", "수량", "단품만", "참여", "안함", "옵션", "사이즈", "SIZE", "ICE", "HOT", "아이스", "무료", "증정"]

EXACT_NOISE_NAMES = {
    "YU위", "YU", "탈탈", "ㅣ부", "(ㅣ부", "위연방법일위", "위연방법밀위", "위연방법밀위/",
    "장", "부", "위", "탈", "탈탈탈", "연연방위", "A연연U위수", "YU위탈탈", "위연방법",
    "1개", "1개기", "참여", "안함", "단품만", "SIZE", "SIZEM", "ICEM", "ICE", "HOT",
}

LOW_AMOUNT_ALLOW_KEYWORDS = ["봉투", "쇼핑백", "포인트", "할인", "쿠폰"]

# 품목명으로 보기 어려운 OCR 잡음 문자의 공통 패턴.
# 특정 오답 문자열을 외우는 방식이 아니라, 문자 구성/숫자/기호/결제·메타 라벨 여부로 판정한다.
FOREIGN_NOISE_RE = re.compile(r"[ρπγ∗×Ω℃♥★◆◇□■●○▲△▼▽♣♠※^{}<>_=|`~]")
SLASH_NOISE_RE = re.compile(r"[\\/]")
ALLOWED_DIGIT_CONTEXT_RE = re.compile(
    r"(\d+\s*(개|병|잔|인분|인|세트|SET|set|종|호|ml|mL|ML|g|G|kg|KG|L|l)|"
    r"(제로|ZERO|zero)|"
    r"(1\+1|2\+1))"
)
PRODUCT_WORD_RE = re.compile(
    r"(김치|두부|전|모듬|소주|맥주|막걸리|주류|밥|국|탕|찌개|면|라면|우동|카츠|돈까스|돈가스|"
    r"피자|치킨|버거|샌드|빵|케이크|커피|라떼|아메리카노|에이드|스무디|티|차|하이볼|자몽|모히또|피치|"
    r"감바스|코젤|참이슬|양갈비|프렌치랙|마늘밥|봉투|쇼핑백|패치|비누|컵|타올|티슈)",
    re.I,
)


def char_stats(value: Any) -> dict[str, int | float]:
    text = str(value or "")
    compact = compact_text(text)
    length = max(len(compact), 1)
    korean = len(re.findall(r"[가-힣]", compact))
    english = len(re.findall(r"[A-Za-z]", compact))
    digits = len(re.findall(r"\d", compact))
    symbols = len(re.findall(r"[^가-힣A-Za-z0-9]", compact))
    letters = korean + english
    return {
        "length": len(compact),
        "korean": korean,
        "english": english,
        "digits": digits,
        "symbols": symbols,
        "letters": letters,
        "korean_ratio": korean / length,
        "letter_ratio": letters / length,
        "digit_ratio": digits / length,
        "symbol_ratio": symbols / length,
    }


def has_product_word(value: Any) -> bool:
    return bool(PRODUCT_WORD_RE.search(str(value or "")))


def has_allowed_digit_context(value: Any) -> bool:
    return bool(ALLOWED_DIGIT_CONTEXT_RE.search(str(value or "")))


def item_name_quality_score(name: Any, *, vendor_name: Any = None, amount: Any = None) -> float:
    """0~1 품목명 품질 점수.

    - 0.70 이상: 확정 품목명으로 사용 가능
    - 0.45~0.70: 검토 후보
    - 0.45 미만: OCR 잡음/메타 라인 가능성 큼
    """
    text = clean_text(name)
    if not text:
        return 0.0
    compact = compact_text(text)
    st = char_stats(text)
    score = 1.0

    if compact in EXACT_NOISE_NAMES or compact.lower() in {item.lower() for item in EXACT_NOISE_NAMES}:
        return 0.0
    if is_vendor_like(text, vendor_name):
        return 0.0
    if any(keyword and (keyword in text or compact_text(keyword).lower() in compact.lower()) for keyword in NON_ITEM_KEYWORDS):
        return 0.0
    if looks_like_business_or_phone_or_address(text):
        return 0.0
    if FOREIGN_NOISE_RE.search(text):
        score -= 0.50
    if SLASH_NOISE_RE.search(text):
        score -= 0.45
    if st["length"] < 2 or st["length"] > 45:
        score -= 0.45
    if st["letters"] < 2:
        score -= 0.65
    if st["symbol_ratio"] >= 0.08:
        score -= min(0.50, float(st["symbol_ratio"]) * 1.7)
    if st["digit_ratio"] > 0 and not has_allowed_digit_context(text):
        # 품목명에 숫자가 들어가도 1인분/2개/제로/1+1 같은 맥락이면 허용한다.
        score -= min(0.55, 0.25 + float(st["digit_ratio"]))
    if st["letter_ratio"] < 0.65:
        score -= 0.30
    if re.search(r"[A-Za-z]", compact) and re.search(r"[가-힣]", compact) and not has_product_word(text):
        score -= 0.25
    if has_product_word(text):
        score += 0.15
    return max(0.0, min(1.0, score))


def looks_like_business_or_phone_or_address(text: str) -> bool:
    if re.search(r"\d{3}\s*-\s*\d{2}\s*-\s*\d{5}", text):
        return True
    if re.search(r"\d{2,4}\s*-\s*\d{3,4}\s*-\s*\d{4}", text):
        return True
    if re.search(r"[가-힣]+[시도]\s*[가-힣]+[구군]|[가-힣0-9]+로\s*\d+|[가-힣0-9]+길\s*\d+|\d+\s*층|\d+\s*호|번지", text):
        return True
    return False


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "undefined", "nan"}:
        return None
    return re.sub(r"\s+", " ", text)


def compact_text(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").strip())


def to_number(value: Any) -> float | None:
    if value is None or value == "" or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    trans = str.maketrans({"a": "0", "A": "0", "o": "0", "O": "0", "i": "1", "I": "1", "l": "1", "L": "1"})
    text = text.translate(trans)
    text = text.replace(",", "").replace("원", "").replace("₩", "").replace(" ", "")
    if re.fullmatch(r"\d{1,3}\.\d{3}", text):
        text = text.replace(".", "")
    text = re.sub(r"[^0-9.\-]", "", text)
    if text in {"", "-", ".", "-."}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def has_meaningful_korean_or_english(value: str) -> bool:
    return bool(re.search(r"[가-힣A-Za-z]", value or ""))


def is_vendor_like(text: str, vendor_name: Any = None) -> bool:
    vendor = clean_text(vendor_name)
    if not vendor:
        return False
    a = normalize_compare(text)
    b = normalize_compare(vendor)
    if not a or not b:
        return False
    return a == b or (len(a) >= 4 and (a in b or b in a))


def normalize_compare(value: Any) -> str:
    return re.sub(r"[\s,._\-:;|/\\()\[\]{}'\"<>]+", "", str(value or "").lower())


def is_noise_item_name(name: Any, *, vendor_name: Any = None, amount: Any = None, strict: bool = False) -> bool:
    text = clean_text(name)
    if not text:
        return True

    compact = compact_text(text)
    compact_lower = compact.lower()
    amount_value = to_number(amount)
    has_amount = amount_value is not None and amount_value > 0
    quality = item_name_quality_score(text, vendor_name=vendor_name, amount=amount)

    # 금액이 맞아도 품목명 품질이 낮으면 확정 품목/후보로 쓰지 않는다.
    # 예: "정/제매 8 위무아장", "영혈 C3나 최은", "Z0"512.nf" 류.
    if strict and quality < 0.70:
        return True
    if not strict and quality < 0.45:
        return True

    if compact in EXACT_NOISE_NAMES or compact_lower in {item.lower() for item in EXACT_NOISE_NAMES}:
        return True

    if is_vendor_like(text, vendor_name):
        return True

    if any(keyword and (keyword in text or compact_text(keyword).lower() in compact_lower) for keyword in NON_ITEM_KEYWORDS):
        return True
    if re.search(r"공급가|급가액|부가세|부가|과세|면세|세액|물품가액|가액|결제금액|승인금액", compact):
        return True
    if re.search(r"급.*가.*세|가액.*세|과.*세|부.*세", compact):
        return True

    if re.fullmatch(r"[0-9,.'\-=*]+", compact):
        return True

    if re.fullmatch(r"\[[0-9A-Za-z\-]{3,30}\]", compact):
        return True

    if re.search(r"\d{3}\s*-\s*\d{2}\s*-\s*\d{5}", text):
        return True
    if re.search(r"\d{2,4}\s*-\s*\d{3,4}\s*-\s*\d{4}", text):
        return True
    if re.search(r"[가-힣]+[시도]\s*[가-힣]+[구군]|[가-힣0-9]+로\s*\d+|[가-힣0-9]+길\s*\d+|\d+\s*층", text):
        return True

    digits = len(re.findall(r"\d", compact))
    letters = len(re.findall(r"[가-힣A-Za-z]", compact))
    symbols = len(re.findall(r"[^가-힣A-Za-z0-9]", compact))

    if digits >= 8 and letters <= 2:
        return True

    if not has_meaningful_korean_or_english(compact):
        return True

    # 수량/옵션 조각은 품목명이 아니다. 예: 1개기, SIZE M, ICE
    if any(k.lower() in compact_lower for k in OPTION_ONLY_KEYWORDS) and not re.search(r"라떼|커피|우동|버거|샌드|카츠|봉투|쇼핑백", text, re.I):
        return True

    # 너무 작은 금액은 대부분 OCR 노이즈. 단, 봉투/쇼핑백/포인트/할인 예외.
    if has_amount:
        if amount_value is not None and amount_value < 10:
            return True
        if amount_value is not None and amount_value < 100 and not any(k in text for k in LOW_AMOUNT_ALLOW_KEYWORDS):
            return True

    if not has_amount:
        if len(compact) <= 2:
            return True
        if symbols / max(len(compact), 1) >= 0.45:
            return True
        if letters < 2:
            return True
        if re.search(r"[A-Za-z]", compact) and re.search(r"[가-힣]", compact) and len(compact) <= 5:
            return True

    if strict:
        if symbols / max(len(compact), 1) >= 0.45:
            return True
        if letters < 2:
            return True

    return False


def normalize_item(item: dict[str, Any], *, root_vendor_name: Any = None, total_amount: Any = None) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None

    description = clean_text(item.get("description") or item.get("item_name") or item.get("name") or item.get("item_description"))
    vendor_name = clean_text(item.get("vendor_name")) or clean_text(root_vendor_name)
    amount = to_number(item.get("amount"))
    quantity = to_number(item.get("quantity"))
    unit_price = to_number(item.get("unit_price"))
    total = to_number(total_amount)

    if not description:
        return None

    if is_noise_item_name(description, vendor_name=vendor_name, amount=amount):
        return None

    if amount is None and unit_price is None:
        return None

    if amount is None and unit_price is not None and quantity is not None:
        amount = unit_price * quantity

    if amount is not None and amount <= 0:
        return None

    if total is not None and amount is not None and amount > max(total + 100, total * 1.05):
        return None

    if quantity is None or quantity <= 0:
        quantity = 1

    # 수량×단가와 금액이 크게 다르면 LLM/OCR 노이즈다. 단가를 금액 기준으로 보정한다.
    if amount is not None and unit_price is not None and quantity:
        expected = unit_price * quantity
        if abs(expected - amount) > max(2, amount * 0.05):
            unit_price = amount / quantity

    cleaned = dict(item)
    cleaned["description"] = description
    cleaned["vendor_name"] = vendor_name
    cleaned["amount"] = amount
    cleaned["quantity"] = quantity
    cleaned["unit_price"] = unit_price if unit_price is not None and unit_price > 0 else amount / quantity if amount is not None else None
    return cleaned


def clean_detail_items(
    items: Any,
    *,
    root_vendor_name: Any = None,
    total_amount: Any = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not isinstance(items, list):
        return [], []

    cleaned: list[dict[str, Any]] = []
    removed: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()

    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            removed.append({"index": index, "item": item, "reason": "품목 객체 형식이 아님"})
            continue

        description = clean_text(item.get("description") or item.get("item_name") or item.get("name") or item.get("item_description"))
        amount = to_number(item.get("amount"))
        normalized = normalize_item(item, root_vendor_name=root_vendor_name, total_amount=total_amount)

        if normalized is None:
            if is_noise_item_name(description, vendor_name=item.get("vendor_name") or root_vendor_name, amount=amount):
                reason = "품목명이 OCR 노이즈 또는 영수증 안내/정산/옵션 라인으로 판단됨"
            elif amount is None and to_number(item.get("unit_price")) is None:
                reason = "금액 정보가 없는 품목 후보"
            else:
                reason = "품목 검증 기준 미충족"
            removed.append({"index": index, "item": item, "reason": reason})
            continue

        key = (compact_text(normalized.get("description")).lower(), int(to_number(normalized.get("amount")) or -1))
        if key in seen:
            removed.append({"index": index, "item": item, "reason": "중복 품목 후보"})
            continue
        seen.add(key)
        cleaned.append(normalized)

    cleaned = choose_subset_matching_total(cleaned, to_number(total_amount))
    return cleaned, removed


def choose_subset_matching_total(items: list[dict[str, Any]], total: float | None) -> list[dict[str, Any]]:
    if not items or total is None or total <= 0:
        return items
    tolerance = max(10.0, total * 0.03)
    current_sum = sum(to_number(i.get("amount")) or 0 for i in items)
    if abs(current_sum - total) <= tolerance:
        return items
    if len(items) > 14:
        return items

    best = items
    best_diff = abs(current_sum - total)
    for r in range(1, len(items) + 1):
        for subset in itertools.combinations(items, r):
            s = sum(to_number(i.get("amount")) or 0 for i in subset)
            diff = abs(s - total)
            if diff < best_diff or (diff == best_diff and len(subset) > len(best)):
                best = list(subset)
                best_diff = diff
    return best if best_diff <= tolerance else items


def build_item_quality_summary(items: Any, total_amount: Any = None) -> dict[str, Any]:
    if not isinstance(items, list):
        items = []

    total = to_number(total_amount)
    valid_items = [item for item in items if isinstance(item, dict) and clean_text(item.get("description"))]
    amount_items = [to_number(item.get("amount")) for item in valid_items]
    amount_items = [amount for amount in amount_items if amount is not None and amount > 0]
    item_sum = float(sum(amount_items)) if amount_items else 0.0

    diff = None
    tolerance = None
    matched = False
    if total is not None:
        diff = abs(total - item_sum)
        tolerance = max(10.0, total * 0.03)
        matched = diff <= tolerance

    invalid_names = []
    for idx, item in enumerate(valid_items, start=1):
        desc = clean_text(item.get("description"))
        amount = to_number(item.get("amount"))
        if is_noise_item_name(desc, vendor_name=item.get("vendor_name"), amount=amount):
            invalid_names.append({"index": idx, "description": desc, "amount": amount})

    return {
        "totalAmount": total,
        "itemSum": item_sum,
        "diff": diff,
        "tolerance": tolerance,
        "matched": matched,
        "itemCount": len(valid_items),
        "amountCount": len(amount_items),
        "missingAmountCount": max(0, len(valid_items) - len(amount_items)),
        "invalidItemCount": len(invalid_names),
        "invalidItems": invalid_names,
    }


def should_skip_llm_for_items(
    items: Any,
    *,
    total_amount: Any = None,
    document_type: str | None = None,
    require_valid_items: bool = True,
) -> tuple[bool, dict[str, Any], str | None]:
    summary = build_item_quality_summary(items, total_amount=total_amount)
    if not require_valid_items:
        return True, summary, None
    if document_type in {"TRANSPORT_RECEIPT", "TRANSPORT_TICKET", "CARD_RECEIPT"}:
        return True, summary, None
    if summary.get("itemCount", 0) <= 0:
        return False, summary, "품목형 영수증인데 정상 품목이 없습니다."
    if summary.get("missingAmountCount", 0) > 0:
        return False, summary, "금액이 없는 품목이 있습니다."
    if summary.get("invalidItemCount", 0) > 0:
        return False, summary, "품목명이 아닌 노이즈가 남아 있습니다."
    if summary.get("matched") is not True:
        return False, summary, "상세 품목 합계가 총액과 일치하지 않습니다."
    return True, summary, None
