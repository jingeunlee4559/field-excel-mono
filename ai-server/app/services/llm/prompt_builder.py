from __future__ import annotations

from typing import Any

from app.services.llm.prompt_loader import build_prompt
from app.services.extractors.simple_rule_extractor import dumps_compact


def build_extraction_prompt(
    ocr_text: str,
    document_type: str | None = "RECEIPT",
    reference_context: dict[str, Any] | None = None,
    seed_data: dict[str, Any] | None = None,
) -> str:
    """Build the LLM prompt only when rule-based extraction needs help."""
    prompt_name = "transport_receipt_extractor.txt" if "TRANSPORT" in str(document_type or "").upper() else "item_receipt_extractor.txt"
    reference_json = dumps_compact(reference_context or {}) if reference_context else ""
    seed_json = dumps_compact(seed_data or {})
    base = build_prompt(prompt_name, ocr_text=ocr_text, reference_context=reference_json, extracted_json=seed_json)
    contract = """

[출력 규칙]
- JSON 객체 하나만 출력한다. 설명 문장, Markdown, 코드블록은 금지한다.
- OCR 원문에 없는 품목/금액은 만들지 않는다.
- 품목은 실제 상품/서비스명만 items에 넣는다. 합계, 부가세, 공급가액, 승인번호, 카드번호, 포인트, 사업자번호는 품목 금지.
- total_amount/paid_amount/claim_amount는 실제 결제·승인·청구 금액을 우선한다.
- sale_total_amount는 할인/포인트 차감 전 판매합계다. discount_amount가 있으면 sale_total_amount - discount_amount = paid_amount 관계를 확인한다.
- 품목 합계는 sale_total_amount 또는 total_amount+discount_amount와 비교한다. 불일치하면 needs_review=true와 review_reasons를 반드시 넣는다.
- 봉투/쇼핑백/포장비처럼 50원/100원 소액 품목도 OCR 원문 근거가 있으면 items에 반드시 포함한다.
- 필드명은 snake_case를 사용한다.
""".strip()
    return base + "\n\n" + contract
