import itertools
import re
from typing import Any

try:
    from app.services.normalizers.item_normalizer import is_noise_item_name, to_number, clean_text
except Exception:
    def clean_text(value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return re.sub(r"\s+", " ", text) if text else None

    def to_number(value: Any) -> float | None:
        if value is None or value == "":
            return None
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).replace(",", "").replace("원", "").strip()
        text = re.sub(r"[^0-9.\-]", "", text)
        try:
            return float(text) if text else None
        except Exception:
            return None

    def is_noise_item_name(name: Any, **_: Any) -> bool:
        return not bool(clean_text(name))


# 영수증 공통: 품목이 아닌 안내/사업자/정산/홍보 라인
META_KEYWORDS = [
    "영수증", "전표", "재발행", "고객용", "매출전표", "현금영수증", "바코드",
    "사업자", "사업자번호", "대표", "대표자", "전화", "tel", "fax", "주소", "본사", "매장", "가맹점", "점포",
    "교환", "환불", "문의", "고객센터", "인증기업", "소비자중심", "품질경영", "감사합니다",
    "상품명", "제품명", "품명", "수량", "단가", "금액", "할인", "정상", "pos", "p0s", "bill", "cashier",
    "과세", "면세", "부가세", "부 가 세", "공급가액", "공급가", "급가액", "물품가액", "세액", "가액", "판매합계", "합계", "총계", "총액", "받을금액", "받은금액", "총매출액",
    "카드", "카드결제", "간편결제", "토스페이", "머니", "계좌", "승인", "승인번호", "승인금액", "일시불", "할부", "포인트", "멤버십", "적립", "번호", "체번호",
]

PROMO_KEYWORDS = [
    "이벤트", "응모", "응모기간", "행사", "쿠폰", "프로모션", "스탬프", "스탬프", "스탭프", "안내", "할인결제", "직관", "팬미팅", "기회", "참여", "안함", "적립", "보유",
]

OPTION_KEYWORDS = ["옵션", "추가", "단품만", "사이즈", "size", "ice", "hot", "아이스", "리뷰", "참여", "안함", "무료", "증정"]

PRODUCT_HINTS: list[str] = []  # 품목명/상호명 고정 사전 금지: 구조 규칙만 사용
SMALL_ITEM_KEYWORDS: list[str] = []  # 소액 품목도 특정 품목명 대신 구조로 판정


ITEM_END_KEYWORDS = [
    "과세", "면세", "부가세", "공급가액", "공급가", "물품가액", "판매합계", "합계", "갑세", "갑 세", "총매출액", "받을금액", "받은금액", "하은금금", "받든을가", "결제수단", "카드결제", "카드/간편결제", "토스페이", "승인번호", "승인금액", "포인트", "멤버십", "재발행", "재발맹"
]



def is_plausible_small_item_name(name: Any) -> bool:
    """특정 품목명 사전 없이 소액 품목명을 구조적으로 판정한다.

    - 금액/결제/포인트/사업자/주소/전화 등 메타 라인은 제외
    - 한글 또는 영문 품목 텍스트가 2자 이상 있으면 소액 품목 후보로 허용
    """
    text = clean_text(name) or ""
    c = compact(text) if "compact" in globals() else re.sub(r"\s+", "", text)
    if not c:
        return False
    if any(k in c for k in META_KEYWORDS + PROMO_KEYWORDS):
        return False
    if re.search(r"\d{3}-?\d{2}-?\d{5}|\d{2,4}-?\d{3,4}-?\d{4}", c):
        return False
    if re.fullmatch(r"[0-9,.'`~\-:;_/\\()\[\]{}\s]+", text):
        return False
    return bool(re.search(r"[가-힣A-Za-z]{2,}", c))

def extract_pos_receipt_items(
    ocr_text: str,
    total_amount: int | float | None = None,
    expense_date: str | None = None,
    vendor_name: str | None = None,
    payment_method: str | None = None,
) -> list[dict[str, Any]]:
    """
    품목형 영수증 공통 파서.

    핵심 정책:
    - 상단 상호/주소/홍보/이벤트 영역은 품목 후보에서 제외한다.
    - 품목 영역은 상품명/제품명 헤더 또는 POS/날짜 이후부터 합계/부가세/결제 전까지로 자른다.
    - 품목명/수량/단가/금액을 복원하되, 옵션/0원/홍보/결제 라인은 제외한다.
    - OCR이 0을 8/a로 읽은 금액은 총액 검증으로 보정한다. 예: 31.aaa -> 31,000, 16,880 -> 16,000.
    """
    lines = normalize_lines(ocr_text)
    total = to_number(total_amount)

    if not lines:
        return []

    item_lines = slice_item_area(lines)
    if not item_lines:
        item_lines = lines

    candidates: list[dict[str, Any]] = []
    candidates.extend(parse_inline_rows(item_lines, total))
    candidates.extend(parse_code_name_blocks(item_lines, total))
    candidates.extend(parse_name_price_blocks(item_lines, total))
    candidates.extend(parse_two_line_table_blocks(item_lines, total))
    candidates.extend(parse_preceding_amount_small_item_rows(item_lines, total))
    candidates.extend(parse_single_product_receipt(item_lines, total))
    candidates = sort_candidate_items_by_text_order(candidates, item_lines)

    normalized = normalize_candidate_items(
        candidates,
        total_amount=total,
        expense_date=expense_date,
        vendor_name=vendor_name,
        payment_method=payment_method,
    )

    return choose_best_items(normalized, total)


def extract_pos_receipt_item_candidates(
    ocr_text: str,
    total_amount: int | float | None = None,
    expense_date: str | None = None,
    vendor_name: str | None = None,
    payment_method: str | None = None,
) -> list[dict[str, Any]]:
    """검토용 품목 후보 전체를 반환한다.

    `extract_pos_receipt_items`는 자동 입력용 확정 후보를 고르기 위해 부분집합 선택을 수행한다.
    검토 화면에서는 합계 불일치 상황에서도 원문 기반 후보를 보여줘야 하므로,
    여기서는 중복/노이즈 제거까지만 하고 후보를 보존한다.
    """
    lines = normalize_lines(ocr_text)
    total = to_number(total_amount)
    if not lines:
        return []
    item_lines = slice_item_area(lines) or lines
    candidates: list[dict[str, Any]] = []
    candidates.extend(parse_inline_rows(item_lines, total))
    candidates.extend(parse_code_name_blocks(item_lines, total))
    candidates.extend(parse_name_price_blocks(item_lines, total))
    candidates.extend(parse_two_line_table_blocks(item_lines, total))
    candidates.extend(parse_preceding_amount_small_item_rows(item_lines, total))
    candidates.extend(parse_single_product_receipt(item_lines, total))
    candidates = sort_candidate_items_by_text_order(candidates, item_lines)
    return normalize_candidate_items(
        candidates,
        total_amount=total,
        expense_date=expense_date,
        vendor_name=vendor_name,
        payment_method=payment_method,
    )


