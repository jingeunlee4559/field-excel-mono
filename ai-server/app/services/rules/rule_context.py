from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

from app.services.rules.constants import CATEGORY_CODE_TO_NAME, CATEGORY_NAME_TO_CODE

# -----------------------------------------------------------------------------
# DB Rule Context runtime helpers
# -----------------------------------------------------------------------------
# 핵심 정책
# - DB는 규칙/보정/기준의 원본이다.
# - Python은 DB rule_context를 실행하는 엔진이다.
# - rule_context는 한 번 준비해서 메모리 캐시로 재사용한다.
# - OCR_TEXT/ITEM 보정은 전체 규칙을 무조건 반복하지 않고, 타입별 인덱스를 우선 사용한다.
# - 감열지 OCR에서 흔한 반복 꼬리(요요요, 볼볼볼, 이이이 등)는 품목명 정규화에서 구조적으로 제거한다.

_CONTEXT_PREPARE_CACHE: dict[tuple[int, tuple[int, ...]], dict[str, Any]] = {}
_CONTEXT_PREPARE_CACHE_LIMIT = 16


def _get(row: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in row and row.get(key) not in (None, ""):
            return row.get(key)
    return default


@lru_cache(maxsize=20000)
def _compact_cached(value: str) -> str:
    return re.sub(r"[\s\"'‘’“”_\-.,()\[\]{}:/\\|*×]+", "", value.strip().lower())


def compact_text(value: Any) -> str:
    return _compact_cached(str(value or ""))


def collapse_ocr_ghost_repeats(value: Any) -> str:
    """품목명 끝에 생기는 OCR 반복 꼬리를 구조적으로 제거한다.

    예:
    - 감바스 알 아히요요요요 -> 감바스 알 아히요
    - 월간 모히또 하이볼볼볼볼 -> 월간 모히또 하이볼
    - 월간 피치 얼그레이이이이 -> 월간 피치 얼그레이

    특정 영수증/상호/금액 고정이 아니라, 같은 음절이 과도하게 반복되는 OCR 잡음만 제거한다.
    """
    text = str(value or "").strip()
    if not text:
        return text

    # 같은 한글 음절이 3회 이상 반복되면 1회로 축약한다.
    text = re.sub(r"([가-힣])\1{2,}", r"\1", text)

    # 꼬리에서 직전 1~2글자 토큰이 여러 번 반복되는 케이스 축약.
    # 예: 하이볼볼볼 -> 하이볼, 얼그레이이 -> 얼그레이
    # 너무 공격적으로 줄이지 않기 위해 최대 4회만 반복 수행한다.
    for _ in range(4):
        before = text
        text = re.sub(r"([가-힣])\1+$", r"\1", text)
        text = re.sub(r"([가-힣]{2})\1{1,}$", r"\1", text)
        if text == before:
            break

    # 끝에 붙은 의미 없는 한 글자 알파벳/OCR 잔여 문자 제거. 예: 2A, THY는 파서 쪽에서도 제거한다.
    text = re.sub(r"\s+[A-Za-z0-9]{1,3}$", "", text).strip()
    return text


def normalize_match_type(value: Any) -> str:
    match_type = str(value or "CONTAINS").strip().upper()
    return match_type if match_type in {"EXACT", "CONTAINS", "REGEX", "FUZZY"} else "CONTAINS"


def _is_active(row: dict[str, Any]) -> bool:
    active = str(_get(row, "activeYn", "active_yn", default="Y")).upper()
    status = str(_get(row, "status", default="APPROVED")).upper()
    is_active = _get(row, "isActive", "is_active", default=True)
    return active != "N" and status in {"APPROVED", "", "Y"} and is_active is not False and is_active != 0


def _context_signature(context: dict[str, Any] | None) -> tuple[int, tuple[int, ...]]:
    if not isinstance(context, dict):
        return (0, ())
    keys = (
        "correctionDictionaries",
        "documentTypeRules",
        "sectionRules",
        "validationRules",
        "documentTypeFields",
        "expenseCategories",
    )
    return (id(context), tuple(len(context.get(k) or []) for k in keys))


def context_rows(context: dict[str, Any] | None, key: str) -> list[dict[str, Any]]:
    if not isinstance(context, dict):
        return []
    rows = context.get(key) or []
    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict)]


