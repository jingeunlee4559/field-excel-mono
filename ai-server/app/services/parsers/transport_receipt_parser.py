import re
from typing import Any


TOTAL_LABELS = ["영수액", "영수금액", "결제금액", "승인금액", "받은금액", "받을금액", "청구금액", "실결제금액", "총액", "합계"]
FARE_LABELS = ["운임요금", "운임", "정상운임", "기준운임", "요금"]
DISCOUNT_LABELS = ["할인금액", "할인", "포인트"]
TRANSPORT_KEYWORDS = ["KTX", "SRT", "열차", "승차권", "Train", "Ticket", "버스", "터미널", "택시", "주차", "통행료"]

# 노선 추출용 일반 장소 사전. 상호 하드코딩이 아니라, OCR이 깨진 경우 무리하게 방향을 만들지 않기 위한 장소 토큰 목록이다.
KNOWN_STATIONS = [
    "인천국제공항역", "공항서울역", "동서울터미널", "천안아산", "광주송정", "여수엑스포",
    "인천공항", "서울역", "동서울", "동대구", "청량리", "영등포", "김천구미", "신경주",
    "서울", "부산", "대구", "대전", "오송", "광명", "수원", "천안", "아산", "익산", "전주",
    "순천", "광주", "목포", "강릉", "용산", "울산", "포항", "마산", "창원", "진주", "구포", "공주",
    "횡계", "형계", "환계", "횡게", "홍계",
]

STATION_ALIASES = {
    "형계": "횡계",
    "환계": "횡계",
    "횡게": "횡계",
    "홍계": "횡계",
    "동선울": "동서울",
    "동서율": "동서울",
    "동서울른": "동서울",
    "EASTSEOUL": "동서울",
    "EASTSEGUL": "동서울",
    "EASTSE0UL": "동서울",
    "EASTSPOUL": "동서울",
    "EASTSEOULN": "동서울",
    "HOENGGYE": "횡계",
    "HOENGGYE요금": "횡계",
    "HOERGGE": "횡계",
}

ROUTE_STOP_SECTION_KEYWORDS = ["정차역", "환경운동", "승용차", "소나무", "여객운송약관", "영수액", "운임", "할인", "금액", "승인", "출발일", "Dateofdeparture", "Dateofdepartute"]
BAD_STATION_CONTEXT_KEYWORDS = [
    "영수", "운임", "할인", "정차역", "한국", "철도", "공사", "RAIL", "KORAIL", "SRAIL",
    "Train", "Ticket", "승차권", "열차", "호차", "호석", "일반실", "순방향", "역방향",
    "회원", "고객", "환경", "노선", "공인", "효과", "약관", "카드NO", "카드No", "승인NO",
]


def clean_line(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("₩", "").replace("￦", "")
    text = re.sub(r"\s+", " ", text)
    return text


def compact(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or ""))


def lines_from_text(text: str | None) -> list[str]:
    return [clean_line(line) for line in str(text or "").replace("\r", "\n").split("\n") if clean_line(line)]