def normalize_lines(text: str | None) -> list[str]:
    raw = str(text or "").replace("\r", "\n")
    result: list[str] = []
    for line in raw.split("\n"):
        line = normalize_line(line)
        if line:
            result.append(line)
    return result


def normalize_line(line: Any) -> str:
    value = str(line or "").strip()
    value = value.replace("₩", "")
    value = value.replace("│", " ").replace("┃", " ").replace("|", " ")
    value = value.replace("[", " [").replace("]", "] ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def compact(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").strip())


def compare_key(value: Any) -> str:
    return re.sub(r"[\s,._\-:;|/\\()\[\]{}\'\"<>]+", "", str(value or "").lower())


def collapse_ocr_ghost_repeats(value: Any) -> str:
    """품목명 끝의 OCR 반복 꼬리 제거.

    감열지/흐린 이미지에서 `요요요`, `볼볼볼`, `이이이`처럼 마지막 음절이
    반복되는 현상이 자주 발생한다. 특정 영수증 값을 고정하지 않고 반복 패턴만 제거한다.
    """
    text = str(value or "").strip()
    if not text:
        return text
    text = re.sub(r"([가-힣])\1{2,}", r"\1", text)
    for _ in range(4):
        before = text
        text = re.sub(r"([가-힣])\1+$", r"\1", text)
        text = re.sub(r"([가-힣]{2})\1{1,}$", r"\1", text)
        if text == before:
            break
    return text.strip()


def looks_like_same_as_vendor(item_name: Any, vendor_name: Any) -> bool:
    """상호/매장명 라인이 품목명으로 잘못 붙는 것을 방지한다.

    특정 상호를 하드코딩하지 않고, 현재 추출된 vendor_name과 비교한다.
    예: 상호명 다음 줄의 금액을 보고 상호를 품목으로 묶는 오류 차단.
    """
    item_key = compare_key(item_name)
    vendor_key = compare_key(vendor_name)
    if not item_key or not vendor_key or len(vendor_key) < 3:
        return False
    if item_key == vendor_key:
        return True
    # 지점명/괄호가 붙은 상호는 부분 포함으로도 잡되, 실제 상품 힌트가 있으면 살린다.
    if len(item_key) >= 4 and (item_key in vendor_key or vendor_key in item_key) and not has_product_hint(str(item_name or "")):
        return True
    return False


def slice_item_area(lines: list[str]) -> list[str]:
    start = None

    for i, line in enumerate(lines):
        c = compact(line).lower()
        if "상품명" in c or "제품명" in c or "품명" in c:
            start = i + 1
            break

    if start is None:
        # POS/날짜/시간 이후 첫 상품명 후보부터 시작
        anchor = 0
        for i, line in enumerate(lines):
            c = compact(line).lower()
            # 첫 거래일/시간/POS 이후부터 품목 후보를 찾는다.
            # 하단 적립/출력 시간이 다시 나오면 anchor가 하단으로 밀려 품목 영역을 놓치므로 한 번만 설정한다.
            if anchor == 0 and (re.search(r"p[0o]s", c) or "bill" in c or re.search(r"20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}", c)):
                anchor = i + 1
            elif anchor == 0 and re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?", c):
                anchor = i + 1
        for i in range(anchor, len(lines)):
            if extract_item_name(lines[i]) and has_price_nearby(lines, i):
                start = i
                break

    if start is None:
        return []

    end = len(lines)
    for i in range(start, len(lines)):
        if is_item_end_line(lines[i]):
            end = i
            break
    return lines[start:end]


def is_item_end_line(line: str) -> bool:
    c = compact(line)
    if re.search(r"^(할|일계|합계|총계|받은금액|받을금액|결제|신용카드|현금)", c):
        return True
    return any(k in c for k in ITEM_END_KEYWORDS)


def has_price_nearby(lines: list[str], index: int) -> bool:
    for line in lines[index:index + 8]:
        if is_item_end_line(line):
            return False
        if extract_money_numbers(line):
            return True
    return False






def has_meaningful_item_letters(name: Any) -> bool:
    """숫자/수량/OCR 잔여문자가 품목명으로 확정되는 것을 막는다.

    정상 품목명은 최소한 2글자 이상의 한글 연속 토큰 또는 2글자 이상의 영문 연속 토큰을 가진다.
    예: 소주, 맥주, FRESH.
    반대로 `6,000 1개 o`처럼 수량 단위와 OCR 잔여문자만 남은 값은 제외한다.
    """
    text = str(name or "").strip()
    if not text:
        return False
    compacted = re.sub(r"[0-9,.'`~\-:;_/\\()\[\]{}\s]+", "", text)
    compacted = re.sub(r"^(개|EA|ea|x|X)+", "", compacted)
    if re.search(r"[가-힣]{2,}", compacted):
        return True
    english = "".join(re.findall(r"[A-Za-z]", compacted))
    digits = re.findall(r"\d", str(name or ""))
    # 영문만 있는 상품명은 허용하되, 숫자/기호가 섞인 OCR 잡음(HCZ, ZTICR 등)은 제외한다.
    if len(english) >= 2 and not digits:
        return True
    if len(english) >= 4 and len(digits) <= 1:
        return True
    return False

def item_name_penalty(name: Any) -> float:
    """후보 조합 선택용 품목명 위험 점수. 낮을수록 좋다."""
    text = str(name or "").strip()
    c = compact(text)
    if not c:
        return 100.0
    penalty = 0.0
    if not has_meaningful_item_letters(text):
        penalty += 50.0
    if re.search(r"\d{1,3}(?:[,\.]\d{3})+", text):
        penalty += 20.0
    if re.search(r"[^가-힣A-Za-z0-9\s()!+&%./-]", text):
        penalty += 8.0
    letters = len(re.findall(r"[가-힣A-Za-z]", c))
    digits = len(re.findall(r"\d", c))
    if digits and digits >= letters:
        penalty += 15.0
    if re.search(r"(개|ea|EA)[A-Za-z]?$", c) and letters <= 2:
        penalty += 12.0
    return penalty