def _prepare_rule_row(row: dict[str, Any]) -> dict[str, Any]:
    wrong = str(_get(row, "wrongText", "wrong_text", default="") or "").strip()
    corrected = str(_get(row, "correctedText", "corrected_text", default="") or "").strip()
    match_type = normalize_match_type(_get(row, "matchType", "match_type"))
    prepared = dict(row)
    prepared["_wrong"] = wrong
    prepared["_wrongCompact"] = compact_text(wrong)
    prepared["_corrected"] = corrected
    prepared["_matchType"] = match_type
    if match_type == "REGEX" and wrong:
        try:
            prepared["_regex"] = re.compile(wrong, flags=re.IGNORECASE)
        except re.error:
            prepared["_regex"] = None
    return prepared


def prepare_rule_context(context: dict[str, Any] | None) -> dict[str, Any]:
    signature = _context_signature(context)
    if signature in _CONTEXT_PREPARE_CACHE:
        return _CONTEXT_PREPARE_CACHE[signature]

    corrections_by_type: dict[str, list[dict[str, Any]]] = {}
    for row in context_rows(context, "correctionDictionaries"):
        if not _is_active(row):
            continue
        dtype = str(_get(row, "dictionaryType", "dictionary_type", default="")).upper()
        if not dtype:
            continue
        wrong = _get(row, "wrongText", "wrong_text")
        corrected = _get(row, "correctedText", "corrected_text")
        if not wrong or corrected in (None, ""):
            continue
        corrections_by_type.setdefault(dtype, []).append(_prepare_rule_row(row))

    for rows in corrections_by_type.values():
        rows.sort(key=lambda row: int(_get(row, "priority", default=100) or 100))

    validation_by_code: dict[str, dict[str, Any]] = {}
    for row in context_rows(context, "validationRules"):
        code = str(_get(row, "ruleCode", "rule_code", default="")).upper()
        if code:
            validation_by_code[code] = row

    document_type_rules: list[dict[str, Any]] = []
    for row in context_rows(context, "documentTypeRules"):
        if str(_get(row, "activeYn", "active_yn", default="Y")).upper() == "N":
            continue
        prepared = dict(row)
        keyword = str(_get(row, "keyword", default="") or "").strip()
        prepared["_keyword"] = keyword
        prepared["_keywordCompact"] = compact_text(keyword)
        prepared["_matchType"] = normalize_match_type(_get(row, "matchType", "match_type"))
        document_type_rules.append(prepared)

    section_rules_by_type: dict[str, list[dict[str, Any]]] = {}
    for row in context_rows(context, "sectionRules"):
        if str(_get(row, "activeYn", "active_yn", default="Y")).upper() == "N":
            continue
        section = str(_get(row, "sectionType", "section_type", default="")).upper()
        if not section:
            continue
        prepared = dict(row)
        prepared["_keyword"] = str(_get(row, "keyword", default="") or "").strip()
        section_rules_by_type.setdefault(section, []).append(prepared)

    prepared_context = {
        "correctionsByType": corrections_by_type,
        "validationByCode": validation_by_code,
        "documentTypeRulesPrepared": document_type_rules,
        "sectionRulesByType": section_rules_by_type,
    }

    if len(_CONTEXT_PREPARE_CACHE) >= _CONTEXT_PREPARE_CACHE_LIMIT:
        _CONTEXT_PREPARE_CACHE.clear()
    _CONTEXT_PREPARE_CACHE[signature] = prepared_context
    return prepared_context


def match_rule(text: str, pattern: Any, match_type: Any = "CONTAINS") -> bool:
    source = str(text or "")
    keyword = str(pattern or "").strip()
    if not source or not keyword:
        return False

    match = normalize_match_type(match_type)
    if match == "EXACT":
        return compact_text(source) == compact_text(keyword)
    if match == "REGEX":
        try:
            return re.search(keyword, source, flags=re.IGNORECASE) is not None
        except re.error:
            return keyword.lower() in source.lower()
    # FUZZY는 현재 최소형에서는 CONTAINS로 방어적으로 처리한다.
    source_compact = compact_text(source)
    keyword_compact = compact_text(keyword)
    return keyword_compact in source_compact or keyword.lower() in source.lower()


