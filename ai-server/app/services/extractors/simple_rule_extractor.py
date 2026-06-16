import json
import re
from datetime import date
from typing import Any

from app.services.rules.constants import CATEGORY_CODE_TO_NAME
from app.services.parsers.receipt_item_parser import extract_pos_receipt_items, parse_structured_item_line
from app.services.parsers.handwritten_receipt_parser import is_handwritten_receipt_text, extract_handwritten_receipt
from app.services.parsers.transport_receipt_parser import is_transport_text, parse_transport_receipt
from app.services.normalizers.vendor_normalizer import normalize_vendor_name, is_bad_vendor_candidate
from app.services.rules.rule_loader import get_receipt_rules, get_expense_category_rules
from app.services.rules.rule_context import (
    apply_reference_text_corrections,
    classify_category_with_context,
    classify_document_type_with_context,
    normalize_item_name_with_context,
    normalize_payment_with_context,
)


_RECEIPT_RULES = get_receipt_rules()
_CATEGORY_RULES = get_expense_category_rules()

DATE_PATTERNS = [
    re.compile(r"(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})"),
    re.compile(r"(20\d{2})(\d{2})(\d{2})"),
    re.compile(r"(\d{2})\s*년\s*(\d{1,2})\s*월?\s*(\d{1,2})"),
]

BUSINESS_NO_PATTERN = re.compile(r"(?<!\d)(\d{3})[-\s]?(\d{2})[-\s]?(\d{5})(?!\d)")
MONEY_PATTERN = re.compile(r"(?<!\d)(\d{4,6}\.\d{2}|\d{1,3}(?:[,\.]\d{3})+|\d{3,8})\s*원?(?!\d)")

TOTAL_LABELS = _RECEIPT_RULES.get("total_labels") or ["합계", "총계", "총액", "판매합계", "받을금액", "받은금액", "결제금액", "승인금액", "청구금액", "실결제", "총매출액", "영수액", "영수금액", "갑세", "갑 세", "합세", "할계금액", "합계글액"]
for _label in ["합계금액", "합계5금액", "합계금액", "합계액", "일계", "일 계", "할계", "할 계", "할거", "합게", "합 계", "총판매금액"]:
    if _label not in TOTAL_LABELS:
        TOTAL_LABELS.append(_label)
TAX_LABELS = _RECEIPT_RULES.get("tax_labels") or ["부가세", "부 가 세", "부가", "YIC", "세액"]
SUPPLY_LABELS = _RECEIPT_RULES.get("supply_labels") or ["공급가액", "공급가", "공 급가", "물품가액", "과세금액", "과세합계", "커C큰운"]
for _label in ["과세합계", "과세 합계", "과세금액"]:
    if _label not in SUPPLY_LABELS:
        SUPPLY_LABELS.append(_label)
PAYMENT_KEYWORDS = _RECEIPT_RULES.get("payment_keywords") or ["카드", "신용", "체크", "간편결제", "현금"]
DISCOUNT_LABELS = _RECEIPT_RULES.get("discount_labels") or ["사용포인트", "포인트사용", "포인트", "할인", "할인금액", "쿠폰", "에누리"]
_DEFAULT_VENDOR_BAD_KEYWORDS = [
    "영수증", "매출전표", "사업자", "사업자번호", "사업자등록번호", "주소", "전화", "대표",
    "상품", "상품명", "제품명", "품명", "수량", "단가", "금액", "번호", "합계", "총액",
    "부가세", "공급가", "공급가액", "카드", "승인", "일시불", "고객", "문의", "환불",
    "교환", "감사", "포인트", "멤버십", "스탬프", "스탭프", "테이블", "테이블명",
    "판매시간", "판매사원", "주문자", "고객수", "받을금액", "받은금액", "결제금액",
]

# 문서 제목/정산 메타 라인은 상호가 아니다.
# DB receipt_rules.vendor_bad_keywords가 있어도 아래 안전망 키워드는 항상 병합한다.
_VENDOR_DOCUMENT_TITLE_BAD_KEYWORDS = [
    "중간계산", "중간계산서", "숲간계산서", "계산서", "간이영수증", "카드영수증", "현금영수증",
    "카드매출전표", "신용승인", "승인전표", "거래명세서", "거래명세표", "주문서", "접수증",
    "판매영수증", "매출영수증", "영수증서", "전표번호", "전표출력",
]

VENDOR_BAD_KEYWORDS: list[str] = []
for _keyword in (_RECEIPT_RULES.get("vendor_bad_keywords") or []) + _DEFAULT_VENDOR_BAD_KEYWORDS + _VENDOR_DOCUMENT_TITLE_BAD_KEYWORDS:
    _key = str(_keyword or "").strip()
    if _key and _key not in VENDOR_BAD_KEYWORDS:
        VENDOR_BAD_KEYWORDS.append(_key)
VENDOR_ITEM_NOISE_PATTERN = re.compile(r"a^")  # 특정 품목명 사전 금지. 구조/메타 키워드로만 제외한다.

CATEGORY_HINTS = [(item.get("code"), item.get("keywords") or []) for item in (_CATEGORY_RULES.get("categories") or [])]
if not CATEGORY_HINTS:
    CATEGORY_HINTS = []


def normalize_lines(text: str | None) -> list[str]:
    lines: list[str] = []
    for raw in str(text or "").replace("\r", "\n").split("\n"):
        line = clean_text(raw)
        if line:
            lines.append(line)
    return lines