def parse_structured_item_line(line: str, total_amount: float | None = None) -> dict[str, Any] | None:
    """한 줄 안에 품목명/단가/수량/금액이 같이 들어온 POS 행을 복원한다.

    대응 예:
    - 품목명 20,0002 40,000  -> 단가 20,000 / 수량 2 / 금액 40,000
    - 품목명 5,0007 35,000       -> 단가 5,000 / 수량 7 / 금액 35,000
    - 김치전 12,0001 12,000    -> 단가 12,000 / 수량 1 / 금액 12,000
    - FRESH!한입쏙미니버거 1 7,100
    - FRESH!한입쏙미니버거 7,100 1
    """
    value = normalize_line(line)
    if not value or is_non_item_line(value):
        return None

    # 상품코드 접두 제거: 001, 003NP 등
    value = re.sub(r"^\*?\s*\d{3,8}\s+", "", value).strip()
    # OCR이 상품코드와 단가를 붙여 읽은 케이스: 88002716,080치즈... -> 16,080치즈...
    value = re.sub(r"^\d{4,6}(?=\d{2,3}(?:[,\.]\d{3})+)", "", value).strip()
    value = re.sub(r"^\d{3,8}[A-Za-z]{1,5}\s*(?=[가-힣A-Za-z])", "", value).strip()
    value = re.sub(r"^\[[0-9A-Za-z\-]{3,30}\]\s*", "", value).strip()
    value = re.sub(r"^[-*]+\s*", "", value).strip()

    money = r"\d{1,3}(?:[,\.]\d{3})+"
    # OCR이 라인 끝에 2A / THY / Unb 같은 짧은 잡음을 붙이는 경우 제거한다.
    # 예: 감바스 알 아히요 17,900 1 17,900 2A
    value = re.sub(rf"(?P<amount>{money})\s+[A-Za-z0-9]{{1,4}}\s*$", r"\g<amount>", value).strip()

    # 50/100원 소액 품목은 콤마가 없어서 일반 금액 패턴에서 빠질 수 있다.
    small_match = re.match(r"^(?P<name>.+?)\s+(?P<qty>\d{1,2})\s+(?P<amount>\d{2,3})\s*$", value)
    if small_match:
        small_name = extract_item_name(small_match.group("name"))
        small_amount = parse_amount_text(small_match.group("amount"))
        small_qty = int(small_match.group("qty") or 1)
        if small_name and small_amount is not None and is_plausible_small_item_name(small_name):
            return make_raw_item_with_unit(small_name, small_amount, small_qty, small_amount / max(1, small_qty), source="structured_small_item_row")

    # POS/감열지 OCR에서 단가·수량·금액이 붙어서 읽히는 케이스를 일반 금액 추출보다 먼저 복원한다.
    # 예: 1,00011,000 => 1,000 / 1 / 1,000
    # 예: 3,00013,000 => 3,000 / 1 / 3,000
    attached_amount_patterns = [
        rf"^(?P<name>.+?)\s*(?P<unit>{money})(?P<qty>[1-9]\d?)(?P<amount>{money})\s*$",
        rf"^(?P<name>.+?)\s*(?P<unit>{money})\s*(?P<qty>[1-9]\d?)(?P<amount>{money})\s*$",
    ]
    for pattern in attached_amount_patterns:
        m = re.match(pattern, value)
        if not m:
            continue
        raw_name = m.group("name") or ""
        raw_name = re.sub(r"\[[0-9A-Za-z\-]{3,30}\]", " ", raw_name)
        raw_name = re.sub(r"\([^)]*[0-9A-Za-z/][^)]*$", "", raw_name).strip()
        name = extract_item_name(raw_name)
        if not name or not has_meaningful_item_letters(name):
            continue
        unit = parse_amount_text(m.group("unit"))
        qty = int(m.group("qty") or 1)
        amount = parse_amount_text(m.group("amount"))
        if unit is None or amount is None or not (1 <= qty <= 99):
            continue
        expected = unit * qty
        # 붙은 금액은 11,000처럼 부풀려지는 경우가 많으므로 단가×수량을 우선한다.
        if expected > 0 and (abs(expected - amount) <= max(10, expected * 0.03) or amount > expected * 2):
            amount = expected
        if total_amount is not None and amount > max(total_amount + 100, total_amount * 1.05):
            continue
        if is_option_or_zero(name, amount):
            return None
        return make_raw_item_with_unit(name, amount, qty, unit, source="attached_unit_qty_amount_row")

    patterns = [
        # OCR이 단가를 품목명 앞에 붙인 케이스: 3,000마늘밥 2개 0 6,000
        rf"^(?P<unit>{money})(?P<name>[가-힣A-Za-z].+?)\s+(?P<qty>\d{{1,2}})\s*개?\s+\d{{1,2}}\s+(?P<amount>{money})\s*$",
        # 상품코드+단가가 붙은 OCR 복원 후: 16,080치즈카츠우동세트1 9 16,008
        rf"^(?P<unit>{money})(?P<name>.+?)(?P<qty>\d{{1,2}})?\s+\d{{1,2}}\s+(?P<amount>{money})\s*$",
        # 단가와 수량이 붙은 핵심 케이스: 20,0002 40,000
        rf"^(?P<name>.+?)\s+(?P<unit>{money})(?P<qty>\d{{1,2}})\s+(?P<amount>{money})\s*$",
        # 단가 수량 할인 금액이 공백으로 분리된 일반 POS 케이스
        rf"^(?P<name>.+?)\s+(?P<unit>{money})\s+(?P<qty>\d{{1,2}})\s*개?\s+\d{{1,2}}\s+(?P<amount>{money})\s*$",
        # 단가 수량 금액이 공백으로 분리된 일반 POS 케이스
        rf"^(?P<name>.+?)\s+(?P<unit>{money})\s+(?P<qty>\d{{1,2}})\s+(?P<amount>{money})\s*$",
        # 수량 금액: 상품명 1 7,100
        rf"^(?P<name>.+?)\s+(?P<qty>\d{{1,2}})\s+(?P<amount>{money})\s*$",
        # 금액 수량: 상품명 7,100 1
        rf"^(?P<name>.+?)\s+(?P<amount>{money})\s+(?P<qty>\d{{1,2}})\s*$",
        # 단가 금액만 있고 수량이 생략/오독된 케이스: 김치전 12,000- 12,000
        rf"^(?P<name>.+?)\s+(?P<unit>{money})[-~]?\s+(?P<amount>{money})\s*$",
        # 상품명 금액
        rf"^(?P<name>.+?)\s+(?P<amount>{money})\s*$",
    ]

    for pattern in patterns:
        m = re.match(pattern, value)
        if not m:
            continue
        name = extract_item_name(m.group("name"))
        if not name or not has_meaningful_item_letters(name):
            continue
        amount = parse_amount_text(m.groupdict().get("amount"))
        if amount is None:
            continue
        qty = int(m.groupdict().get("qty") or 1)
        if not (1 <= qty <= 99):
            qty = 1
        unit = parse_amount_text(m.groupdict().get("unit")) if m.groupdict().get("unit") else None

        # 단가*수량과 금액 관계로 0/8/OCR tail 오독을 보정한다.
        amount = choose_corrected_item_amount(amount, unit, qty, total_amount)
        if unit is not None:
            unit = choose_corrected_unit_amount(unit, amount, qty, total_amount)
        if unit is None and qty:
            unit = int(round(amount / qty)) if qty else amount
        if unit is not None and qty and amount is not None:
            expected = unit * qty
            if abs(expected - amount) > max(10, amount * 0.03):
                if qty != 1 and amount >= 1000 and unit == amount:
                    qty = 1
                    unit = amount
        if is_option_or_zero(name, amount):
            return None
        return make_raw_item_with_unit(name, amount, qty, unit, source="structured_inline_row")
    return None


def make_raw_item_with_unit(name: str, amount: Any, quantity: Any = 1, unit_price: Any = None, source: str = "rule") -> dict[str, Any]:
    amount_num = to_number(amount)
    qty = to_number(quantity) or 1
    unit_num = to_number(unit_price)
    if unit_num is None and amount_num is not None and qty:
        unit_num = amount_num / qty
    return {
        "description": normalize_product_name(name),
        "quantity": qty,
        "unit_price": unit_num,
        "amount": amount_num,
        "source": source,
    }