def _match_prepared_rule(source: str, source_compact: str, row: dict[str, Any]) -> bool:
    wrong = row.get("_wrong") or str(_get(row, "wrongText", "wrong_text", default="") or "").strip()
    if not wrong:
        return False
    match_type = row.get("_matchType") or normalize_match_type(_get(row, "matchType", "match_type"))
    if match_type == "EXACT":
        return source_compact == (row.get("_wrongCompact") or compact_text(wrong))
    if match_type == "REGEX":
        regex = row.get("_regex")
        if regex is not None:
            return regex.search(source) is not None
        try:
            return re.search(wrong, source, flags=re.IGNORECASE) is not None
        except re.error:
            return wrong.lower() in source.lower()
    wrong_compact = row.get("_wrongCompact") or compact_text(wrong)
    return bool(wrong_compact and wrong_compact in source_compact) or wrong.lower() in source.lower()


def get_corrections(context: dict[str, Any] | None, dictionary_types: set[str] | None = None) -> list[dict[str, Any]]:
    prepared = prepare_rule_context(context)
    by_type = prepared.get("correctionsByType", {})
    if dictionary_types:
        rows: list[dict[str, Any]] = []
        for dtype in {t.upper() for t in dictionary_types}:
            rows.extend(by_type.get(dtype, []))
        rows.sort(key=lambda row: int(_get(row, "priority", default=100) or 100))
        return rows
    rows = []
    for values in by_type.values():
        rows.extend(values)
    rows.sort(key=lambda row: int(_get(row, "priority", default=100) or 100))
    return rows


def apply_reference_text_corrections(text: str | None, context: dict[str, Any] | None) -> str:
    """OCR_TEXT 보정사전을 원문에 적용한다.

    속도 정책:
    - OCR_TEXT 타입만 사용한다.
    - CONTAINS/EXACT는 실제 포함될 때만 replace한다.
    - REGEX는 미리 compile된 객체를 사용한다.
    """
    result = str(text or "")
    if not result:
        return result
    result_compact = compact_text(result)
    for row in get_corrections(context, {"OCR_TEXT"}):
        wrong = row.get("_wrong") or ""
        corrected = row.get("_corrected") or ""
        if not wrong or not corrected:
            continue
        match_type = row.get("_matchType") or "CONTAINS"
        if match_type == "REGEX":
            regex = row.get("_regex")
            try:
                result = regex.sub(corrected, result) if regex is not None else re.sub(wrong, corrected, result, flags=re.IGNORECASE)
                result_compact = compact_text(result)
            except re.error:
                continue
            continue
        wrong_compact = row.get("_wrongCompact") or compact_text(wrong)
        if wrong not in result and wrong.lower() not in result.lower() and wrong_compact not in result_compact:
            continue
        result = result.replace(wrong, corrected)
        result = re.sub(re.escape(wrong), corrected, result, flags=re.IGNORECASE)
        result_compact = compact_text(result)
    return result


def normalize_value_by_dictionary(value: Any, context: dict[str, Any] | None, dictionary_types: set[str]) -> str:
    raw = str(value or "").strip()
    if not raw:
        return raw
    normalized = raw
    for row in get_corrections(context, dictionary_types):
        wrong = row.get("_wrong") or ""
        corrected = row.get("_corrected") or ""
        if not wrong or not corrected:
            continue
        source_compact = compact_text(normalized)
        if not _match_prepared_rule(normalized, source_compact, row):
            continue
        match_type = row.get("_matchType") or "CONTAINS"
        if match_type == "EXACT":
            normalized = corrected
        elif match_type == "REGEX":
            regex = row.get("_regex")
            try:
                normalized = regex.sub(corrected, normalized) if regex is not None else re.sub(wrong, corrected, normalized, flags=re.IGNORECASE)
            except re.error:
                pass
        else:
            normalized = normalized.replace(wrong, corrected)
            normalized = re.sub(re.escape(wrong), corrected, normalized, flags=re.IGNORECASE)
    return collapse_ocr_ghost_repeats(normalized).strip()


def normalize_item_name_with_context(value: Any, context: dict[str, Any] | None) -> str:
    return normalize_value_by_dictionary(value, context, {"ITEM", "OCR_TEXT"})


