from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from app.config import settings
from app.services.llm.json_repair import extract_json_object
from app.services.llm.prompt_builder import build_extraction_prompt


def call_llm_structure(
    *,
    ocr_text: str,
    document_type: str | None,
    seed_data: dict[str, Any],
    reference_context: dict[str, Any] | None,
) -> dict[str, Any] | None:
    provider = (settings.LLM_PROVIDER or "local").lower()
    prompt = build_extraction_prompt(
        ocr_text=ocr_text,
        document_type=document_type,
        reference_context=reference_context,
        seed_data=seed_data,
    )

    if provider == "openai":
        raw = call_openai(prompt)
    else:
        raw = call_local_llm(prompt)

    parsed = extract_json_object(raw)
    if not isinstance(parsed, dict):
        return None
    return parsed


def call_local_llm(prompt: str) -> str:
    payload = {
        "model": settings.LOCAL_LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.0,
            "num_predict": 1600,
        },
    }
    request = urllib.request.Request(
        settings.LOCAL_LLM_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=settings.LLM_TIMEOUT_SECONDS) as response:
        body = response.read().decode("utf-8", errors="replace")
    data = json.loads(body or "{}")
    return str(data.get("response") or data.get("message") or body)


def call_openai(prompt: str) -> str:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY가 설정되지 않았습니다.")
    payload = {
        "model": settings.OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": "You extract Korean receipt data into strict JSON only."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.LLM_TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API 오류: {exc.code} {detail[:300]}") from exc
    data = json.loads(body or "{}")
    return str(data["choices"][0]["message"]["content"])