def parse_inline_rows(lines: list[str], total_amount: float | None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for line in lines:
        structured = parse_structured_item_line(line, total_amount)
        if structured:
            items.append(structured)
            continue
        if is_non_item_line(line):
            continue
        name = extract_item_name(line)
        if not name:
            continue
        amounts = money_candidates_from_line(line, total_amount, item_name=name)
        if not amounts:
            continue
        # 같은 줄에 상품명과 금액이 있으면 마지막 금액을 라인 금액으로 우선 사용
        amount = amounts[-1]
        qty = extract_quantity(line) or 1
        if is_option_or_zero(name, amount):
            continue
        items.append(make_raw_item(name, amount, qty, source="inline_row"))
    return items




def parse_preceding_amount_small_item_rows(lines: list[str], total_amount: float | None) -> list[dict[str, Any]]:
    """OCR이 쇼핑백/봉투 100원을 품목명 직전 줄에 배치한 경우 복원한다.

    예: 2,990 / 100 / 003NP 재생쇼핑백(소) / -4,000할인
    여기서 100은 두입만피크닉샌드위치가 아니라 재생쇼핑백(소)의 금액이다.
    """
    items: list[dict[str, Any]] = []
    for i, line in enumerate(lines):
        name = extract_item_name(line)
        if not name or not is_plausible_small_item_name(name):
            continue
        if i == 0:
            continue
        prev = normalize_line(lines[i - 1])
        if not re.fullmatch(r"\d{2,3}", prev):
            continue
        amount = parse_amount_text(prev)
        if amount is None or not (10 <= amount <= 999):
            continue
        items.append(make_raw_item_with_unit(name, amount, 1, amount, source="preceding_small_item_amount"))
    return items

def parse_code_name_blocks(lines: list[str], total_amount: float | None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not is_product_code_line(line):
            i += 1
            continue

        # 상품코드 다음 1~2줄에서 이름 찾기
        name_index = None
        name = None
        for j in range(i + 1, min(len(lines), i + 4)):
            candidate = extract_item_name(lines[j])
            if candidate:
                name = candidate
                name_index = j
                break
        if not name or name_index is None:
            i += 1
            continue

        # 다음 상품코드/합계 전까지 금액 후보 수집
        block: list[str] = []
        cursor = name_index + 1
        while cursor < len(lines) and cursor < name_index + 10:
            if is_item_end_line(lines[cursor]):
                break
            if is_product_code_line(lines[cursor]):
                break
            # 독립 소액 다음에 품목명이 오면 그 소액은 다음 품목 금액일 수 있다.
            if re.fullmatch(r"\d{2,3}", normalize_line(lines[cursor])) and cursor + 1 < len(lines):
                next_name = extract_item_name(lines[cursor + 1])
                if next_name and is_plausible_small_item_name(next_name):
                    break
            # 다음 독립 상품명이 나오면 현재 블록 종료
            if cursor > name_index + 1 and extract_item_name(lines[cursor]) and not extract_money_numbers(lines[cursor]):
                break
            block.append(lines[cursor])
            cursor += 1

        amount = choose_amount_from_block(block, total_amount, name)
        # 코드블록 영수증에서 할인 컬럼 8/9가 수량으로 오인되는 일이 많아, 독립 1 라인이 있으면 수량 1을 우선한다.
        qty = 1 if any(re.fullmatch(r"1", normalize_line(x)) for x in block) else (extract_quantity(" ".join(block)) or 1)
        if amount is not None and not is_option_or_zero(name, amount):
            items.append(make_raw_item(name, amount, qty, source="code_block"))
        i = max(cursor, i + 1)
    return items


def parse_name_price_blocks(lines: list[str], total_amount: float | None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        name = extract_item_name(line)
        if not name or not has_meaningful_item_letters(name):
            i += 1
            continue

        inline_amounts = money_candidates_from_line(line, total_amount)
        if inline_amounts:
            amount = inline_amounts[-1]
            if not is_option_or_zero(name, amount):
                items.append(make_raw_item(name, amount, extract_quantity(line) or 1, source="name_inline"))
            i += 1
            continue

        block: list[str] = []
        cursor = i + 1
        while cursor < len(lines) and cursor < i + 8:
            if is_item_end_line(lines[cursor]):
                break
            if is_product_code_line(lines[cursor]):
                break
            # 독립 소액 다음에 품목명이 오면 그 소액은 다음 품목 금액일 수 있다.
            if re.fullmatch(r"\d{2,3}", normalize_line(lines[cursor])) and cursor + 1 < len(lines):
                next_name = extract_item_name(lines[cursor + 1])
                if next_name and is_plausible_small_item_name(next_name):
                    break
            # 다음 상품명인데 현재 블록에 이미 숫자가 있으면 종료
            if extract_item_name(lines[cursor]) and block and any(extract_money_numbers(b) for b in block):
                break
            block.append(lines[cursor])
            cursor += 1

        amount = choose_amount_from_block(block, total_amount, name)
        qty = extract_quantity(" ".join(block)) or 1
        if amount is not None and not is_option_or_zero(name, amount):
            items.append(make_raw_item(name, amount, qty, source="name_block"))
            i = cursor
        else:
            i += 1
    return items




def parse_two_line_table_blocks(lines: list[str], total_amount: float | None) -> list[dict[str, Any]]:
    """품목명 줄과 금액 줄이 분리된 POS/음식점 영수증 복원.

    예:
    품목명 예시
    33,000 3개 0 99,000
    """
    items: list[dict[str, Any]] = []
    money = r"\d{1,3}(?:[,\.]\d{3})+"
    amount_row_patterns = [
        re.compile(rf"^(?P<unit>{money})\s+(?P<qty>\d{{1,2}})\s*개?\s+\d{{1,2}}\s+(?P<amount>{money})\s*$"),
        re.compile(rf"^(?P<unit>{money})\s+(?P<qty>\d{{1,2}})\s+(?P<amount>{money})\s*$"),
        re.compile(rf"^(?P<unit>{money})\s+(?P<qty>\d{{1,2}})\s*개?\s+(?P<amount>{money})\s*$"),
    ]

    for i, line in enumerate(lines[:-1]):
        name = extract_item_name(line)
        if not name:
            continue
        if money_candidates_from_line(line, total_amount, item_name=name):
            continue
        if is_item_end_line(line):
            continue
        for j in range(i + 1, min(len(lines), i + 4)):
            nxt = normalize_line(lines[j])
            if is_item_end_line(nxt) or extract_item_name(nxt):
                break
            match = None
            for pattern in amount_row_patterns:
                match = pattern.match(nxt)
                if match:
                    break
            if not match:
                continue
            unit = parse_amount_text(match.group("unit"))
            qty = int(match.group("qty") or 1)
            amount = parse_amount_text(match.group("amount"))
            if unit is None or amount is None:
                continue
            amount = choose_corrected_item_amount(amount, unit, qty, total_amount)
            unit = choose_corrected_unit_amount(unit, amount, qty, total_amount)
            if abs(unit * qty - amount) > max(10, amount * 0.03):
                continue
            if not is_option_or_zero(name, amount):
                items.append(make_raw_item_with_unit(name, amount, qty, unit, source="two_line_table_block"))
            break
    return items

def parse_single_product_receipt(lines: list[str], total_amount: float | None) -> list[dict[str, Any]]:
    if total_amount is None or total_amount <= 0:
        return []

    # 단일상품 보정은 정말 단일상품 영수증일 때만 허용한다.
    # 음식점/POS 영수증에서 OCR이 일부 품목명만 살리고 나머지를 금액줄로만 읽으면
    # 기존 로직이 `품목명 = 총액` 같은 오답을 만들었다.
    money_lines = [line for line in lines if extract_money_numbers(line)]
    item_like_money_lines = [
        line for line in money_lines
        if not is_item_end_line(line) and not is_tax_or_settlement_noise(line)
    ]
    if len(item_like_money_lines) >= 3:
        return []

    names = [extract_item_name(line) for line in lines]
    names = [name for name in names if name and not is_option_only_name(name)]
    if len(names) == 1 and len(item_like_money_lines) <= 2:
        return [make_raw_item(names[0], total_amount, 1, source="single_product_total")]
    # 카페류: 메인 상품명 1개 + 옵션 여러 줄이면 메인 상품명 1건으로 처리
    product_names = [n for n in names if has_product_hint(n)]
    if len(product_names) == 1 and len(item_like_money_lines) <= 2:
        return [make_raw_item(product_names[0], total_amount, 1, source="single_product_hint_total")]
    return []


def extract_item_name(line: str) -> str | None:
    value = normalize_line(line)
    if not value or is_non_item_line(value):
        return None

    # 앞쪽 상품코드 제거
    # - 단독 숫자 코드: 001 / 000027
    # - POS에서 자주 나오는 코드+문자 접두: 003NP 재생쇼핑백(소)
    #   기존에는 003NP가 품목명에 붙어 있거나, 코드로 인식되지 않아 쇼핑백 100원 품목이 누락될 수 있었다.
    value = re.sub(r"^\*?\s*\d{3,8}\s+", "", value).strip()
    value = re.sub(r"^\d{3,8}[A-Za-z]{1,5}\s*(?=[가-힣A-Za-z])", "", value).strip()
    value = re.sub(r"^\[[0-9A-Za-z\-]{3,30}\]\s*", "", value).strip()
    value = re.sub(r"^[-*]+\s*", "", value).strip()

    # 라인 끝의 수량/할인/금액 컬럼 제거
    # 핵심: OCR이 단가+수량을 붙여 읽는 경우(20,0002)를 품목명에서 반드시 제거한다.
    money = r"\d{1,3}(?:[,\.]\d{3})+"
    # OCR 붙음: 품목명 1,00011,000 / 품목명 3,00013,000
    value = re.sub(rf"\s+{money}[1-9]\d?{money}\s*$", "", value).strip()
    value = re.sub(rf"\s+{money}\d{{1,2}}\s+{money}(?:\s+[0-9A-Za-z]{{1,4}})?\s*$", "", value).strip()
    value = re.sub(rf"\s+{money}\s+\d{{1,2}}\s+{money}(?:\s+[0-9A-Za-z]{{1,4}})?\s*$", "", value).strip()
    value = re.sub(rf"\s+\d{{1,2}}\s+{money}\s*$", "", value).strip()
    value = re.sub(rf"\s+{money}\s+\d{{1,2}}\s*$", "", value).strip()
    value = re.sub(rf"\s+{money}[-~]?\s+{money}\s*$", "", value).strip()
    value = re.sub(rf"\s+{money}\s*$", "", value).strip()
    value = re.sub(r"\s+\d{1,3}\s+\d{1,3}(?:[,\.]\d{3})+\s*$", "", value).strip()
    value = re.sub(r"\s+\d{1,3}\s+\d{1,3}\s+\d{1,3}(?:[,\.]\d{3})+\s*$", "", value).strip()
    # 같은 줄 구조: 상품명 수량 금액. 예) FRESH버거 1 7,100 / 쇼핑백 1 100
    value = re.sub(r"(?:\s+\d{1,3}){2,3}\s*$", "", value).strip()
    # 금액 제거 후 남은 단독 수량 컬럼 제거. 예) FRESH버거 1
    value = re.sub(r"\s+[1-9]\d?\s*$", "", value).strip()

    value = re.sub(r"\s*\[[0-9A-Za-z\-]{3,30}$", "", value).strip()
    # 옵션 접두 기호만 제거
    value = value.strip(" -*_[]")

    if not value or len(value) < 2 or len(value) > 60:
        return None
    if re.fullmatch(r"[\[\]0-9A-Za-z\s]+", value.strip()):
        return None
    if any(k in compact(value).lower() for k in ["번호", "체번호", "스탬프", "스탭프", "적립", "보유", "포인트"]):
        return None
    if is_non_item_line(value):
        return None
    if is_option_only_name(value):
        return None
    if len(re.findall(r"[가-힣A-Za-z]", value)) < 2:
        return None
    if not has_meaningful_item_letters(value):
        return None
    # 2글자 실제 품목은 item_normalizer의 짧은 토큰 노이즈 규칙보다 우선할 수 있다.
    value = collapse_ocr_ghost_repeats(value)
    if not value or len(value) < 2:
        return None
    if has_product_hint(value):
        return value
    if is_noise_item_name(value, amount=None):
        return None
    return value


def is_tax_or_settlement_noise(line: str) -> bool:
    c = compact(line)
    if not c:
        return False
    # OCR 변형 예: 구0부급가액박세 3,273327 / rlo과-급간염가''세 3,273327
    if re.search(r"공급가|급가액|부가세|부가|과세|면세|세액|물품가액|가액", c):
        return True
    if re.search(r"급.*가.*세|가액.*세|과.*세|부.*세", c):
        return True
    if re.search(r"결제금액|원금액|합계결제금액|청구금액|승인금액", c):
        return True
    return False


def is_non_item_line(line: str) -> bool:
    value = normalize_line(line)
    c = compact(value).lower()
    if not c:
        return True
    if is_tax_or_settlement_noise(value):
        return True
    if is_product_code_line(value):
        return True
    if any(k.lower() in c for k in META_KEYWORDS):
        return True
    if any(k.lower() in c for k in PROMO_KEYWORDS):
        return True
    # OCR 잡음: THY, SSTS, YC 같은 짧은 영문 토큰은 품목명이 아니다.
    if re.fullmatch(r"[A-Z]{2,6}", value.strip()):
        return True
    if re.fullmatch(r"[\d,\.\-_=*\s]+", value):
        return True
    if re.search(r"^(할|일계|합계|총계|받은|받을|결제|신용|현금)", c):
        return True
    if re.search(r"[πρΩ{}<>_=|`~]|[A-Za-z]{3,}\d|\d[A-Za-z]{3,}", value):
        return True
    if re.search(r"\d{3}\s*-\s*\d{2}\s*-\s*\d{5}", value):
        return True
    if re.search(r"\d{2,4}\s*-\s*\d{3,4}\s*-\s*\d{4}", value):
        return True
    if re.search(r"[가-힣]+[시도]\s*[가-힣]+[구군]|[가-힣0-9]+로\s*\d+|[가-힣0-9]+길\s*\d+|\d+\s*층", value):
        return True
    return False


def is_product_code_line(line: str) -> bool:
    value = compact(line)
    if re.fullmatch(r"\[[0-9A-Za-z\-]{3,30}\]", value):
        return True
    # 단독 상품코드: 001/002 또는 5~8자리 품목코드. 단순 100 같은 소액은 제외한다.
    if re.fullmatch(r"0\d{2,7}|\d{5,8}", value):
        return True
    if re.fullmatch(r"[A-Za-z0-9]{8,30}", value) and not re.search(r"[가-힣]", value):
        return True
    return False


def extract_money_numbers(line: str) -> list[int]:
    return money_candidates_from_line(line, None)



def _is_embedded_thousands_token(value: str, start: int, end: int) -> bool:
    """1~3자리 숫자가 7,100 / 2.990 같은 금액 내부 조각인지 판정한다.

    기존 소액 품목 보정이 7,100의 `100`, 2,990의 `990`까지 별도 금액 후보로
    추가하면서 상세 품목 후보가 중복/오염되는 문제가 있었다.
    독립된 `100` 라인이나 `쇼핑백 1 100`은 살리고, 천단위 구분자에 붙은 숫자만 제외한다.
    """
    before = value[start - 1] if start > 0 else ""
    after = value[end] if end < len(value) else ""
    if before in {",", "."} or after in {",", "."}:
        return True
    left = value[max(0, start - 4):start]
    right = value[end:end + 4]
    if re.search(r"\d[,\.]$", left):
        return True
    if re.search(r"^[,\.]\d", right):
        return True
    return False


def _is_likely_product_code_token(value: str, start: int, end: int) -> bool:
    """라인 앞 상품코드(001, 002, 003NP 등)를 금액 후보에서 제외한다."""
    token = value[start:end]
    prefix = value[:start]
    suffix = value[end:end + 4]
    if re.fullmatch(r"0\d{2,7}", token) and not prefix.strip():
        return True
    if re.search(r"^[A-Za-z]{1,5}\b", suffix):
        return True
    return False

def money_candidates_from_line(line: str, total_amount: float | None, item_name: str | None = None) -> list[int]:
    value = normalize_line(line)
    if not value:
        return []
    c = compact(value)
    item_c = compact(item_name or "")
    small_item_context = is_plausible_small_item_name(item_name or value)
    if any(k.lower() in c.lower() for k in ["tel", "전화", "카드번호", "승인번호", "거래번호", "주문번호", "멤버십", "적립", "포인트", "체번호"]):
        return []
    if is_product_code_line(value):
        return []
    # 상품코드 접두부는 금액 후보에서 제외한다.
    # 예: 001 상품명, 003NP 재생쇼핑백(소) 에서 001/003을 금액으로 보면 안 된다.
    value = re.sub(r"^\*?\s*\d{3,8}\s+", "", value).strip()
    value = re.sub(r"^\d{3,8}[A-Za-z]{1,5}\s*(?=[가-힣A-Za-z])", "", value).strip()
    c = compact(value)
    # 긴 숫자열 단독/식별자 라인은 금액 후보에서 제외한다.
    digits_only = re.sub(r"\D", "", c)
    if len(digits_only) >= 7 and not re.search(r"[,\.]\d{3}|원|금액|합계|결제|판매|받은|영수|운임|요금|계$", c):
        return []
    if re.search(r"\d{2,4}-\d{3,4}-\d{4}|\d{3}-\d{2}-\d{5}", value):
        return []

    candidates: list[int] = []

    # 일반 금액: 7,100 / 31.800 / 3600
    for raw in re.findall(r"(?<![A-Za-z가-힣])(?:\d{1,3}(?:[,\.]\d{3})+|\d{3,7})(?![A-Za-z가-힣])", value):
        # 상품명 안의 규격/용량 숫자는 금액이 아니다.
        if re.search(r"[가-힣A-Za-z]", value) and not re.search(r"[,\.]|원", raw) and int(re.sub(r"\D", "", raw) or 0) < 1000 and not small_item_context:
            continue
        number = parse_amount_text(raw)
        if number is None:
            continue
        if 1 <= number <= 10_000_000:
            candidates.extend(amount_ocr_candidates(number, total_amount))

    # 소액 실제 품목은 구조적으로 판단해 살린다.
    # 단, 포인트/적립/승인번호 라인은 위에서 제외했으므로 여기서는 소액 품목 문맥만 허용한다.
    if small_item_context:
        has_thousands_amount = bool(re.search(r"\d{1,3}(?:[,\.]\d{3})+", value))
        for match in re.finditer(r"(?<!\d)(\d{1,3})(?!\d)", value):
            raw = match.group(1)
            if has_thousands_amount:
                continue
            if _is_embedded_thousands_token(value, match.start(1), match.end(1)):
                continue
            if _is_likely_product_code_token(value, match.start(1), match.end(1)):
                continue
            number = parse_amount_text(raw)
            if number is not None and 1 <= number <= 999:
                if number < 10 and re.search(r"(?<!\d)\d{2,3}(?!\d)", value):
                    continue
                candidates.append(number)

    # OCR 오독 금액: 31.aaa, 3i.a00 등
    for raw in re.findall(r"[0-9iIlLoOaA]{1,3}[,\.][0-9iIlLoOaA]{3}", value):
        number = parse_amount_text(raw)
        if number is None:
            continue
        candidates.extend(amount_ocr_candidates(number, total_amount))

    # 중복 제거 순서 보존
    result: list[int] = []
    for n in candidates:
        if n not in result and 0 < n <= 10_000_000:
            if total_amount is None or n <= max(total_amount * 1.05, total_amount + 100):
                result.append(n)
    return result


def parse_amount_text(raw: Any) -> int | None:
    text = str(raw or "").strip()
    if not text:
        return None
    # OCR 혼동: a/o/O는 0, i/l/I는 1
    trans = str.maketrans({"a": "0", "A": "0", "o": "0", "O": "0", "i": "1", "I": "1", "l": "1", "L": "1"})
    text = text.translate(trans)
    text = text.replace(",", "").replace(".", "")
    text = re.sub(r"\D", "", text)
    if not text:
        return None
    # 날짜/승인번호/전화번호성 숫자 제외
    if len(text) >= 8:
        return None
    try:
        return int(text)
    except Exception:
        return None


def amount_ocr_candidates(number: int, total_amount: float | None) -> list[int]:
    candidates = [number]
    if number >= 1000:
        tail = number % 1000
        # 감열지/저해상도에서 0이 8/a로 읽히는 경우 보정: 16,880 -> 16,000 / 15,088 -> 15,000 / 31,888 -> 31,000
        suspicious_tails = {8, 80, 88, 800, 808, 880, 888, 868, 688}
        if tail in suspicious_tails or ("8" in f"{tail:03d}" and tail < 900):
            rounded = number - tail
            if rounded >= 1000:
                candidates.append(rounded)
        if tail == 800:
            candidates.append(number - 800)

    if total_amount is not None:
        t = int(total_amount)
        if abs(number - t) <= max(1000, t * 0.05):
            candidates.append(t)
    result: list[int] = []
    for candidate in candidates:
        if candidate not in result:
            result.append(candidate)
    return result


def choose_corrected_item_amount(amount: int, unit: int | None, qty: int, total_amount: float | None) -> int:
    amount_candidates = amount_ocr_candidates(int(amount), total_amount)
    if unit is None or not qty:
        return amount_candidates[-1] if amount_candidates else amount
    unit_candidates = amount_ocr_candidates(int(unit), total_amount)
    pairs: list[tuple[float, int]] = []
    for amount_candidate in amount_candidates:
        for unit_candidate in unit_candidates:
            expected = unit_candidate * qty
            diff = abs(amount_candidate - expected)
            pairs.append((diff, amount_candidate))
    if not pairs:
        return amount
    diff, best = sorted(pairs, key=lambda x: (x[0], abs(x[1] - amount)))[0]
    if diff <= max(10, best * 0.05):
        return best
    return amount_candidates[-1] if amount_candidates else amount


def choose_corrected_unit_amount(unit: int, amount: int, qty: int, total_amount: float | None) -> int:
    if not qty:
        return unit
    expected_unit = round(amount / qty)
    candidates = amount_ocr_candidates(int(unit), total_amount)
    best = min(candidates, key=lambda x: abs(x - expected_unit)) if candidates else unit
    if abs(best - expected_unit) <= max(10, expected_unit * 0.05):
        return int(best)
    return unit


def choose_amount_from_block(lines: list[str], total_amount: float | None, item_name: str | None = None) -> int | None:
    numbers: list[int] = []
    for line in lines:
        if is_non_item_line(line) and not re.fullmatch(r"[\d,\.\s]+", normalize_line(line)):
            continue
        for n in money_candidates_from_line(line, total_amount, item_name=item_name):
            if n > 0:
                numbers.append(n)
    # 1, 8, 9 같은 수량/할인 값 제외
    money = [n for n in numbers if n >= 10]
    if not money:
        return None
    # 보정 후보가 있으면 1000단위/총액 이하 후보 우선
    if total_amount is not None:
        money = [n for n in money if n <= max(total_amount + 100, total_amount * 1.05)] or money
    # 같은 블록에서는 마지막 유효 금액이 라인금액일 가능성이 크다. 단 보정 후보 1000단위를 선호.
    preferred = [n for n in money if n >= 1000 and n % 1000 == 0]
    if preferred:
        return preferred[-1]
    return money[-1]


def extract_quantity(line: str) -> int | None:
    value = normalize_line(line)
    for pattern in [r"(?:x|X|×)\s*(\d{1,2})", r"(\d{1,2})\s*개", r"\s(\d{1,2})\s+\d{1,3}(?:[,\.]\d{3})+"]:
        m = re.search(pattern, value)
        if m:
            qty = int(m.group(1))
            if 1 <= qty <= 99:
                return qty
    return 1


def is_option_only_name(name: str) -> bool:
    c = compact(name).lower()
    if c in {"1개", "1개기", "개", "참여", "안함", "단품만", "선택", "size", "sizem", "icem", "ice", "hot"}:
        return True
    return any(k.lower() in c for k in OPTION_KEYWORDS) and not has_product_hint(name)


def is_option_or_zero(name: str, amount: Any) -> bool:
    n = to_number(amount)
    if n is None:
        return True
    if n <= 0:
        return True
    if n < 10:
        return True
    if n < 100 and not is_plausible_small_item_name(name):
        return True
    if is_option_only_name(name):
        return True
    return False


def has_product_hint(name: str | None) -> bool:
    text = clean_text(name) or ""
    c = compact(text)
    if not c:
        return False
    if any(k in c for k in META_KEYWORDS + PROMO_KEYWORDS):
        return False
    return bool(re.search(r"[가-힣A-Za-z]{2,}", c))


def make_raw_item(name: str, amount: Any, quantity: Any = 1, source: str = "rule") -> dict[str, Any]:
    amount_num = to_number(amount)
    qty = to_number(quantity) or 1
    return {
        "description": normalize_product_name(name),
        "quantity": qty,
        "unit_price": amount_num / qty if amount_num is not None and qty else amount_num,
        "amount": amount_num,
        "source": source,
    }


def normalize_product_name(name: str) -> str:
    value = normalize_line(name)
    value = re.sub(r"^\d{3,8}\s+", "", value).strip()
    value = re.sub(r"^\d{3,8}[A-Za-z]{1,5}\s*(?=[가-힣A-Za-z])", "", value).strip()
    value = re.sub(r"\[[0-9A-Za-z\-]{3,30}\]", " ", value)
    value = re.sub(r"\s*\[[0-9A-Za-z\-]{3,30}$", "", value)
    money = r"\d{1,3}(?:[,\.]\d{3})+"
    value = re.sub(rf"\s+{money}[1-9]\d?{money}\s*$", "", value).strip()
    value = re.sub(r"\([^)]*[0-9A-Za-z/][^)]*$", "", value).strip()
    if value.endswith("("):
        value = value[:-1].strip()
    value = re.sub(r"\s+", " ", value)
    value = value.strip(" -_*[]")
    # 자주 발생하는 OCR 오독을 품목명 표준화 단계에서만 보정한다.
    # 금액/수량에는 영향을 주지 않는다.
    corrections = {
        "패퍼로니": "페퍼로니",
        "원간": "월간",
        "하이몰": "하이볼",
        "얼그레이이": "얼그레이",
        "얼그레": "얼그레이",
        "꽃감말이": "꽃감말이",
        "알 아히요": "알 아히요",
    }
    for wrong, right in corrections.items():
        value = value.replace(wrong, right)
    value = value.replace("얼그레이이", "얼그레이")
    value = collapse_ocr_ghost_repeats(value)
    return value.strip(" -_*[]")



def sort_candidate_items_by_text_order(items: list[dict[str, Any]], lines: list[str]) -> list[dict[str, Any]]:
    """여러 파서가 만든 후보를 OCR 원문 등장 순서대로 정렬한다.

    품목명 보정(패퍼로니→페퍼로니, 원간→월간 등) 후에는 원문에서 정확히 찾기
    어려울 수 있으므로, 보정된 라인 비교와 금액 위치를 함께 사용한다.
    """
    if not items:
        return []

    prepared_lines: list[tuple[int, str, list[int]]] = []
    for idx, line in enumerate(lines or []):
        normalized_line = normalize_product_name(line)
        key = compare_key(normalized_line)
        amounts = money_candidates_from_line(line, None)
        prepared_lines.append((idx, key, amounts))

    def locate(item: dict[str, Any], fallback_idx: int) -> tuple[int, int]:
        desc = item.get("description") or item.get("item_name") or ""
        desc_key = compare_key(normalize_product_name(desc))
        amount = int(to_number(item.get("amount")) or -1)

        if desc_key:
            for line_idx, line_key, _ in prepared_lines:
                if not line_key:
                    continue
                if desc_key in line_key or (len(line_key) >= 3 and line_key in desc_key):
                    return (line_idx, fallback_idx)

        if amount > 0:
            for line_idx, _, amounts in prepared_lines:
                if amount in [int(x) for x in amounts]:
                    return (line_idx, fallback_idx)

        return (10**9, fallback_idx)

    return [item for _, item in sorted(enumerate(items), key=lambda pair: locate(pair[1], pair[0]))]

def normalize_candidate_items(
    items: list[dict[str, Any]],
    total_amount: float | None,
    expense_date: str | None,
    vendor_name: str | None,
    payment_method: str | None,
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()
    for item in items:
        desc = normalize_product_name(item.get("description") or "")
        amount = to_number(item.get("amount"))
        qty = to_number(item.get("quantity")) or 1
        if not desc or is_non_item_line(desc) or is_option_or_zero(desc, amount):
            continue
        if looks_like_same_as_vendor(desc, vendor_name):
            continue
        # 금액은 맞아도 품목명이 깨진 경우 확정/후보 모두에서 제외한다.
        # 숫자/영문 규격이 붙은 정상 품목은 구조 규칙으로 보존한다.
        if not has_product_hint(desc) and is_noise_item_name(desc, vendor_name=vendor_name, amount=amount, strict=True):
            continue
        if total_amount is not None and amount is not None and amount > max(total_amount + 100, total_amount * 1.05):
            continue
        key = (compact(desc).lower(), int(amount or -1))
        if key in seen:
            continue
        seen.add(key)
        raw_unit_price = to_number(item.get("unit_price") or item.get("unitPrice") or item.get("price"))
        if raw_unit_price is None and amount is not None and qty:
            raw_unit_price = amount / qty

        result.append({
            "expense_date": expense_date,
            "vendor_name": vendor_name,
            "expense_category_code": classify_item(desc)[0],
            "expense_category_name": classify_item(desc)[1],
            "item_name": desc,
            "description": desc,
            "quantity": qty,
            "unit_price": raw_unit_price,
            "supply_amount": None,
            "tax_amount": None,
            "amount": amount,
            "payment_method": payment_method,
            "memo": None,
            "source": item.get("source"),
        })
    return remove_dominated_duplicate_item_names(result)



def remove_dominated_duplicate_item_names(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """같은 품목명이 여러 금액으로 반복될 때 OCR 조각 금액 후보를 제거한다.

    예: `두입만피크닉샌드위치 2,990`에서 잘못 생긴 `990` 후보,
    `FRESH버거 7,100`에서 잘못 생긴 `100` 후보를 낮은 신뢰 후보로 본다.
    정상적으로 같은 품목을 여러 번 산 경우는 같은 금액으로 중복되므로 기존 key 중복 제거에서 처리된다.
    """
    if not items:
        return []
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        key = compare_key(item.get("item_name") or item.get("description") or "")
        grouped.setdefault(key, []).append(item)

    remove_ids: set[int] = set()
    for group in grouped.values():
        if len(group) <= 1:
            continue
        amounts = [int(to_number(x.get("amount")) or 0) for x in group]
        max_amount = max(amounts or [0])
        if max_amount < 1000:
            continue
        for item in group:
            amount = int(to_number(item.get("amount")) or 0)
            source = str(item.get("source") or "")
            if amount < 1000 and amount < max_amount and source not in {"structured_small_item_row", "preceding_small_item_amount"}:
                remove_ids.add(id(item))
    return [item for item in items if id(item) not in remove_ids]

def choose_best_items(items: list[dict[str, Any]], total_amount: float | None) -> list[dict[str, Any]]:
    if not items:
        return []

    paid = [item for item in items if (to_number(item.get("amount")) or 0) > 0]
    paid = [item for item in paid if has_meaningful_item_letters(item.get("item_name") or item.get("description"))]
    if not paid:
        return []
    if total_amount is None:
        return paid

    total = float(total_amount)
    tolerance = max(10.0, total * 0.03)

    # 단일 상품 영수증 보정은 품목 후보가 정말 1개일 때만 적용한다.
    product_like = [i for i in paid if has_product_hint(i.get("description"))]
    if len(product_like) == 1 and len(paid) == 1:
        item_amount = float(to_number(product_like[0].get("amount")) or 0)
        if 0 < item_amount < total and abs(total - item_amount) <= max(500, total * 0.12):
            fixed = dict(product_like[0])
            fixed["amount"] = total
            qty = to_number(fixed.get("quantity")) or 1
            fixed["unit_price"] = total / qty if qty else total
            fixed["source"] = str(fixed.get("source") or "rule") + "_single_total_corrected"
            return [fixed]

    s = sum(to_number(i.get("amount")) or 0 for i in paid)
    if abs(s - total) <= 0.5:
        return paid

    def subset_quality(subset: tuple[dict[str, Any], ...]) -> tuple[float, float, float, int, float]:
        amount_sum = sum(float(to_number(i.get("amount")) or 0) for i in subset)
        diff = abs(amount_sum - total)
        name_penalty = sum(item_name_penalty(i.get("item_name") or i.get("description")) for i in subset)
        source_penalty = 0.0
        for i in subset:
            source = str(i.get("source") or "")
            if "two_line" in source or "structured_inline" in source or "attached" in source:
                source_penalty -= 0.2
            if "single_product" in source:
                source_penalty += 2.0
            if "name_inline" in source and re.search(r"\d", str(i.get("item_name") or i.get("description") or "")):
                source_penalty += 5.0
        # diff 우선, 품목명 위험 낮은 후보 우선, 같은 diff면 많은 품목 우선
        return (diff, name_penalty + source_penalty, -len(subset), len(subset), amount_sum)

    # 후보가 너무 많지 않으면 부분집합으로 총액에 맞는 품목 선택.
    # 기존 로직은 diff와 품목 수만 봐서 `6,000 1개 o` 같은 깨진 후보가 마늘밥을 밀어냈다.
    best: tuple[float, float, float, int, float] | None = None
    best_subset: list[dict[str, Any]] | None = None
    n = min(len(paid), 16)
    for r in range(1, n + 1):
        for subset in itertools.combinations(paid[:n], r):
            q = subset_quality(subset)
            if best is None or q < best:
                best = q
                best_subset = list(subset)
    if best_subset and best and best[0] <= tolerance:
        return best_subset

    exact = [i for i in paid if abs((to_number(i.get("amount")) or 0) - total) <= tolerance]
    if exact and len(paid) <= 2:
        return exact[:1] if len(exact) == 1 else exact

    # 합계가 맞지 않는 경우에도 후보는 보존한다. strict guard/validator가 확정 여부를 판단한다.
    return paid

def classify_item(description: str) -> tuple[str, str]:
    # 품목명 고정 사전으로 카테고리를 단정하지 않는다.
    # 문서/업체/템플릿 단위 카테고리는 상위 extractor의 규칙 테이블에서 결정한다.
    return "ETC", "기타"