def normalize_payment_with_context(value: Any, context: dict[str, Any] | None) -> str:
    return normalize_value_by_dictionary(value, context, {"PAYMENT", "OCR_TEXT"})


def _category_from_corrected_text(corrected: Any, context: dict[str, Any] | None) -> tuple[str, str] | None:
    raw = str(corrected or "").strip()
    if not raw:
        return None
    code = raw.upper()
    if code in CATEGORY_CODE_TO_NAME:
        return code, CATEGORY_CODE_TO_NAME.get(code, "기타")
    if raw in CATEGORY_NAME_TO_CODE:
        return CATEGORY_NAME_TO_CODE[raw], raw

    for row in context_rows(context, "expenseCategories"):
        row_code = str(_get(row, "categoryCode", "category_code", default="")).upper()
        row_name = str(_get(row, "categoryName", "category_name", default=""))
        if raw == row_name or code == row_code:
            return row_code, row_name
    return None


def _is_unsafe_category_keyword(row: dict[str, Any]) -> bool:
    """CATEGORY 분류에서만 적용하는 과매칭 방어 규칙.

    OCR_TEXT/ITEM 보정은 짧은 토큰이 필요할 수 있지만, 경비 카테고리는
    `자`, `심`, `칼` 같은 1글자 CONTAINS가 대표자/주소/사용자 문구에 걸리면
    전체 문서가 잘못 확정된다. 그래서 CATEGORY 타입에 한해 짧은 포함매칭을 차단한다.
    """
    match_type = row.get("_matchType") or normalize_match_type(_get(row, "matchType", "match_type"))
    wrong = row.get("_wrong") or str(_get(row, "wrongText", "wrong_text", default="") or "").strip()
    wrong_compact = row.get("_wrongCompact") or compact_text(wrong)

    if not wrong_compact:
        return True

    if match_type in {"CONTAINS", "FUZZY"}:
        # 한글/숫자/영문 1글자 포함매칭은 카테고리 확정 근거로 쓰지 않는다.
        if len(wrong_compact) <= 1:
            return True
        # 영문/숫자 2글자 토큰은 tel, no, pos 등 일반 문서 조각과 충돌하기 쉽다.
        if len(wrong_compact) <= 2 and re.fullmatch(r"[a-z0-9]+", wrong_compact):
            return True

    return False


def _category_rule_score(row: dict[str, Any]) -> float:
    match_type = row.get("_matchType") or normalize_match_type(_get(row, "matchType", "match_type"))
    wrong = row.get("_wrong") or str(_get(row, "wrongText", "wrong_text", default="") or "").strip()
    wrong_compact = row.get("_wrongCompact") or compact_text(wrong)
    priority = int(_get(row, "priority", default=100) or 100)

    if match_type == "EXACT":
        base = 100.0
    elif match_type == "REGEX":
        base = 70.0
    else:
        base = 45.0

    # 긴 업무 키워드일수록 우연 매칭 가능성이 낮다.
    length_bonus = min(40.0, len(wrong_compact) * 6.0)
    # priority는 보조 근거로만 사용한다. 낮은 숫자가 더 높다.
    priority_bonus = max(0.0, 25.0 - (priority * 0.15))
    return base + length_bonus + priority_bonus


def classify_category_with_context(
    text: str | None,
    document_type: str | None,
    context: dict[str, Any] | None,
) -> tuple[str, str] | None:
    doc = str(document_type or "").upper()
    source = str(text or "")
    if "TRANSPORT" in doc:
        return "TRANSPORT", "교통비"

    source_compact = compact_text(source)
    scores: dict[str, dict[str, Any]] = {}

    for row in get_corrections(context, {"CATEGORY"}):
        if _is_unsafe_category_keyword(row):
            continue
        if not _match_prepared_rule(source, source_compact, row):
            continue

        category = _category_from_corrected_text(
            row.get("_corrected") or _get(row, "correctedText", "corrected_text"),
            context,
        )
        if not category:
            continue

        code, name = category
        bucket = scores.setdefault(code, {"code": code, "name": name, "score": 0.0, "hitCount": 0})
        bucket["score"] += _category_rule_score(row)
        bucket["hitCount"] += 1

    if not scores:
        return None

    ranked = sorted(scores.values(), key=lambda item: (item["score"], item["hitCount"]), reverse=True)
    top = ranked[0]
    runner_up = ranked[1] if len(ranked) > 1 else None

    # 점수가 너무 낮으면 DB 사전만으로 확정하지 않는다.
    if top["score"] < 55:
        return None

    # 서로 다른 카테고리 근거가 비슷하면 확정하지 않고 후속 규칙/검증에 맡긴다.
    if runner_up and (top["score"] - runner_up["score"] < 20):
        return None

    return str(top["code"]), str(top["name"])