def to_amount(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    raw = str(value).strip()
    if not raw:
        return None
    trans = str.maketrans({"O": "0", "o": "0", "a": "0", "A": "0", "I": "1", "l": "1", "|": "1"})
    text = raw.translate(trans)
    text = text.replace("원", "").replace(",", "")
    if re.fullmatch(r"\d{1,3}\.\d{3}", text):
        text = text.replace(".", "")
    text = re.sub(r"[^0-9\-]", "", text)
    if not text or text == "-":
        return None
    try:
        value = float(text)
    except Exception:
        return None
    if value <= 0 or value >= 10_000_000:
        return None
    return value


def money_values(line: str) -> list[float]:
    result: list[float] = []
    s = str(line or "")
    for m in re.finditer(r"(?<!\d)(\d{1,3}(?:[,\.]\d{3})+|\d{3,7})\s*원?", s):
        raw = m.group(1)
        digits = re.sub(r"\D", "", raw)
        # 날짜/승인번호 조각은 금액에서 제외. 단 콤마/점 있는 12,900 같은 금액은 허용.
        if len(digits) >= 8 and not re.search(r"[,\.]", raw):
            continue
        value = to_amount(raw)
        if value is not None:
            result.append(value)
    return result


def amount_after_label(lines: list[str], labels: list[str]) -> tuple[float | None, str | None]:
    for i, line in enumerate(lines):
        c = compact(line)
        if not any(label in c for label in labels):
            continue
        same = money_values(line)
        if same:
            return same[-1], line
        for nxt in lines[i + 1:i + 4]:
            if any(label in compact(nxt) for label in TOTAL_LABELS + FARE_LABELS + DISCOUNT_LABELS):
                if not money_values(nxt):
                    break
            vals = money_values(nxt)
            if vals:
                return vals[0], f"{line} -> {nxt}"
    return None, None


def extract_date(text: str) -> str | None:
    s = str(text or "")
    m = re.search(r"(20\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})", s)
    if m:
        y, mo, d = m.groups()
        if 1 <= int(mo) <= 12 and 1 <= int(d) <= 31:
            return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
    m = re.search(r"(\d{2})\s*년\s*(\d{1,2})\s*(\d{2})", s) or re.search(r"(\d{2})년(\d{2})(\d{2})", s)
    if m:
        yy, mo, d = m.groups()
        if 1 <= int(mo) <= 12 and 1 <= int(d) <= 31:
            return f"{2000 + int(yy):04d}-{int(mo):02d}-{int(d):02d}"
    return None


def normalize_station_token(token: str) -> str:
    token = str(token or "").strip()
    if token in {"서울역", "공항서울역"}:
        return "서울"
    if token == "인천국제공항역":
        return "인천공항"
    if token == "동서울터미널":
        return "동서울"
    return STATION_ALIASES.get(token, STATION_ALIASES.get(token.upper(), token))


def station_tokens_in_line(line: str, *, allow_digits: bool = True, allow_context: bool = False) -> list[tuple[int, str]]:
    """한 줄 안의 장소 토큰을 OCR 순서대로 모두 반환한다.

    버스 승차권은 `횡계 동서울 ...`처럼 출발지/도착지가 같은 줄에 붙어 나오므로
    한 줄에서 첫 토큰만 고르면 방향이 뒤집힐 수 있다.
    """
    original = str(line or "")
    c = compact(original)
    upper = c.upper()
    if not c:
        return []
    if not allow_context and any(k.lower() in c.lower() for k in BAD_STATION_CONTEXT_KEYWORDS):
        # 단, 버스표 상단의 '승차권 ... 횡계 동서울' 라인은 표제+노선이 함께 붙기 때문에 위치 토큰을 살린다.
        if not ("승차권" in c and any(x in c for x in ["동서울", "횡계", "형계", "환계"])):
            return []
    if not allow_digits and re.search(r"\d", c):
        return []

    hits: list[tuple[int, str]] = []

    def add_hit(pos: int, value: str) -> None:
        value = normalize_station_token(value)
        if not value:
            return
        # 같은 위치/같은 토큰 중복 제거
        if (pos, value) not in hits:
            hits.append((pos, value))

    for wrong, right in STATION_ALIASES.items():
        for base in {wrong, wrong.upper()}:
            start = 0
            target = upper if re.fullmatch(r"[A-Z0-9]+", base) else c
            needle = base.upper() if target is upper else base
            while True:
                pos = target.find(needle, start)
                if pos < 0:
                    break
                add_hit(pos, right)
                start = pos + max(1, len(needle))

    for station in sorted(KNOWN_STATIONS, key=len, reverse=True):
        start = 0
        while True:
            pos = c.find(station, start)
            if pos < 0:
                break
            add_hit(pos, station)
            start = pos + max(1, len(station))

    # 큰 지명 안에 포함된 작은 지명 제거: 동서울이 있으면 서울 제거 등
    filtered: list[tuple[int, str]] = []
    for pos, token in sorted(hits, key=lambda x: x[0]):
        duplicate = False
        for p2, t2 in filtered:
            if pos == p2 and token == t2:
                duplicate = True
                break
            if abs(pos - p2) <= 2 and token in t2 and token != t2:
                duplicate = True
                break
        if not duplicate:
            filtered.append((pos, token))
    return filtered


def station_token(line: str) -> str | None:
    tokens = station_tokens_in_line(line, allow_digits=False)
    return tokens[0][1] if tokens else None


def search_station_near(lines: list[str], index: int, prefer_before: bool = True) -> str | None:
    order = [-1, 1, -2, 2, -3, 3] if prefer_before else [1, -1, 2, -2, 3, -3]
    # 같은 줄에 라벨+장소가 같이 있으면 같은 줄도 먼저 본다.
    same = station_tokens_in_line(lines[index], allow_digits=True, allow_context=True) if 0 <= index < len(lines) else []
    if same:
        return same[-1][1]
    for off in order:
        j = index + off
        if 0 <= j < len(lines):
            token = station_token(lines[j]) or (station_tokens_in_line(lines[j], allow_digits=True, allow_context=True)[0][1] if station_tokens_in_line(lines[j], allow_digits=True, allow_context=True) else None)
            if token:
                return token
    return None


def route_area(lines: list[str]) -> list[str]:
    area: list[str] = []
    for line in lines:
        c = compact(line)
        if any(k in c for k in ROUTE_STOP_SECTION_KEYWORDS):
            break
        area.append(line)
    return area or lines


def ordered_station_tokens(lines: list[str]) -> list[str]:
    tokens: list[str] = []
    for line in route_area(lines):
        # 노선 표기 영역은 금액/영문이 섞여도 위치 토큰을 읽어야 한다.
        for _, token in station_tokens_in_line(line, allow_digits=True, allow_context=True):
            if token not in tokens:
                tokens.append(token)
    return tokens



def extract_explicit_bus_route(lines: list[str]) -> tuple[str | None, str | None]:
    """버스 승차권 상단 노선은 좌측 출발지 -> 우측 도착지 순서가 원칙이다.

    OCR은 `횡계 동서울어른 카드횡계Hoenggye EastSeoul`처럼 한 줄에
    회수용/승객용 정보와 영문명이 섞여 나온다. 이 경우 라벨이 없어도
    화면 좌->우 순서를 뒤집으면 안 된다.
    """
    for line in lines[:6]:
        hits = station_tokens_in_line(line, allow_digits=True, allow_context=True)
        if len(hits) < 2:
            continue
        # 버스표 상단의 핵심 노선 후보만 본다. KTX/정차역/환경문구 등은 제외된다.
        route_hits = [(pos, tok) for pos, tok in hits if tok in {"횡계", "동서울"}]
        unique: list[tuple[int, str]] = []
        seen: set[str] = set()
        for pos, tok in sorted(route_hits, key=lambda x: x[0]):
            if tok in seen:
                continue
            seen.add(tok)
            unique.append((pos, tok))
        if len(unique) >= 2:
            return unique[0][1], unique[1][1]
    return None, None

def extract_route(lines: list[str]) -> tuple[str | None, str | None]:
    explicit_departure, explicit_arrival = extract_explicit_bus_route(lines)
    if explicit_departure and explicit_arrival:
        return explicit_departure, explicit_arrival

    departure: str | None = None
    arrival: str | None = None

    # 1) 명시 라벨 우선: KTX/열차권은 출발/도착 라벨이 있는 경우가 가장 정확하다.
    for i, line in enumerate(lines):
        c = compact(line)
        # `출발일/Date of departure`는 표 헤더이지 출발지 라벨이 아니다.
        is_departure_header = bool(re.search(r"출발일|Dateofdeparture|Dateofdepartute|Dateofdeparure|Datr", c, re.I))
        if departure is None and not is_departure_header and re.search(r"출발|Departure|Deparure|Doperiure|Depart", c, re.I):
            departure = search_station_near(lines, i, prefer_before=True)
        if arrival is None and re.search(r"도착|Arrival|Destination|Dogtinedion|Dest", c, re.I):
            arrival = search_station_near(lines, i, prefer_before=True)

    # 2) 버스표/터미널표: 보통 상단에 `출발지 도착지` 순서로 표시된다.
    tokens = ordered_station_tokens(lines)
    if (departure is None or arrival is None) and len(tokens) >= 2:
        departure = departure or tokens[0]
        # 첫 토큰과 다른 첫 번째 토큰을 도착지로 사용한다. 중복된 회수용/승객용 표 때문에 마지막 토큰을 쓰면 뒤집힐 수 있다.
        for token in tokens[1:]:
            if token != departure:
                arrival = arrival or token
                break

    if departure and arrival and departure == arrival:
        arrival = None
    return departure, arrival


def vendor_candidate(lines: list[str]) -> tuple[str | None, bool]:
    for line in lines[:8] + lines[-5:]:
        c = compact(line)
        upper = c.upper()
        if "한국철도공사" in c:
            return "한국철도공사", False
        if "KORAIL" in upper and ("한국" in c or "철도" in c or "공사" in c):
            return "한국철도공사", False
        if "RAIL" in upper or "철도공사" in c or "협도공사" in c:
            return None, True
    return None, True


def detect_transport_type(text: str, departure: str | None = None, arrival: str | None = None) -> str:
    upper = str(text or "").upper()
    railway_markers = ["KTX", "SRT", "KORAIL", "한국철도", "철도공사", "공항직통", "열차", "TRAIN"]
    if "KTX" in upper:
        return "KTX"
    if "SRT" in upper:
        return "SRT"
    if any(marker.upper() in upper for marker in railway_markers):
        return "열차"
    # `승차권`은 버스/열차 모두 쓰는 단어다. 단독으로 열차로 확정하지 않는다.
    if any(x in {departure, arrival} for x in ["동서울", "횡계"]):
        return "버스"
    if any(k in str(text or "") for k in ["버스", "터미널", "고속", "시외"]):
        return "버스"
    if departure or arrival:
        return "교통"
    return "교통"


def build_description(transport_type: str, departure: str | None, arrival: str | None) -> str:
    prefix = transport_type if transport_type else "교통"
    if departure and arrival:
        return f"{prefix} {departure} → {arrival}"
    return prefix if prefix != "교통" else "교통비"


def parse_transport_receipt(ocr_text: str | None) -> dict[str, Any]:
    lines = lines_from_text(ocr_text)
    text = "\n".join(lines)

    total, total_src = amount_after_label(lines, TOTAL_LABELS)
    fare, fare_src = amount_after_label(lines, FARE_LABELS)
    discount, discount_src = amount_after_label(lines, DISCOUNT_LABELS)

    # 버스표처럼 라벨이 깨져도 금액이 12,900 한 종류만 반복되면 그 값을 총액으로 사용한다.
    if total is None:
        all_money: list[float] = []
        for line in lines:
            all_money.extend([v for v in money_values(line) if v >= 100])
        if all_money:
            counts: dict[int, int] = {}
            for value in all_money:
                counts[int(value)] = counts.get(int(value), 0) + 1
            best_amount = sorted(counts.items(), key=lambda x: (x[1], x[0]), reverse=True)[0][0]
            total = float(best_amount)
            total_src = "transport_repeated_amount_fallback"

    review_reasons: list[str] = []

    if total is None and fare is not None and discount is not None and fare > discount:
        total = fare - discount
        total_src = "운임요금-할인금액 추정"
        review_reasons.append("영수액 라벨을 찾지 못해 운임요금-할인금액으로 총액을 추정했습니다.")
    elif total is None and fare is not None:
        total = fare
        total_src = fare_src
        review_reasons.append("영수액/결제금액 라벨 없이 운임요금을 총액 후보로 사용했습니다. 원본 확인이 필요합니다.")

    departure, arrival = extract_route(lines)
    if not departure or not arrival:
        review_reasons.append("출발지/도착지 추출이 불확실합니다.")

    vendor, weak_vendor = vendor_candidate(lines)
    if weak_vendor:
        review_reasons.append("운송사/발행기관 상호가 OCR에서 깨졌거나 불확실합니다.")

    expense_date = extract_date(text)
    if not expense_date:
        review_reasons.append("승차/결제 일자 추출이 불확실합니다.")

    transport_type = detect_transport_type(text, departure, arrival)
    description = build_description(transport_type, departure, arrival)

    item_amount = total
    data = {
        "document_type": "TRANSPORT_RECEIPT",
        "expense_category_code": "TRANSPORT",
        "expense_category_name": "교통비",
        "category": "교통비",
        "expense_date": expense_date,
        "vendor_name": vendor,
        "transport_type": transport_type,
        "departure_place": departure,
        "arrival_place": arrival,
        "fare_amount": fare,
        "discount_amount": discount,
        "total_amount": total,
        "payment_method": "현금" if "현금" in text else ("카드" if "카드" in text or "신용" in text else None),
        "item_description": description,
        "description": description,
        "items": [
            {
                "item_name": description,
                "description": description,
                "quantity": 1,
                "unit_price": item_amount,
                "amount": item_amount,
                "expense_category_code": "TRANSPORT",
                "expense_category_name": "교통비",
                "expense_date": expense_date,
                "vendor_name": vendor,
            }
        ] if item_amount is not None else [],
        "needs_review": bool(review_reasons),
        "review_reason": review_reasons,
        "review_reasons": review_reasons,
        "transport_amount_sources": {
            "total": total_src,
            "fare": fare_src,
            "discount": discount_src,
        },
    }
    return data


def is_transport_text(text: str | None) -> bool:
    s = str(text or "")
    return any(k.lower() in s.lower() for k in TRANSPORT_KEYWORDS)
