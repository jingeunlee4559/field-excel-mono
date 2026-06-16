from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

# 기본 내장 보정값은 최소한만 둔다.
# 운영에서는 backend DB correction_dictionaries(status=APPROVED)에서 내려오는 값을 우선 적용한다.
BUILTIN_VENDOR_CORRECTIONS: dict[str, str] = {
    "매머드익스프레스": "매머드 익스프레스",
    "매머드 익스프레스": "매머드 익스프레스",
    "맥먹드익스프레스": "매머드 익스프레스",
    "맥머드익스프레스": "매머드 익스프레스",
    "매먹드익스프레스": "매머드 익스프레스",
    "메머드익스프레스": "매머드 익스프레스",
    "맥먹드익스프래스": "매머드 익스프레스",
    "매머드익스프래스": "매머드 익스프레스",
    "mammothexpress": "매머드 익스프레스",
    "mammoth": "매머드 익스프레스",
    "국민가게다이소": "다이소",
    "아성다이소": "다이소",
    "파리바게트": "파리바게뜨",
    "PARISBAGUETTE": "파리바게뜨",
    "파리바게뜨": "파리바게뜨",
    "송림전집": "송림전집",
    "송림 전집": "송림전집",
    "승림전집": "송림전집",
}

STANDARD_VENDOR_NAMES = [
    "매머드 익스프레스",
    "다이소",
    "파리바게뜨",
    "스타벅스",
    "이디야커피",
    "메가커피",
    "컴포즈커피",
    "파리바게뜨",
    "송림전집",
]

VENDOR_EXCLUDE_PATTERNS = [
    r"영수증|매출전표|고객용|재발행|전표|\[[0-9A-Za-z\s]+\]",
    r"상품명|제품명|품명|상품|수량|단가|금액|테이블명|판매시간|판매사원",
    r"합계|총액|부가세|공급가액|공급가|과세|면세|판매|가액|세액",
    r"카드|승인|결제|일시불|포인트|멤버십|스탬프|스탭프",
    r"전화|tel|fax|주소|본사|대표|사업자|번호",
    r"문의|교환|환불|이벤트|쿠폰|적립",
]

# 사용처로 들어오면 안 되는 대표 품목/옵션/정산 단어.
# LLM이 품목명을 사용처로 올리는 것을 차단하기 위한 일반 방어 규칙이다.
VENDOR_PRODUCT_NOISE_PATTERN = re.compile(
    r"라떼|커피|아메리카노|에이드|스무디|티|차|버거|샌드|샌드위치|빵|케이크|"
    r"우동|카츠|가라아게|치킨|라멘|국수|돈까스|돈가스|소주|맥주|김치전|모듬전|파전|"
    r"물티슈|키친타올|타올|티슈|봉투|쇼핑백|컵|비누|가위|패치|핸드워시|"
    r"ICE|HOT|SIZE|아이스|옵션|단품",
    re.IGNORECASE,
)


def compact_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = text.replace("㈜", "").replace("(주)", "").replace("주식회사", "")
    text = re.sub(r"[\s\"'‘’“”_\-.,()\[\]{}:/\\|*×]+", "", text)
    return text


def is_bad_vendor_candidate(value: Any) -> bool:
    text = str(value or "").strip()
    compact = compact_text(text)
    if len(compact) < 2 or len(compact) > 40:
        return True
    if any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in VENDOR_EXCLUDE_PATTERNS):
        return True
    if VENDOR_PRODUCT_NOISE_PATTERN.search(text) and not re.search(r"점|마트|식당|카페|전집|베이커리|익스프레스|프레스|바게뜨|BAGUETTE", text, flags=re.IGNORECASE):
        return True
    if re.fullmatch(r"[\d\s,.:/\-()원]+", text):
        return True
    if re.search(r"\d{2,4}-\d{3,4}-\d{4}|\d{3}-\d{2}-\d{5}", text):
        return True
    if re.search(r"[가-힣A-Za-z0-9]+로\s*\d+|[가-힣A-Za-z0-9]+길\s*\d+|번길", text):
        return True
    if len(re.findall(r"[가-힣A-Za-z]", text)) < 2:
        return True
    return False


def _load_context_corrections(reference_context: dict[str, Any] | None) -> dict[str, str]:
    corrections: dict[str, str] = {}
    if not reference_context:
        return corrections

    for row in reference_context.get("correctionDictionaries") or []:
        if not isinstance(row, dict):
            continue
        dtype = str(row.get("dictionaryType") or row.get("dictionary_type") or "").upper()
        if dtype not in {"VENDOR", "OCR_TEXT"}:
            continue
        wrong = row.get("wrongText") or row.get("wrong_text")
        corrected = row.get("correctedText") or row.get("corrected_text")
        status = str(row.get("status") or "APPROVED").upper()
        active = str(row.get("activeYn") or row.get("active_yn") or "Y").upper()
        if wrong and corrected and status == "APPROVED" and active == "Y":
            corrections[compact_text(wrong)] = str(corrected).strip()
    return corrections


def normalize_vendor_name(raw_vendor: Any, reference_context: dict[str, Any] | None = None) -> dict[str, Any]:
    raw = str(raw_vendor or "").strip()
    if not raw:
        return {
            "raw": None,
            "normalized": None,
            "changed": False,
            "source": "EMPTY",
            "confidence": 0.0,
        }

    if is_bad_vendor_candidate(raw):
        # 나쁜 후보라도 보정 사전에 정확히 있으면 살릴 수 있다.
        pass

    key = compact_text(raw)
    context_corrections = _load_context_corrections(reference_context)
    corrections = {compact_text(k): v for k, v in BUILTIN_VENDOR_CORRECTIONS.items()}
    corrections.update(context_corrections)

    if key in corrections:
        normalized = corrections[key]
        return {
            "raw": raw,
            "normalized": normalized,
            "changed": normalized != raw,
            "source": "DICTIONARY",
            "confidence": 0.96,
        }

    # 포함형 보정: '(주)아성다이소_의정부민락점'처럼 지점명이 붙은 경우.
    for wrong_key, corrected in corrections.items():
        if wrong_key and wrong_key in key:
            return {
                "raw": raw,
                "normalized": corrected,
                "changed": corrected != raw,
                "source": "DICTIONARY_CONTAINS",
                "confidence": 0.90,
            }

    standard_keys = {compact_text(name): name for name in STANDARD_VENDOR_NAMES}
    best_name = None
    best_ratio = 0.0
    for standard_key, standard_name in standard_keys.items():
        if not standard_key:
            continue
        ratio = SequenceMatcher(None, key, standard_key).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_name = standard_name

    if best_name and best_ratio >= 0.82:
        return {
            "raw": raw,
            "normalized": best_name,
            "changed": best_name != raw,
            "source": "FUZZY_VENDOR",
            "confidence": round(best_ratio, 4),
        }

    return {
        "raw": raw,
        "normalized": raw,
        "changed": False,
        "source": "RAW",
        "confidence": 0.70 if not is_bad_vendor_candidate(raw) else 0.40,
    }