def clean_text(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("₩", "").replace("￦", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def to_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    text = str(value).strip()
    text = text.translate(str.maketrans({"O": "0", "o": "0", "A": "0", "a": "0", "I": "1", "l": "1", "|": "1"}))
    text = text.replace(",", "")
    # OCR이 117,269를 1172.69처럼 읽는 경우: 라벨 기반 금액에서는 점을 천단위 구분자로 보고 제거한다.
    if re.fullmatch(r"\d{1,6}\.\d{2,3}", text):
        text = text.replace(".", "")
    text = re.sub(r"[^0-9\-]", "", text)
    if not text or text == "-":
        return None
    try:
        number = float(text)
    except Exception:
        return None
    if number <= 0 or number >= 100_000_000:
        return None
    return number


def looks_like_identifier_line(line: str) -> bool:
    compact = re.sub(r"\s+", "", str(line or ""))
    lower = compact.lower()
    if not compact:
        return False
    if any(k in lower for k in ["tel", "phone", "카드번호", "승인번호", "거래번호", "주문번호", "멤버십", "적립", "포인트", "사업자", "대표", "주소", "번호:", "체번호"]):
        return True
    if re.search(r"[가-힣0-9]+로\d*|[가-힣0-9]+길\d*|번길|\d+층", compact):
        return True
    # 전화번호/사업자번호/카드/승인번호/날짜처럼 긴 숫자열은 금액 후보가 아니다.
    digits = re.sub(r"\D", "", compact)
    if len(digits) >= 7 and not re.search(r"[,\.]\d{3}|원|금액|합계|결제|판매|받은|영수|운임|요금", compact):
        return True
    if re.search(r"\d{2,4}-\d{2,4}-\d{4}|\d{3}-\d{2}-\d{5}", compact):
        return True
    return False


def extract_money_values(line: str) -> list[float]:
    if looks_like_identifier_line(line):
        return []
    values: list[float] = []
    for m in MONEY_PATTERN.finditer(line or ""):
        raw = m.group(1)
        raw_digits = re.sub(r"\D", "", raw)
        # 콤마/점 없는 6자리 이상 숫자는 대부분 승인번호/거래번호/카드번호다.
        # 소액 총액은 보통 3~5자리이고, 6자리 이상 총액은 원/금액/합계 같은 라벨이 있어야 신뢰한다.
        if len(raw_digits) >= 6 and not re.search(r"[,\.]|원|금액|합계|결제|판매|받은|영수|운임|요금", str(line or "")):
            continue
        # 단순 숫자 3자리 미만/주소 조각은 총액 후보로 쓰지 않는다. 세액 327 등은 TAX_LABELS에서 별도로만 다룬다.
        if len(raw_digits) <= 3 and not re.search(r"[,\.]|원|금액|합계|결제|판매|받은|영수|운임|요금", str(line or "")):
            continue
        number = to_number(raw)
        if number is not None:
            values.append(number)
    return values


def _fix_ocr_date_part(value: int, max_value: int) -> int | None:
    """OCR이 0을 6/8/9로 읽은 날짜 조각을 보수적으로 보정한다.

    예: 86월 -> 06월, 85일 -> 05일.
    단, 보정 후에도 실제 월/일 범위를 벗어나면 폐기한다.
    """
    if 1 <= value <= max_value:
        return value
    text = f"{value:02d}"
    candidates: list[int] = []
    if len(text) == 2 and text[0] in {"6", "8", "9"}:
        candidates.append(int("0" + text[1]))
    if len(text) == 2 and text[1] in {"6", "8", "9"}:
        candidates.append(int(text[0] + "0"))
    for candidate in candidates:
        if 1 <= candidate <= max_value:
            return candidate
    return None


def _normalize_ocr_date_parts(year: int, month: int, day: int) -> tuple[str | None, bool]:
    month_fixed = _fix_ocr_date_part(month, 12)
    day_fixed = _fix_ocr_date_part(day, 31)
    if month_fixed is None or day_fixed is None:
        return None, False
    try:
        normalized_date = date(year, month_fixed, day_fixed)
    except Exception:
        return None, False
    corrected = month_fixed != month or day_fixed != day
    return normalized_date.isoformat(), corrected


def split_concatenated_amounts(line: str) -> list[float]:
    """OCR이 금액을 붙여 읽은 값을 분리한다.

    예:
    - 28,1812.819 -> 28,181 / 2,819
    - 판매합계 3,000273 -> 3,000 / 273
    """
    values: list[float] = []
    text = str(line or "")
    for m in re.finditer(r"(?<!\d)(\d{1,3}[,.]\d{3})(\d{1,3}[,.]\d{3})(?!\d)", text):
        for raw in m.groups():
            number = to_number(raw)
            if number is not None:
                values.append(number)
    for m in re.finditer(r"(?<!\d)(\d{1,3}[,.]\d{3})(\d{1,3})(?!\d)", text):
        first, tail = m.groups()
        first_num = to_number(first)
        tail_num = to_number(tail)
        if first_num is not None:
            values.append(first_num)
        if tail_num is not None and 0 < tail_num < 1000:
            values.append(tail_num)
    return values




def has_total_label(compact_text: str) -> bool:
    """총액/합계 라벨 OCR 변형을 보수적으로 인식한다."""
    c = re.sub(r"\s+", "", str(compact_text or ""))
    if not c:
        return False
    normalized = c.translate(str.maketrans({"5": "", "S": "", "s": "", "O": "0", "o": "0"}))
    if any(label and label in c for label in TOTAL_LABELS):
        return True
    if "합계" in c and any(k in c for k in ["금액", "액", "계"]):
        return True
    if "총" in c and any(k in c for k in ["금액", "액", "계", "매출"]):
        return True
    if re.search(r"합.?계", c) and re.search(r"금.?액|액", c):
        return True
    if re.search(r"할.?계|할.?거|일.?계", c) and re.search(r"\d", c):
        return True
    if any(k in normalized for k in ["합계금액", "합계액", "총액", "총계", "받은금액", "받을금액"]):
        return True
    return False


def parse_malformed_money_values(line: str) -> list[float]:
    """92,'2U0 / 160,0000 같은 OCR 깨짐 금액을 라벨 문맥에서만 복원한다."""
    text = str(line or "")
    compact = re.sub(r"\s+", "", text)
    label_context = bool(re.search(r"합계|총액|금액|결제|승인|받은|받을|영수|공급대가|일계|할계|할거", compact))
    has_broken_money = bool(re.search(r"\d{1,3}\s*[,.'’`~\-\s]{1,3}\s*[0-9OoUuDdIl|]{2,4}", text))
    if not label_context and not has_broken_money:
        return []

    values: list[float] = []
    trans = str.maketrans({"O": "0", "o": "0", "U": "0", "u": "0", "D": "0", "d": "0", "I": "1", "l": "1", "|": "1"})
    patterns = [
        # 92,'2U0, 83, 821, 160,0000 등. 라벨 문맥에서만 보수적으로 복원한다.
        r"(?<!\d)(\d{1,3}\s*[,.'’`~\-\s]{1,3}\s*[0-9OoUuDdIl|]{2,5})(?!\d)",
    ]
    for pattern in patterns:
        for raw in re.findall(pattern, text):
            cleaned = raw.translate(trans)
            digits = re.sub(r"\D", "", cleaned)
            if len(digits) < 4 or len(digits) >= 8:
                continue
            try:
                number = float(int(digits))
            except Exception:
                continue
            if 0 < number < 10_000_000 and number not in values:
                values.append(number)
    return values


def extract_label_money_values(line: str) -> list[float]:
    values = extract_money_values(line)
    for value in parse_malformed_money_values(line):
        if value not in values:
            values.append(value)
    return values


def strip_vendor_label(text: str) -> str:
    value = clean_text(text)
    if not value:
        return ""
    # [매장명]월간나주혁신도시점, 상호 수연사 성명 현영관 등 라벨 제거
    value = re.sub(r"^\s*[\[\(【]?(매장명|가맹점명|상호명|상호|업체명|상\s*호)[\]\)】]?\s*[:：]?\s*", "", value, flags=re.I).strip()
    value = re.split(r"\s+(성명|대표자|사업장|주소|전화|TEL)\b", value, maxsplit=1, flags=re.I)[0].strip()
    return value.strip(" :-/[]")


def _vendor_compact(value: Any) -> str:
    return re.sub(r"[\s\[\]\(\){}【】<>:：,._\-|/\\'\"`·]+", "", str(value or "")).lower()


def is_vendor_excluded_line(value: Any) -> bool:
    """사용처 후보에서 제외할 문서 제목/정산 메타/금액 라인을 판별한다."""
    text = clean_text(value)
    if not text:
        return True

    compact = _vendor_compact(text)
    if not compact:
        return True

    # [중간계산], [중간계산서77]처럼 제목 뒤에 OCR 잡음/짧은 숫자가 붙은 경우까지 제외한다.
    for keyword in _VENDOR_DOCUMENT_TITLE_BAD_KEYWORDS:
        key = _vendor_compact(keyword)
        if not key:
            continue
        if compact == key:
            return True
        if compact.startswith(key) and len(compact) <= len(key) + 4:
            return True

    # DB/기본 제외 키워드 포함 라인은 상호 후보가 아니다.
    if any(_vendor_compact(keyword) and _vendor_compact(keyword) in compact for keyword in VENDOR_BAD_KEYWORDS):
        return True

    # 숫자/식별자/금액/주소성 라인은 사용처 후보에서 제외한다.
    if looks_like_identifier_line(text):
        return True
    if extract_money_values(text):
        return True
    if re.search(r"\d{2,}|@|www|http|\.com", compact, re.I):
        return True
    if re.search(r"[가-힣0-9]+로\d*|[가-힣0-9]+길\d*|번길|상가동|\d+층|\d+호", compact):
        return True

    return False

def extract_date(text: str | None) -> str | None:
    """영수증 날짜 후보를 수집한 뒤 정상성/반복 빈도 기준으로 선택한다."""
    s = str(text or "")
    candidates: list[dict[str, Any]] = []

    for pattern in DATE_PATTERNS:
        for m in pattern.finditer(s):
            try:
                y, mo, d = m.groups()
                year = int(y)
                if year < 100:
                    year += 2000
                normalized, corrected = _normalize_ocr_date_parts(year, int(mo), int(d))
                if not normalized:
                    continue
                candidates.append({
                    "date": normalized,
                    "raw": m.group(0),
                    "start": m.start(),
                    "end": m.end(),
                    "corrected": corrected,
                })
            except Exception:
                continue

    if not candidates:
        return None

    today = date.today()
    grouped: dict[str, dict[str, Any]] = {}
    for item in candidates:
        key = item["date"]
        bucket = grouped.setdefault(key, {"date": key, "count": 0, "score": 0.0, "positions": []})
        bucket["count"] += 1
        bucket["score"] += 0.72 if item.get("corrected") else 1.0
        bucket["positions"].append(item["start"])

        tail = s[item["end"]: item["end"] + 12]
        if re.search(r"\d{1,2}:\d{2}", tail):
            bucket["score"] += 0.8

        try:
            y, m, d = [int(x) for x in key.split("-")]
            candidate_date = date(y, m, d)
            if candidate_date > today:
                days_future = (candidate_date - today).days
                if days_future > 30:
                    bucket["score"] -= 1.2
        except Exception:
            pass

    best = sorted(grouped.values(), key=lambda x: (x["score"], x["count"], -min(x["positions"])), reverse=True)[0]
    return best["date"]

def extract_business_number(text: str | None) -> str | None:
    m = BUSINESS_NO_PATTERN.search(str(text or ""))
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"


def should_skip_tax_value_on_supply_line(compact: str) -> bool:
    """세액 추출 중 공급가/과세 물품가액 라인을 부가세로 오인하지 않게 한다."""
    c = re.sub(r"\s+", "", str(compact or ""))
    if not c:
        return False
    has_supply_context = bool(re.search(r"물품가액|공급가액|공급가|과세금액|과세합계|과세", c))
    has_explicit_tax_amount = bool(re.search(r"부가세액|부가가치세|세액", c))
    # `부가세 과세 물품가액: 28,181`처럼 헤더/공급가 라인에 부가세 단어가 붙는 OCR 방어.
    return has_supply_context and not has_explicit_tax_amount


def amount_after_labels(lines: list[str], labels: list[str]) -> tuple[float | None, str | None]:
    label_compacts = [re.sub(r"\s+", "", x) for x in labels]
    is_tax_like = any(x in {"부가세", "부가", "YIC", "Y1C", "세액"} for x in label_compacts)
    is_supply_like = any(x in {"공급가액", "공급가", "공급가", "물품가액", "과세금액", "과세합계"} for x in label_compacts)
    stop_labels = ["합계", "총매출", "받은금액", "받을금액", "결제", "승인", "카드번호", "공급가", "물품가액", "과세", "부가세", "세액"]
    for i, line in enumerate(lines):
        compact = re.sub(r"\s+", "", line)
        if not any(label in compact for label in label_compacts):
            continue
        concatenated = split_concatenated_amounts(line)
        if concatenated:
            if is_tax_like:
                return concatenated[-1], line
            if is_supply_like:
                return concatenated[0], line
        vals = loose_amount_values(line) if is_tax_like else extract_label_money_values(line)
        if vals:
            if is_tax_like and should_skip_tax_value_on_supply_line(compact):
                pass
            else:
                return vals[-1], line
        for nxt in lines[i + 1:i + 4]:
            nxt_compact = re.sub(r"\s+", "", nxt)
            if any(k in nxt_compact for k in stop_labels):
                break
            concatenated = split_concatenated_amounts(nxt)
            if concatenated:
                if is_tax_like:
                    return concatenated[-1], f"{line} -> {nxt}"
                if is_supply_like:
                    return concatenated[0], f"{line} -> {nxt}"
            vals = loose_amount_values(nxt) if is_tax_like else extract_label_money_values(nxt)
            if vals:
                return vals[-1], f"{line} -> {nxt}"
    return None, None




def amount_after_paid_labels(lines: list[str]) -> tuple[float | None, str | None]:
    """실제 지출/결제 금액 후보를 우선 추출한다.

    카드 승인금액 근처에 공급가/부가세 라인이 붙어 있는 경우, OCR이 공급가를 결제금액으로
    오인하기 쉬우므로 총액 라벨/품목합계 검증으로 넘긴다.
    """
    priority_groups = [
        ["승인금액", "결제금액", "실결제금액", "카드결제", "간편결제", "토스페이머니", "머니/계좌"],
        ["받은금액", "받을금액", "제금액", "영수액", "영수금액"],
    ]
    tax_context_pattern = re.compile(r"공급가|물품가액|과세|부가세|부가|가세|세액")
    for paid_labels in priority_groups:
        for i, line in enumerate(lines):
            compact = re.sub(r"\s+", "", line)
            if not any(label in compact for label in paid_labels):
                continue
            nearby = "".join(re.sub(r"\s+", "", x) for x in lines[i:i + 3])
            if tax_context_pattern.search(nearby):
                continue
            concatenated = split_concatenated_amounts(line)
            if concatenated:
                return concatenated[-1], line
            vals = extract_label_money_values(line)
            if vals:
                return vals[-1], line
            for nxt in lines[i + 1:i + 4]:
                nxt_compact = re.sub(r"\s+", "", nxt)
                if tax_context_pattern.search(nxt_compact) or any(k in nxt_compact for k in ["멤버십", "포인트"]):
                    break
                vals = extract_label_money_values(nxt)
                if vals:
                    return vals[-1], f"{line} -> {nxt}"

    # '판매' / '카드/간편결제' / 금액처럼 라벨이 분리되는 경우
    for i, line in enumerate(lines):
        compact = re.sub(r"\s+", "", line)
        if compact not in {"판매", "결제", "결제수단"}:
            continue
        window = lines[i + 1:i + 6]
        if not any("카드" in re.sub(r"\s+", "", x) or "간편결제" in re.sub(r"\s+", "", x) for x in window):
            continue
        for nxt in window:
            vals = extract_label_money_values(nxt)
            if vals:
                return vals[-1], f"{line} -> {nxt}"
    return None, None


def extract_gross_total_amount(lines: list[str]) -> tuple[float | None, str | None]:
    """품목 합계용 판매총액 후보. 실제 결제금액/할인/과세표준과 구분한다."""
    labels = ["합계금액", "합계글액", "할계금액", "총매출액", "층매출액", "판매합계", "판매합계액", "총계", "총액", "합계", "갑세"]
    stop_labels = ["받은금액", "받을금액", "결제", "승인", "카드", "부가세", "세액", "포인트", "할인", "멤버십"]
    for i, line in enumerate(lines):
        compact = re.sub(r"\s+", "", line)
        if "I합계" in compact or "과세합계" in compact or "과세금액" in compact:
            continue
        if not any(label in compact for label in labels) and not has_total_label(compact):
            continue
        concatenated = split_concatenated_amounts(line)
        if concatenated:
            return max(concatenated), line
        vals = extract_label_money_values(line)
        if vals:
            return vals[-1], line
        # 영수증 OCR에서 10,190 다음 줄에 총매출액 라벨만 따로 나오는 경우가 있다.
        # 단, 현재 합계 라인에 숫자가 있는데 파싱 실패한 경우에는 이전 품목 금액을 총액으로 가져오지 않는다.
        if i > 0 and not re.search(r"\d", compact):
            prev_vals = extract_label_money_values(lines[i - 1])
            prev_compact = re.sub(r"\s+", "", lines[i - 1])
            if prev_vals and not any(k in prev_compact for k in stop_labels):
                return prev_vals[-1], f"{lines[i - 1]} <- {line}"
        for nxt in lines[i + 1:i + 4]:
            nxt_compact = re.sub(r"\s+", "", nxt)
            if any(k in nxt_compact for k in stop_labels):
                break
            vals = extract_label_money_values(nxt)
            if vals:
                return vals[-1], f"{line} -> {nxt}"
    return None, None


def infer_total_from_items_and_tax(
    total_amount: float | None,
    total_source: str | None,
    items: list[dict[str, Any]],
    supply_amount: float | None,
    tax_amount: float | None,
    discount_amount: float | None = None,
) -> tuple[float | None, str | None]:
    """OCR 오독 총액 보정. 공급가+부가세/품목합계가 더 강한 경우 총액을 교정한다."""
    item_sum = sum(float(to_number(item.get("amount")) or 0) for item in items or [])
    tax_sum = None
    if supply_amount is not None and tax_amount is not None:
        tax_sum = float(supply_amount) + float(tax_amount)
    has_discount = bool(discount_amount and discount_amount > 0)

    if item_sum > 0 and tax_sum is not None and abs(item_sum - tax_sum) <= max(10, tax_sum * 0.01):
        if total_amount is None:
            return round(item_sum), "item_sum_matches_supply_tax"
        if abs(float(total_amount) - item_sum) <= max(1000, item_sum * 0.04):
            return round(item_sum), "corrected_by_item_sum_and_supply_tax"

    # 예: OCR 후보가 카드결제 31,800으로 깨졌지만 공급가 28,181 + 부가세 2,819 = 31,000인 경우.
    # 할인 라인이 있어도 공급가+부가세는 실제 결제/매출 세액 합계와 맞는 경우가 많으므로,
    # 현재 총액 후보가 세금 합계와 근접하면 세금 합계를 우선한다.
    if tax_sum is not None:
        if total_amount is None:
            return round(tax_sum), "supply_tax_sum"
        if abs(float(total_amount) - tax_sum) <= max(1200, tax_sum * 0.05):
            return round(tax_sum), "corrected_by_supply_tax_sum"

    if item_sum > 0 and total_source == "max_money_fallback" and (total_amount is None or float(total_amount) > item_sum * 1.3):
        return round(item_sum), "corrected_by_item_sum_from_bad_max_fallback"

    return total_amount, total_source

def loose_amount_values(line: str) -> list[float]:
    """할인/포인트/세액 전용 느슨한 금액 추출. 50/100/926 같은 소액도 허용한다."""
    values: list[float] = []
    text = str(line or "")
    for m in re.finditer(r"(?<!\d)(\d{1,3})\s*천\s*원?", text):
        values.append(float(int(m.group(1)) * 1000))
    for raw in re.findall(r"(?<!\d)(\d{1,3}(?:[,\.]\d{3})+|\d{1,7})(?!\d)", text):
        number = to_number(raw)
        if number is not None and 0 < number < 10_000_000:
            values.append(number)
    return values


def extract_discount_amount(lines: list[str]) -> tuple[float | None, str | None]:
    """포인트/할인/쿠폰처럼 판매합계와 실제 결제금액 차이를 만드는 금액을 추출한다."""
    for i, line in enumerate(lines):
        compact = re.sub(r"\s+", "", line)
        if any(k in compact for k in ["적립포인트", "가용포인트", "적립대상", "멤버십번호", "상품명", "제품명", "품명", "수량", "포인트카드", "카드/간편결제", "간편결제", "승인금액"]):
            continue
        if not any(label in compact for label in DISCOUNT_LABELS):
            continue
        vals = loose_amount_values(line)
        if vals:
            if not re.search(r"[-−]|포인트|쿠폰|에누리|할인금액|할인결제|천원할인", compact):
                continue
            return max(vals), line
        # 실제 할인 라벨이 있는 경우에만 다음 줄 금액을 본다.
        if not re.search(r"포인트|쿠폰|에누리|할인금액|할인결제|천원할인", compact):
            continue
        for nxt in lines[i + 1:i + 3]:
            nxt_compact = re.sub(r"\s+", "", nxt)
            if any(k in nxt_compact for k in ["적립", "가용", "승인", "카드", "멤버십", "상품명", "수량"]):
                break
            vals = loose_amount_values(nxt)
            if vals:
                return max(vals), f"{line} -> {nxt}"
    return None, None

def extract_total_amount(lines: list[str]) -> tuple[float | None, str | None]:
    # 실제 지출/결제 금액 우선
    paid, paid_src = amount_after_paid_labels(lines)
    if paid is not None:
        return paid, paid_src

    # 단독 '계' / '합계' 다음 금액. 카페/소형 POS에서 자주 나오는 구조.
    for i, line in enumerate(lines):
        compact = re.sub(r"\s+", "", line)
        if compact in {"계", "합계", "총계", "총액", "일계", "할계", "할거"}:
            for nxt in lines[i + 1:i + 4]:
                nxt_compact = re.sub(r"\s+", "", nxt)
                if any(k in nxt_compact for k in ["카드번호", "승인번호", "전화", "TEL", "포인트", "적립"]):
                    break
                vals = extract_label_money_values(nxt)
                if vals:
                    return vals[-1], f"{line} -> {nxt}"

    # 그 다음 총액/합계. 단, 과세표준 영역의 'I 합계 2,727' 같은 라벨은 제외
    for i, line in enumerate(lines):
        compact = re.sub(r"\s+", "", line)
        if "I합계" in compact or "과세합계" in compact:
            continue
        if not has_total_label(compact):
            continue
        concatenated = split_concatenated_amounts(line)
        if concatenated:
            return max(concatenated), line
        vals = extract_label_money_values(line)
        if vals:
            return vals[-1], line
        for nxt in lines[i + 1:i + 4]:
            nxt_compact = re.sub(r"\s+", "", nxt)
            if any(k in nxt_compact for k in ["부가세", "세액", "포인트", "승인번호", "카드번호", "전화"]):
                break
            vals = extract_label_money_values(nxt)
            if vals:
                return vals[-1], f"{line} -> {nxt}"

    values: list[float] = []
    for line in lines:
        compact = re.sub(r"\s+", "", line)
        if any(k in compact for k in ["사업자", "전화", "TEL", "승인번호", "카드번호", "거래번호", "주문번호", "적립", "포인트", "멤버십", "번호:", "체번호"]):
            continue
        vals = extract_money_values(line)
        # fallback에서는 너무 큰 무라벨 금액을 제외한다. 영수증 소액 처리에서 승인/거래번호 오인 방지.
        values.extend([v for v in vals if 10 <= v <= 5_000_000])
    if not values:
        return None, None
    return max(values), "max_money_fallback"

def extract_payment_method(text: str | None) -> str | None:
    s = str(text or "")
    if "현금" in s:
        return "현금"
    if any(k in s for k in ["간편결제"]):
        return "간편결제"
    if any(k in s for k in ["카드", "신용", "체크", "승인"]):
        return "카드/간편결제"
    return None


def extract_vendor_name(lines: list[str], reference_context: dict[str, Any] | None = None) -> str | None:
    """상단 OCR 라인에서 사용처/상호를 보수적으로 고른다.

    원칙:
    - 상품명/제품명 영역이 시작되면 그 아래 줄은 절대 사용처로 보지 않는다.
    - 품목명/금액/세금/결제/주소/전화 라인은 사용처에서 제외한다.
    - 주소 라인에 상호가 붙어 있는 경우에는 보정 사전/정규화 규칙으로 상호만 살린다.
    - 확실한 사용처가 없으면 품목명을 사용처로 대체하지 않고 None으로 둔다.
    """
    candidates: list[tuple[float, str]] = []
    for idx, line in enumerate(lines[:28]):
        text = strip_vendor_label(clean_text(line))
        compact = re.sub(r"\s+", "", text)
        lower = compact.lower()
        if not text or len(compact) < 2:
            continue

        if is_vendor_excluded_line(text):
            continue

        # 상품 영역 아래는 상호 후보가 아니다. LLM/룰이 품목명을 사용처로 올리는 핵심 원인 차단.
        if any(k in compact for k in ["상품명", "제품명", "품명", "수량"]):
            break
        if any(k in compact for k in ["합계", "총액", "판매", "결제", "승인", "부가세", "공급가액", "공급가", "과세"]):
            break

        # 사업자번호/TEL이 상호와 같은 줄에 붙은 OCR을 분리한다.
        # 예: "상호명123-45-67890TEL..." -> "상호명"
        split_vendor = re.split(r"\d{3}[-\s]?\d{2}[-\s]?\d{5}|TEL|Tel|tel|전화", text, maxsplit=1)[0].strip(" :-/\t")
        if split_vendor and split_vendor != text and 2 <= len(re.sub(r"\s+", "", split_vendor)) <= 30:
            split_norm = normalize_vendor_name(split_vendor, reference_context)
            split_norm_name = split_norm.get("normalized") or split_vendor
            split_compact = re.sub(r"\s+", "", str(split_norm_name))
            if (
                split_norm_name
                and len(re.findall(r"[가-힣A-Za-z]", str(split_norm_name))) >= 2
                and not is_vendor_excluded_line(split_norm_name)
                and not is_bad_vendor_candidate(str(split_norm_name))
            ):
                return str(split_norm_name).strip()

        # 먼저 사전/정규화로 상호가 포함되어 있는지 확인한다.
        norm = normalize_vendor_name(text, reference_context)
        norm_name = norm.get("normalized")
        norm_conf = float(norm.get("confidence") or 0)
        if norm_name and norm_conf >= 0.85 and not is_vendor_excluded_line(norm_name) and not is_bad_vendor_candidate(norm_name):
            return str(norm_name).strip()

        # 아래는 원문 라인 자체를 상호로 쓸 수 있는지 판단한다.
        if len(compact) > 42:
            continue
        if re.fullmatch(r"[\[\]0-9A-Za-z\-_.:]+", compact):
            continue
        if is_vendor_excluded_line(text):
            continue
        if VENDOR_ITEM_NOISE_PATTERN.search(text):
            continue
        if extract_money_values(text):
            continue
        if re.search(r"\d{2,}|@|www|http|\.com", compact, re.I):
            continue
        if len(compact) <= 2 and not re.search(r"[가-힣]{2,}", compact):
            continue
        if re.fullmatch(r"[A-Za-z\s]+", text) and len(text) < 4:
            continue
        if re.search(r"[가-힣0-9]+로\d*|[가-힣0-9]+길\d*|번길|상가동|층", compact):
            continue

        score = 100 - idx
        if any(k in text for k in ["㈜", "주식회사", "점", "마트", "매장", "상점", "상회", "상사", "센터", "가게"]):
            score += 40
        if re.fullmatch(r"[가-힣A-Za-z ]{3,20}", text):
            score += 20
        candidates.append((score, text))

    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0], reverse=True)
    selected = candidates[0][1]
    if not selected or is_vendor_excluded_line(selected) or is_bad_vendor_candidate(selected):
        return None
    return selected.strip()