def classify_document_type_with_context(
    text: str | None,
    requested: str | None,
    context: dict[str, Any] | None,
) -> str | None:
    req = str(requested or "").strip().upper()
    if req and req not in {"RECEIPT", "영수증"}:
        return req

    source = str(text or "")
    source_compact = compact_text(source)
    scores: dict[str, int] = {}
    for row in prepare_rule_context(context).get("documentTypeRulesPrepared", []):
        keyword = row.get("_keyword") or ""
        if not keyword:
            continue
        match_type = row.get("_matchType") or "CONTAINS"
        matched = False
        if match_type == "EXACT":
            matched = source_compact == (row.get("_keywordCompact") or compact_text(keyword))
        elif match_type == "REGEX":
            try:
                matched = re.search(keyword, source, flags=re.IGNORECASE) is not None
            except re.error:
                matched = keyword.lower() in source.lower()
        else:
            matched = (row.get("_keywordCompact") or compact_text(keyword)) in source_compact or keyword.lower() in source.lower()
        if not matched:
            continue
        doc_type = str(_get(row, "documentType", "document_type", default="")).upper()
        if not doc_type:
            continue
        scores[doc_type] = scores.get(doc_type, 0) + int(_get(row, "score", default=10) or 10)
    if not scores:
        return None
    best_type, best_score = sorted(scores.items(), key=lambda item: item[1], reverse=True)[0]
    return best_type if best_score >= 20 else None


def get_section_keywords(
    context: dict[str, Any] | None,
    section_type: str,
    document_type: str | None = None,
) -> list[str]:
    section = str(section_type or "").upper()
    doc = str(document_type or "").upper()
    keywords: list[str] = []
    for row in prepare_rule_context(context).get("sectionRulesByType", {}).get(section, []):
        row_doc = str(_get(row, "documentType", "document_type", default="")).upper()
        if doc and row_doc not in {doc, "RECEIPT", "ITEM_RECEIPT", "ALL", "COMMON"}:
            continue
        keyword = str(row.get("_keyword") or _get(row, "keyword", default="") or "").strip()
        if keyword:
            keywords.append(keyword)
    return keywords


def get_validation_rule(context: dict[str, Any] | None, rule_code: str) -> dict[str, Any] | None:
    target = str(rule_code or "").upper()
    return prepare_rule_context(context).get("validationByCode", {}).get(target)


def validation_rule_active(context: dict[str, Any] | None, rule_code: str, default: bool = True) -> bool:
    row = get_validation_rule(context, rule_code)
    if row is None:
        return default
    active = _get(row, "isActive", "is_active", default=True)
    return active is True or active == 1 or str(active).upper() == "Y"


def validation_condition(context: dict[str, Any] | None, rule_code: str, key: str, default: Any = None) -> Any:
    row = get_validation_rule(context, rule_code)
    if row is None:
        return default
    condition = _get(row, "conditionJson", "condition_json", default={})
    if not isinstance(condition, dict):
        return default
    return condition.get(key, default)


def required_document_fields(context: dict[str, Any] | None, document_type: str | None) -> list[dict[str, Any]]:
    doc = str(document_type or "RECEIPT").upper()
    rows: list[dict[str, Any]] = []
    for row in context_rows(context, "documentTypeFields"):
        row_doc = str(_get(row, "documentType", "document_type", default="")).upper()
        if row_doc not in {doc, "RECEIPT"}:
            continue
        if str(_get(row, "requiredYn", "required_yn", default="N")).upper() != "Y":
            continue
        rows.append(row)
    rows.sort(key=lambda row: int(_get(row, "sortOrder", "sort_order", default=1000) or 1000))
    return rows