def classify_document_type(text: str | None, requested: str | None = None, reference_context: dict[str, Any] | None = None) -> str:
    req = (requested or "").strip().upper()
    if req and req not in {"RECEIPT", "영수증"}:
        return req
    if is_handwritten_receipt_text(text):
        return "HANDWRITTEN_FORM_RECEIPT"
    if is_transport_text(text):
        return "TRANSPORT_RECEIPT"
    context_type = classify_document_type_with_context(text, requested, reference_context)
    if context_type:
        return context_type
    return "RECEIPT"


def looks_like_meal_receipt(text: str | None) -> bool:
    """음식점/카페/베이커리 POS 영수증을 보수적으로 식비로 분류한다.

    특정 상호명에 의존하지 않고 음식·음료·주류 메뉴 단어와 POS 문맥을 함께 본다.
    주류가 포함되어도 음식점 메뉴와 함께 결제된 경우 카테고리는 식비로 두고,
    상세 품목 메모에서 `주류 포함`을 표시한다.
    """
    s = str(text or "")
    compacted = re.sub(r"\s+", "", s)
    food_terms = [
        "피자", "파스타", "감바스", "샐러드", "버거", "샌드", "샌드위치", "베이커리", "빵",
        "갈비", "프렌치랙", "양갈비", "삼겹", "고기", "김치", "전", "마늘밥", "밥", "국밥",
        "우동", "라멘", "면", "찌개", "탕", "커피", "라떼", "아메리카노", "카페",
        "소주", "맥주", "참이슬", "하이볼", "와인", "막걸리", "코젤", "음료", "주류",
    ]
    hit_count = sum(1 for term in food_terms if term.lower() in compacted.lower())
    pos_context = bool(re.search(r"상품명|메뉴|테이블|홀|단가|수량|금액|판매시간|매출일", compacted))
    restaurant_context = bool(re.search(r"식당|분식|전집|카페|커피|베이커리|파리바게|치킨|피자|고기|갈비", compacted))
    if hit_count >= 2:
        return True
    if hit_count >= 1 and (pos_context or restaurant_context):
        return True
    return False


def classify_category(text: str | None, document_type: str | None = None, reference_context: dict[str, Any] | None = None) -> tuple[str, str]:
    s = str(text or "")
    doc = str(document_type or "").upper()
    if "TRANSPORT" in doc or is_transport_text(s):
        return "TRANSPORT", "교통비"
    context_category = classify_category_with_context(s, document_type, reference_context)
    if context_category:
        return context_category
    for code, keywords in CATEGORY_HINTS:
        if any(k.lower() in s.lower() for k in keywords):
            return code, CATEGORY_CODE_TO_NAME.get(code, "기타")
    if looks_like_meal_receipt(s):
        return "MEAL", "식비"
    return "ETC", "기타"


def normalize_items(items: list[dict[str, Any]] | list[Any], *, expense_date: str | None, vendor_name: str | None, category_code: str, category_name: str, reference_context: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """LLM/Rule 품목 후보를 공통 상세 품목 구조로 정규화한다.

    LLM은 가끔 items를 dict 배열이 아니라 문자열 배열로 반환한다.
    기존 코드는 item.get(...)을 바로 호출해서 str 항목에서 500 오류가 났다.
    여기서는 문자열/숫자/None을 모두 방어적으로 처리하고, 문자열 안에
    `상품명 단가수량 금액` 패턴이 있으면 영수증 품목 파서로 한 번 더 복원한다.
    """
    normalized: list[dict[str, Any]] = []

    def coerce_item(value: Any) -> dict[str, Any] | None:
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            text_value = clean_text(value)
            if not text_value:
                return None
            parsed = parse_structured_item_line(text_value)
            if parsed:
                return parsed
            return {"item_name": text_value, "description": text_value}
        return None

    for idx, raw_item in enumerate(items or [], start=1):
        item = coerce_item(raw_item)
        if not item:
            continue

        name = clean_text(item.get("item_name") or item.get("name") or item.get("description") or item.get("item_description"))
        name = normalize_item_name_with_context(name, reference_context)
        amount = to_number(item.get("amount") or item.get("total_amount") or item.get("payment_amount"))
        qty = to_number(item.get("quantity") or item.get("qty") or item.get("count")) or 1
        if qty <= 0:
            qty = 1
        unit_price = to_number(item.get("unit_price") or item.get("unitPrice") or item.get("price"))
        if unit_price is None and amount is not None and qty:
            unit_price = amount / qty

        if not name or amount is None:
            continue

        normalized.append({
            "line_no": idx,
            "item_name": name,
            "description": name,
            "quantity": qty,
            "unit_price": unit_price,
            "amount": amount,
            "expense_date": expense_date,
            "vendor_name": vendor_name,
            "expense_category_code": category_code,
            "expense_category_name": category_name,
        })
    return normalized


def build_rule_result(ocr_text: str | None, document_type: str | None = "RECEIPT", reference_context: dict[str, Any] | None = None) -> dict[str, Any]:
    corrected_ocr_text = apply_reference_text_corrections(ocr_text, reference_context)
    lines = normalize_lines(corrected_ocr_text)
    text = "\n".join(lines)
    final_doc_type = classify_document_type(text, document_type, reference_context)

    if final_doc_type == "HANDWRITTEN_FORM_RECEIPT":
        data = extract_handwritten_receipt(text)
        # OCR 메타/후단 검증에서 그대로 참조할 수 있게 원문 유지
        data["raw_text"] = text
        return data

    if "TRANSPORT" in final_doc_type or is_transport_text(text):
        data = parse_transport_receipt(text)
        data["source"] = "RULE_TRANSPORT"
        data["raw_text"] = text
        data["document_type"] = data.get("document_type") or "TRANSPORT_RECEIPT"
        return data

    expense_date = extract_date(text)
    vendor_name = extract_vendor_name(lines, reference_context)
    vendor_normalization = normalize_vendor_name(vendor_name, reference_context) if vendor_name else {"raw": None, "normalized": None, "changed": False, "source": "EMPTY", "confidence": 0.0}
    raw_vendor_name = vendor_name
    vendor_name = vendor_normalization.get("normalized") or vendor_name
    business_number = extract_business_number(text)
    total_amount, total_source = extract_total_amount(lines)
    supply_amount, supply_source = amount_after_labels(lines, SUPPLY_LABELS)
    tax_amount, tax_source = amount_after_labels(lines, TAX_LABELS)

    # 공급가액은 읽혔지만 부가세가 비어 있는 경우에만 총액-공급가액으로 보정한다.
    # 이미 부가세 후보가 있으면 OCR 총액 오독(31,800 vs 실제 31,000) 때문에 세액을 덮어쓰지 않는다.
    if tax_amount is None and total_amount is not None and supply_amount is not None:
        inferred_tax = float(total_amount) - float(supply_amount)
        if inferred_tax > 0 and inferred_tax <= max(float(total_amount) * 0.2, 100_000):
            tax_amount = round(inferred_tax)
            tax_source = "total_minus_supply_inferred"

    payment_method = normalize_payment_with_context(extract_payment_method(text), reference_context)
    category_code, category_name = classify_category(text, final_doc_type, reference_context)

    gross_amount, gross_source = extract_gross_total_amount(lines)
    discount_amount, discount_source = extract_discount_amount(lines)
    paid_amount = total_amount
    sale_total_amount = gross_amount
    if sale_total_amount is None and paid_amount is not None and discount_amount is not None:
        sale_total_amount = paid_amount + discount_amount
    item_total_hint = sale_total_amount if sale_total_amount is not None else total_amount
    if supply_amount is not None and tax_amount is not None:
        tax_sum_hint = supply_amount + tax_amount
        if item_total_hint is None or abs(float(item_total_hint) - tax_sum_hint) <= max(1000, tax_sum_hint * 0.05):
            item_total_hint = tax_sum_hint

    items = extract_pos_receipt_items(
        ocr_text=text,
        total_amount=item_total_hint,
        expense_date=expense_date,
        vendor_name=vendor_name,
        payment_method=payment_method,
    )
    items = normalize_items(items, expense_date=expense_date, vendor_name=vendor_name, category_code=category_code, category_name=category_name, reference_context=reference_context)

    total_amount, total_source = infer_total_from_items_and_tax(total_amount, total_source, items, supply_amount, tax_amount, discount_amount)
    if total_amount is not None and total_source in {
        "corrected_by_item_sum_and_supply_tax",
        "item_sum_matches_supply_tax",
        "supply_tax_sum",
        "corrected_by_supply_tax_sum",
        "corrected_by_item_sum_from_bad_max_fallback",
    } and discount_amount in (None, 0):
        if gross_amount is None or abs(float(gross_amount) - float(total_amount)) <= max(1200, float(total_amount) * 0.05):
            gross_amount = total_amount
            sale_total_amount = total_amount
    if total_amount is not None:
        if paid_amount is None:
            paid_amount = total_amount
        elif sale_total_amount is not None and abs(float(total_amount) - float(sale_total_amount)) <= max(1, float(sale_total_amount) * 0.01):
            paid_amount = total_amount
        elif total_source in {
            "corrected_by_item_sum_and_supply_tax",
            "item_sum_matches_supply_tax",
            "supply_tax_sum",
            "corrected_by_supply_tax_sum",
            "corrected_by_item_sum_from_bad_max_fallback",
        }:
            paid_amount = total_amount

    item_description = None
    if items:
        if len(items) == 1:
            item_description = items[0].get("item_name")
        else:
            item_description = f"{items[0].get('item_name')} 외 {len(items) - 1}건"

    review_reasons: list[str] = []
    if total_source == "max_money_fallback":
        review_reasons.append("총액 라벨 없이 가장 큰 금액을 총액 후보로 사용했습니다.")
    if not items and total_amount is not None:
        review_reasons.append("품목 상세를 안정적으로 복원하지 못했습니다.")
    if items:
        item_sum = sum(float(item.get("amount") or 0) for item in items)
        compare_total = gross_amount if gross_amount is not None else total_amount
        if compare_total is not None and round(item_sum) != round(compare_total):
            review_reasons.append(f"품목 합계({int(item_sum)})와 총액({int(compare_total)})이 일치하지 않습니다.")

    return {
        "document_type": final_doc_type,
        "expense_category_code": category_code,
        "expense_category_name": category_name,
        "category": category_name,
        "expense_date": expense_date,
        "vendor_name": vendor_name,
        "raw_vendor_name": raw_vendor_name,
        "normalized_vendor_name": vendor_name,
        "vendor_correction": vendor_normalization,
        "business_number": business_number,
        "item_description": item_description,
        "description": item_description,
        "total_amount": total_amount,
        "claim_amount": paid_amount,
        "paid_amount": paid_amount,
        "gross_amount": gross_amount,
        "sale_total_amount": sale_total_amount,
        "discount_amount": discount_amount,
        "supply_amount": supply_amount,
        "tax_amount": tax_amount,
        "payment_method": payment_method,
        "items": items,
        "detail_items": items,
        "amount_sources": {
            "total": total_source,
            "gross": gross_source,
            "discount": discount_source,
            "supply": supply_source,
            "tax": tax_source,
        },
        "raw_text": text,
        "source": "RULE_FAST",
        "needs_review": bool(review_reasons),
        "review_reason": review_reasons,
        "review_reasons": review_reasons,
    }


def dumps_compact(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"), default=str)
