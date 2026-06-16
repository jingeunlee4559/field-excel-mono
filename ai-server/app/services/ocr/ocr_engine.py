import json
import math
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.config import settings


_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp",
    ".tif",
    ".tiff",
}

_PDF_EXTENSIONS = {
    ".pdf",
}

_ocr_instance = None
_LAST_OCR_META: dict[str, Any] = {}


# =========================================================
# OCR INSTANCE
# =========================================================

def get_ocr():
    """
    PaddleOCR 인스턴스를 싱글톤으로 생성한다.

    중요:
    - PaddleOCR 3.x의 문서 방향 분류/문서 unwarp가 영수증을 180도로 잘못 돌리는 경우가 있다.
    - 사용자가 올린 음식점 영수증 로그에서도 doc_preprocessor_res.angle=180으로 잡혀
      정상 방향 영수증이 뒤집힌 상태로 OCR되어 품목/상호가 크게 깨졌다.
    - 그래서 1순위는 문서 방향 자동분류와 문서 unwarp를 끄고, 텍스트라인 방향 보정만 사용한다.
    - 버전별 옵션명이 다르므로 단계적으로 fallback한다.
    """
    global _ocr_instance

    if _ocr_instance is not None:
        return _ocr_instance

    try:
        from paddleocr import PaddleOCR
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "PaddleOCR을 불러오지 못했습니다. "
                "paddleocr 또는 paddlepaddle 설치 상태를 확인하세요."
            ),
        ) from exc

    init_errors = []

    option_candidates = [
        {
            "lang": "korean",
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": True,
            "show_log": False,
        },
        {
            "lang": "korean",
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": True,
        },
        {
            "lang": "korean",
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "show_log": False,
        },
        {
            "lang": "korean",
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
        },
        {
            "lang": "korean",
            "use_angle_cls": True,
            "show_log": False,
        },
        {
            "lang": "korean",
            "use_angle_cls": True,
        },
        {
            "lang": "korean",
        },
    ]

    for idx, kwargs in enumerate(option_candidates, start=1):
        try:
            _ocr_instance = PaddleOCR(**kwargs)
            print("[OCR INIT] PaddleOCR initialized", kwargs, flush=True)
            return _ocr_instance
        except Exception as exc:
            init_errors.append(f"{idx}차 초기화 실패({kwargs}): {str(exc)}")

    raise HTTPException(
        status_code=500,
        detail=(
            "PaddleOCR 초기화에 실패했습니다. "
            + " | ".join(init_errors)
        ),
    )


def warmup_ocr() -> None:
    """
    서버 시작 시 OCR 모델을 미리 로딩한다.
    """
    get_ocr()


def get_last_ocr_meta() -> dict[str, Any]:
    """
    가장 최근 OCR 실행 메타데이터 반환.
    구조화/검증 서비스에서 OCR 품질, blur 여부, 보완 필요 후보 여부를 참고할 수 있다.
    """
    return dict(_LAST_OCR_META or {})


def set_last_ocr_meta(meta: dict[str, Any]) -> None:
    global _LAST_OCR_META
    _LAST_OCR_META = meta or {}


# =========================================================
# ENTRY POINT
# =========================================================

def extract_text_from_file(file_path: str | Path, mode: str | None = None) -> str:
    path = Path(file_path)
    extension = path.suffix.lower()

    print("\n" + "=" * 80, flush=True)
    print("[OCR TARGET FILE]", flush=True)
    print(f"path: {path}", flush=True)
    print(f"exists: {path.exists()}", flush=True)

    if path.exists():
        print(f"size: {path.stat().st_size} bytes", flush=True)

    print(f"extension: {extension}", flush=True)
    print("=" * 80 + "\n", flush=True)

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"OCR 대상 파일을 찾을 수 없습니다: {path}",
        )

    if path.stat().st_size <= 0:
        raise HTTPException(
            status_code=400,
            detail="OCR 대상 파일 크기가 0입니다.",
        )

    if extension in _IMAGE_EXTENSIONS:
        return extract_text_from_image(path, mode=mode)

    if extension in _PDF_EXTENSIONS:
        return extract_text_from_pdf(path)

    raise HTTPException(
        status_code=400,
        detail="OCR은 이미지 파일 또는 PDF 파일만 지원합니다.",
    )


# =========================================================
# IMAGE OCR
# =========================================================

def extract_text_from_image(image_path: str | Path, mode: str | None = None) -> str:
    """
    이미지 OCR 실행.

    적용 개선:
    - EXIF 회전 보정
    - OCR 전 이미지 품질 검사
    - 너무 큰 이미지 축소
    - 조명/그림자 보정 후보
    - 원근 보정 후보
    - 문서/글자 영역 crop 후보
    - 표/라인 보존 후보
    - 기울기 보정
    - 회전 후보
    - 긴 영수증 split 후보
    - 후보별 OCR 품질 점수 계산
    - 금액/날짜/상호명 힌트 추출
    - 보완요청 후보 메타데이터 생성
    """
    ocr = get_ocr()
    temp_dir = None

    try:
        candidates, temp_dir, input_quality = preprocess_image_for_ocr(image_path, mode=mode)
        candidate_results: list[dict[str, Any]] = []

        for index, candidate in enumerate(candidates, start=1):
            label = candidate["label"]
            processed_path = candidate["path"]

            try:
                try:
                    result = ocr.ocr(str(processed_path), cls=True)
                except TypeError:
                    result = ocr.ocr(str(processed_path))
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail=f"이미지 OCR 처리에 실패했습니다: {str(exc)}",
                ) from exc

            print_ocr_raw_result(
                result,
                label=label,
                part_index=index,
                total_parts=len(candidates),
            )

            parsed = parse_paddle_result_with_scores(result)
            text = parsed["text"]
            rec_scores = parsed["scores"]
            engine_confidence = parsed["engine_confidence"]

            quality = calculate_ocr_text_quality(
                text=text,
                label=label,
                engine_confidence=engine_confidence,
                input_quality=input_quality,
            )

            field_hints = extract_field_hints_from_text(text)

            item = {
                "label": label,
                "path": str(processed_path),
                "text": text,
                "rec_scores": rec_scores,
                "engine_confidence": engine_confidence,
                "quality_score": quality["quality_score"],
                "quality_percent": quality["quality_percent"],
                "is_usable": quality["is_usable"],
                "reason": quality["reason"],
                "metrics": quality["metrics"],
                "field_hints": field_hints,
            }

            candidate_results.append(item)

            print("\n" + "=" * 80, flush=True)
            print(f"[OCR RESULT TEXT - {label} - {index}/{len(candidates)}]", flush=True)
            print("=" * 80, flush=True)
            print(text if text else "OCR로 추출된 텍스트가 없습니다.", flush=True)
            print("-" * 80, flush=True)
            print(f"engine_confidence: {engine_confidence}", flush=True)
            print(f"quality_score: {quality['quality_score']}", flush=True)
            print(f"quality_percent: {quality['quality_percent']}", flush=True)
            print(f"is_usable: {quality['is_usable']}", flush=True)
            print(f"reason: {quality['reason']}", flush=True)
            print(f"field_hints: {json.dumps(field_hints, ensure_ascii=False)}", flush=True)
            print("=" * 80 + "\n", flush=True)

        selected = select_best_ocr_candidates(candidate_results)
        merged_text = merge_selected_ocr_texts(selected)

        final_engine_confidence = calculate_average(
            [item.get("engine_confidence") for item in selected]
        )

        final_quality = calculate_ocr_text_quality(
            text=merged_text,
            label="merged_selected",
            engine_confidence=final_engine_confidence,
            input_quality=input_quality,
        )

        merged_field_hints = merge_field_hints(
            [item.get("field_hints") or {} for item in selected]
        )

        supplement_candidate = should_mark_as_supplement_candidate(
            input_quality=input_quality,
            final_quality=final_quality,
            merged_text=merged_text,
            field_hints=merged_field_hints,
        )

        meta = {
            "source": "PaddleOCR",
            "candidate_count": len(candidate_results),
            "selected_count": len(selected),
            "selected_labels": [item["label"] for item in selected],
            "best_label": selected[0]["label"] if selected else None,

            "ocr_confidence": final_quality["quality_score"],
            "ocr_confidence_percent": final_quality["quality_percent"],
            "ocr_quality_score": final_quality["quality_score"],
            "ocr_quality_percent": final_quality["quality_percent"],
            "engine_confidence": final_engine_confidence,

            "input_quality": input_quality,
            "supplement_candidate": supplement_candidate,

            "field_hints": merged_field_hints,

            "candidates": [
                {
                    "label": item["label"],
                    "quality_score": item["quality_score"],
                    "quality_percent": item["quality_percent"],
                    "selection_score": item.get("_selection_score"),
                    "engine_confidence": item["engine_confidence"],
                    "is_usable": item["is_usable"],
                    "reason": item["reason"],
                    "text_length": len(item["text"] or ""),
                    "field_hints": item.get("field_hints") or {},
                    # 구조화 단계에서 selected 1개 후보만 보지 않고,
                    # 다른 전처리 후보에 남아있는 정상 품목명을 rescue할 수 있게 원문을 함께 보관한다.
                    # 전체 이미지를 다시 OCR하지 않으므로 속도 영향은 거의 없다.
                    "text": item.get("text") or "",
                }
                for item in candidate_results
            ],
            "metrics": final_quality["metrics"],
        }

        set_last_ocr_meta(meta)

        print("\n" + "=" * 80, flush=True)
        print("[OCR SELECTED CANDIDATES]", flush=True)
        print(json.dumps(meta, ensure_ascii=False, indent=2, default=str), flush=True)
        print("=" * 80 + "\n", flush=True)

        print("\n" + "=" * 80, flush=True)
        print("[OCR RESULT TEXT - MERGED_SELECTED]", flush=True)
        print("=" * 80, flush=True)
        print(merged_text if merged_text else "OCR로 추출된 텍스트가 없습니다.", flush=True)
        print("=" * 80 + "\n", flush=True)

        return merged_text

    finally:
        if temp_dir:
            cleanup_temp_dir(temp_dir)


# =========================================================
# IMAGE PREPROCESS
# =========================================================

def normalize_ocr_mode(mode: str | None = None) -> str:
    value = (mode or settings.OCR_MODE or "auto").strip().lower()
    if value not in {"auto", "fast", "balanced", "deep"}:
        return "auto"
    return value


def decide_auto_ocr_mode(input_quality: dict[str, Any]) -> str:
    """속도/정확도 균형용 자동 OCR 모드.

    일반 이미지는 fast, 품질 문제가 있으면 balanced, 매우 흐림/어두움/과노출은 deep으로 승급한다.
    """
    if not input_quality.get("available", True):
        return "fast"
    if input_quality.get("very_blurry") or input_quality.get("too_dark") or input_quality.get("too_bright"):
        return "deep"
    if input_quality.get("too_small") or input_quality.get("low_contrast") or input_quality.get("blurry"):
        return "balanced"
    return "fast"


def preprocess_image_for_ocr(
    image_path: str | Path,
    mode: str | None = None,
) -> tuple[list[dict[str, Any]], Path | None, dict[str, Any]]:
    """
    OCR 정확도 개선용 multi-pass 전처리.

    후보:
    - exif_corrected_original
    - resized_color
    - enhanced_gray
    - illumination_corrected
    - shadow_removed_gray
    - line_preserved_gray
    - binary_full
    - document_warped
    - document_crop
    - deskewed_gray
    - rotation candidates
    - long receipt crops
    """
    try:
        import cv2
        import numpy as np
    except Exception as exc:
        print("[OCR PREPROCESS WARNING] opencv-python 또는 numpy가 없어 원본 이미지로 OCR합니다.", flush=True)
        print(str(exc), flush=True)
        return [{"label": "original", "path": Path(image_path)}], None, {
            "available": False,
            "reason": "opencv_or_numpy_not_available",
        }

    image_path = Path(image_path)
    ocr_mode = normalize_ocr_mode(mode)
    temp_dir = Path(tempfile.mkdtemp(prefix="ocr_preprocess_"))
    candidates: list[dict[str, Any]] = []

    exif_corrected_path = apply_exif_orientation(image_path, temp_dir)

    image = cv2.imdecode(
        np.fromfile(str(exif_corrected_path), dtype=np.uint8),
        cv2.IMREAD_COLOR,
    )

    if image is None:
        print("[OCR PREPROCESS WARNING] 이미지를 OpenCV로 읽지 못해 원본 이미지로 OCR합니다.", flush=True)
        return [{"label": "original", "path": image_path}], temp_dir, {
            "available": False,
            "reason": "opencv_read_failed",
        }

    original_height, original_width = image.shape[:2]

    input_quality = analyze_input_image_quality(image)
    requested_ocr_mode = ocr_mode
    if ocr_mode == "auto":
        ocr_mode = decide_auto_ocr_mode(input_quality)
        input_quality["requested_ocr_mode"] = requested_ocr_mode
        input_quality["resolved_ocr_mode"] = ocr_mode

    print("\n" + "=" * 80, flush=True)
    print("[OCR PREPROCESS]", flush=True)
    print(f"mode: {ocr_mode} (requested={requested_ocr_mode})", flush=True)
    print(f"original_width: {original_width}", flush=True)
    print(f"original_height: {original_height}", flush=True)
    print(f"input_quality: {json.dumps(input_quality, ensure_ascii=False, default=str)}", flush=True)
    print("=" * 80 + "\n", flush=True)

    resized_color = resize_image_for_ocr(
        image=image,
        min_width=1400,
        max_width=2200,
    )

    resized_color_path = temp_dir / "01_resized_color.png"
    write_image(resized_color_path, resized_color)
    candidates.append({"label": "resized_color", "path": resized_color_path})

    gray = cv2.cvtColor(resized_color, cv2.COLOR_BGR2GRAY)

    denoised = cv2.fastNlMeansDenoising(
        gray,
        None,
        h=7,
        templateWindowSize=7,
        searchWindowSize=21,
    )

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8),
    )
    enhanced = clahe.apply(denoised)

    sharpen_kernel = np.array(
        [
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0],
        ]
    )
    sharpened = cv2.filter2D(enhanced, -1, sharpen_kernel)

    enhanced_path = temp_dir / "02_enhanced_gray.png"
    write_image(enhanced_path, sharpened)

    # 1차 adaptive fast-pass에서는 OCR 후보를 1~2개로 제한한다.
    # 정확도 보강용 crop/line/binary 후보는 1차 검증 실패 후 balanced-pass에서만 실행한다.
    # 목적: 정상 사진은 빠르게 반환하고, 애매한 사진만 추가 비용을 쓴다.
    if ocr_mode == "fast":
        candidates.append({"label": "enhanced_gray_fast", "path": enhanced_path})
        candidates = filter_duplicate_candidate_paths(candidates)
        candidates = candidates[:2]
        print("\n" + "=" * 80, flush=True)
        print("[OCR CANDIDATES - FAST FIRST PASS]", flush=True)
        for item in candidates:
            print(f"{item['label']}: {item['path']}", flush=True)
        print("=" * 80 + "\n", flush=True)
        return candidates, temp_dir, input_quality

    candidates.append({"label": "enhanced_gray", "path": enhanced_path})

    illumination_corrected = correct_illumination(gray)
    if illumination_corrected is not None:
        illumination_path = temp_dir / "03_illumination_corrected.png"
        write_image(illumination_path, illumination_corrected)
        candidates.append({"label": "illumination_corrected", "path": illumination_path})

    shadow_removed = remove_shadow(gray)
    if shadow_removed is not None:
        shadow_path = temp_dir / "04_shadow_removed_gray.png"
        write_image(shadow_path, shadow_removed)
        candidates.append({"label": "shadow_removed_gray", "path": shadow_path})

    line_preserved = preserve_table_lines(gray)
    if line_preserved is not None:
        line_path = temp_dir / "05_line_preserved_gray.png"
        write_image(line_path, line_preserved)
        candidates.append({"label": "line_preserved_gray", "path": line_path})

    binary = cv2.adaptiveThreshold(
        sharpened,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )

    binary_path = temp_dir / "06_binary_full.png"
    write_image(binary_path, binary)
    candidates.append({"label": "binary_full", "path": binary_path})

    if ocr_mode == "balanced":
        # balanced가 오히려 느리고 나빠지는 주원인은 과한 binary/line 후보까지 모두 OCR한 뒤
        # 품질점수만으로 한 후보를 고르는 구조였다. balanced는 보정 후보를 제한하고,
        # binary_full은 조명/대비 문제가 큰 경우에만 사용한다.
        destructive_allowed = any([
            input_quality.get("very_blurry"),
            input_quality.get("too_dark"),
            input_quality.get("too_bright"),
            input_quality.get("low_contrast"),
        ])

        preferred_order = [
            "resized_color",
            "enhanced_gray",
            "illumination_corrected",
            "shadow_removed_gray",
            "line_preserved_gray",
        ]
        if destructive_allowed:
            preferred_order.append("binary_full")

        by_label = {str(item.get("label")): item for item in candidates}
        limited_candidates = []
        for label in preferred_order:
            item = by_label.get(label)
            if item:
                limited_candidates.append(item)

        # 보정 후보가 너무 많으면 속도만 느려지고 OCR 후보 선택이 흔들린다.
        # 일반 사진은 최대 4개, 품질 문제가 명확할 때만 최대 5개로 제한한다.
        max_candidates = 5 if destructive_allowed else 4
        candidates = filter_duplicate_candidate_paths(limited_candidates)[:max_candidates]

        print("\n" + "=" * 80, flush=True)
        print("[OCR CANDIDATES - BALANCED MODE - LIMITED]", flush=True)
        for item in candidates:
            print(f"{item['label']}: {item['path']}", flush=True)
        print("=" * 80 + "\n", flush=True)
        return candidates, temp_dir, input_quality

    document_candidates = build_document_region_candidates(resized_color)
    for doc_index, doc_item in enumerate(document_candidates, start=1):
        doc_label = doc_item["label"]
        doc_image = doc_item["image"]

        doc_path = temp_dir / f"07_{doc_label}_{doc_index}.png"
        write_image(doc_path, doc_image)
        candidates.append({"label": doc_label, "path": doc_path})

    deskewed = deskew_grayscale_image(sharpened)
    if deskewed is not None:
        deskewed_path = temp_dir / "08_deskewed_gray.png"
        write_image(deskewed_path, deskewed)
        candidates.append({"label": "deskewed_gray", "path": deskewed_path})

    rotation_candidates = build_rotation_candidates(resized_color)
    for rotate_label, rotated_image in rotation_candidates:
        rotated_path = temp_dir / f"09_{rotate_label}.png"
        write_image(rotated_path, rotated_image)
        candidates.append({"label": rotate_label, "path": rotated_path})

    # 긴 이미지 분할: enhanced / binary / illumination 후보를 기준으로 crop 생성
    split_base_images = [
        ("enhanced_crop", sharpened),
        ("binary_crop", binary),
    ]

    if illumination_corrected is not None:
        split_base_images.append(("illumination_crop", illumination_corrected))

    h, w = binary.shape[:2]
    ratio = h / max(w, 1)

    if ratio >= 2.2:
        split_count = decide_split_count(h, w)
        overlap = int(h * 0.04)

        print("\n" + "=" * 80, flush=True)
        print("[OCR IMAGE SPLIT]", flush=True)
        print(f"height: {h}", flush=True)
        print(f"width: {w}", flush=True)
        print(f"ratio: {ratio:.2f}", flush=True)
        print(f"split_count: {split_count}", flush=True)
        print(f"overlap: {overlap}", flush=True)
        print("=" * 80 + "\n", flush=True)

        for index in range(split_count):
            y1 = int(h * index / split_count)
            y2 = int(h * (index + 1) / split_count)

            if index > 0:
                y1 = max(0, y1 - overlap)

            if index < split_count - 1:
                y2 = min(h, y2 + overlap)

            for base_label, base_image in split_base_images:
                crop = base_image[y1:y2, :]
                crop_path = temp_dir / f"10_{base_label}_{index + 1}.png"
                write_image(crop_path, crop)
                candidates.append(
                    {
                        "label": f"{base_label}_{index + 1}",
                        "path": crop_path,
                    }
                )

    candidates = filter_duplicate_candidate_paths(candidates)

    print("\n" + "=" * 80, flush=True)
    print("[OCR CANDIDATES]", flush=True)
    for item in candidates:
        print(f"{item['label']}: {item['path']}", flush=True)
    print("=" * 80 + "\n", flush=True)

    return candidates, temp_dir, input_quality


def apply_exif_orientation(image_path: Path, temp_dir: Path) -> Path:
    """
    휴대폰 사진 EXIF 회전 보정.
    Pillow가 없거나 실패하면 원본 경로를 그대로 반환한다.
    """
    try:
        from PIL import Image, ImageOps

        with Image.open(str(image_path)) as image:
            corrected = ImageOps.exif_transpose(image)
            corrected_path = temp_dir / "exif_corrected.png"

            if corrected.mode not in ("RGB", "L"):
                corrected = corrected.convert("RGB")

            corrected.save(str(corrected_path))
            return corrected_path

    except Exception as exc:
        print("[OCR EXIF WARNING] EXIF 회전 보정 실패. 원본을 사용합니다.", flush=True)
        print(str(exc), flush=True)
        return image_path


def resize_image_for_ocr(
    image: Any,
    min_width: int = 1400,
    max_width: int = 2200,
) -> Any:
    """
    OCR 안정성을 위한 크기 정규화.
    - 너무 작은 이미지는 확대
    - 너무 큰 이미지는 축소
    """
    import cv2

    height, width = image.shape[:2]

    if width <= 0:
        return image

    if width < min_width:
        scale = min_width / width
    elif width > max_width:
        scale = max_width / width
    else:
        return image.copy()

    resized = cv2.resize(
        image,
        None,
        fx=scale,
        fy=scale,
        interpolation=cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA,
    )

    return resized


def analyze_input_image_quality(image: Any) -> dict[str, Any]:
    """
    OCR 전 이미지 품질 검사.
    이 결과는 OCR을 막기보다, 보완요청 후보/검토 필요 판단 근거로 사용한다.
    """
    try:
        import cv2
        import numpy as np

        height, width = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness_mean = float(np.mean(gray))
        brightness_std = float(np.std(gray))

        dark_ratio = float(np.mean(gray < 45))
        bright_ratio = float(np.mean(gray > 245))

        too_small = width < 900 or height < 900
        blurry = laplacian_var < 80
        very_blurry = laplacian_var < 40
        too_dark = brightness_mean < 70 or dark_ratio > 0.35
        too_bright = brightness_mean > 220 or bright_ratio > 0.35
        low_contrast = brightness_std < 35

        issues = []

        if too_small:
            issues.append("해상도 낮음")

        if very_blurry:
            issues.append("매우 흐림")
        elif blurry:
            issues.append("흐림")

        if too_dark:
            issues.append("어두움")

        if too_bright:
            issues.append("과노출")

        if low_contrast:
            issues.append("대비 낮음")

        quality_ok = not any([too_small, very_blurry, too_dark, too_bright])

        return {
            "available": True,
            "width": width,
            "height": height,
            "laplacian_var": round(laplacian_var, 2),
            "brightness_mean": round(brightness_mean, 2),
            "brightness_std": round(brightness_std, 2),
            "dark_ratio": round(dark_ratio, 4),
            "bright_ratio": round(bright_ratio, 4),
            "too_small": too_small,
            "blurry": blurry,
            "very_blurry": very_blurry,
            "too_dark": too_dark,
            "too_bright": too_bright,
            "low_contrast": low_contrast,
            "quality_ok": quality_ok,
            "issues": issues,
            "supplement_candidate": not quality_ok,
        }

    except Exception as exc:
        print("[OCR QUALITY WARNING] 이미지 품질 검사 실패", flush=True)
        print(str(exc), flush=True)
        return {
            "available": False,
            "reason": "quality_check_failed",
            "error": str(exc),
        }


def correct_illumination(gray_image: Any) -> Any | None:
    """
    조명/그림자 보정 후보.
    배경 조도를 추정해 글자 대비를 안정화한다.
    """
    try:
        import cv2
        import numpy as np

        background = cv2.GaussianBlur(gray_image, (0, 0), sigmaX=25, sigmaY=25)
        corrected = cv2.divide(gray_image, background, scale=255)
        corrected = cv2.normalize(corrected, None, 0, 255, cv2.NORM_MINMAX)

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        corrected = clahe.apply(corrected.astype(np.uint8))

        return corrected
    except Exception as exc:
        print("[OCR ILLUMINATION WARNING] 조명 보정 후보 생성 실패", flush=True)
        print(str(exc), flush=True)
        return None


def remove_shadow(gray_image: Any) -> Any | None:
    """
    그림자 제거 후보.
    """
    try:
        import cv2
        import numpy as np

        dilated = cv2.dilate(gray_image, np.ones((7, 7), np.uint8))
        background = cv2.medianBlur(dilated, 21)
        diff = 255 - cv2.absdiff(gray_image, background)
        normalized = cv2.normalize(diff, None, 0, 255, cv2.NORM_MINMAX)
        return normalized
    except Exception as exc:
        print("[OCR SHADOW WARNING] 그림자 제거 후보 생성 실패", flush=True)
        print(str(exc), flush=True)
        return None


def preserve_table_lines(gray_image: Any) -> Any | None:
    """
    표/라인 보존 후보.
    금액/품목 행이 표 형태로 있는 문서에서 라인 구조를 어느 정도 보존한다.
    """
    try:
        import cv2
        import numpy as np

        binary_inv = cv2.adaptiveThreshold(
            gray_image,
            255,
            cv2.ADAPTIVE_THRESH_MEAN_C,
            cv2.THRESH_BINARY_INV,
            31,
            15,
        )

        h, w = binary_inv.shape[:2]

        horizontal_kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (max(20, w // 30), 1),
        )
        vertical_kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (1, max(20, h // 40)),
        )

        horizontal = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, horizontal_kernel)
        vertical = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, vertical_kernel)
        lines = cv2.add(horizontal, vertical)

        text_plus_lines = cv2.addWeighted(binary_inv, 1.0, lines, 0.35, 0)
        result = 255 - text_plus_lines

        return result
    except Exception as exc:
        print("[OCR LINE WARNING] 표/라인 보존 후보 생성 실패", flush=True)
        print(str(exc), flush=True)
        return None


def build_document_region_candidates(image: Any) -> list[dict[str, Any]]:
    """
    문서 영역 crop / 원근 보정 후보 생성.
    실패해도 원본 후보가 유지되므로 안전하다.
    """
    try:
        import cv2
        import numpy as np

        result: list[dict[str, Any]] = []

        original = image.copy()
        h, w = original.shape[:2]
        image_area = h * w

        gray = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, 50, 160)

        contours, _ = cv2.findContours(
            edged,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8]

        best_quad = None
        best_area = 0

        for contour in contours:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            area = cv2.contourArea(approx)

            if len(approx) == 4 and area > image_area * 0.18:
                if area > best_area:
                    best_quad = approx
                    best_area = area

        if best_quad is not None:
            warped = four_point_transform(original, best_quad.reshape(4, 2))
            if warped is not None:
                result.append(
                    {
                        "label": "document_warped",
                        "image": warped,
                    }
                )

        # 사각형이 명확하지 않아도 큰 텍스트 영역 crop 후보 생성
        threshold = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            31,
            15,
        )

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 7))
        closed = cv2.morphologyEx(threshold, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(
            closed,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        boxes = []

        for contour in contours:
            x, y, bw, bh = cv2.boundingRect(contour)
            area = bw * bh

            if area < image_area * 0.01:
                continue

            boxes.append((x, y, x + bw, y + bh))

        if boxes:
            x1 = max(0, min(box[0] for box in boxes) - int(w * 0.03))
            y1 = max(0, min(box[1] for box in boxes) - int(h * 0.03))
            x2 = min(w, max(box[2] for box in boxes) + int(w * 0.03))
            y2 = min(h, max(box[3] for box in boxes) + int(h * 0.03))

            crop_area = (x2 - x1) * (y2 - y1)

            if crop_area > image_area * 0.15:
                crop = original[y1:y2, x1:x2]
                result.append(
                    {
                        "label": "document_text_crop",
                        "image": crop,
                    }
                )

        return result

    except Exception as exc:
        print("[OCR DOCUMENT CROP WARNING] 문서 영역 후보 생성 실패", flush=True)
        print(str(exc), flush=True)
        return []


def order_points(pts: Any) -> Any:
    import numpy as np

    rect = np.zeros((4, 2), dtype="float32")

    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect


def four_point_transform(image: Any, pts: Any) -> Any | None:
    try:
        import cv2
        import numpy as np

        rect = order_points(pts.astype("float32"))
        (tl, tr, br, bl) = rect

        width_a = np.linalg.norm(br - bl)
        width_b = np.linalg.norm(tr - tl)
        max_width = int(max(width_a, width_b))

        height_a = np.linalg.norm(tr - br)
        height_b = np.linalg.norm(tl - bl)
        max_height = int(max(height_a, height_b))

        if max_width < 300 or max_height < 300:
            return None

        dst = np.array(
            [
                [0, 0],
                [max_width - 1, 0],
                [max_width - 1, max_height - 1],
                [0, max_height - 1],
            ],
            dtype="float32",
        )

        matrix = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(image, matrix, (max_width, max_height))

        return warped

    except Exception as exc:
        print("[OCR PERSPECTIVE WARNING] 원근 보정 실패", flush=True)
        print(str(exc), flush=True)
        return None


def deskew_grayscale_image(gray_image: Any) -> Any | None:
    """
    영수증 이미지의 작은 기울기를 보정한다.
    """
    try:
        import cv2
        import numpy as np

        if gray_image is None:
            return None

        _, thresh = cv2.threshold(
            gray_image,
            0,
            255,
            cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU,
        )

        coords = np.column_stack(np.where(thresh > 0))
        if coords.size == 0:
            return None

        angle = cv2.minAreaRect(coords)[-1]

        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        if abs(angle) < 0.7 or abs(angle) > 12:
            return None

        height, width = gray_image.shape[:2]
        center = (width // 2, height // 2)
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            gray_image,
            matrix,
            (width, height),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )

        print("\n" + "=" * 80, flush=True)
        print("[OCR DESKEW]", flush=True)
        print(f"angle: {angle:.2f}", flush=True)
        print("=" * 80 + "\n", flush=True)

        return rotated
    except Exception as exc:
        print("[OCR DESKEW WARNING] 기울기 보정 후보 생성 실패", flush=True)
        print(str(exc), flush=True)
        return None


def build_rotation_candidates(image: Any) -> list[tuple[str, Any]]:
    """
    회전 업로드 대응 후보 생성.
    """
    try:
        import cv2

        if image is None:
            return []

        return [
            ("rotate_90_clockwise", cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)),
            ("rotate_180", cv2.rotate(image, cv2.ROTATE_180)),
            ("rotate_90_counterclockwise", cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)),
        ]
    except Exception as exc:
        print("[OCR ROTATE WARNING] 회전 후보 생성 실패", flush=True)
        print(str(exc), flush=True)
        return []


def decide_split_count(height: int, width: int) -> int:
    ratio = height / max(width, 1)

    if ratio >= 5:
        return 5

    if ratio >= 4:
        return 4

    if ratio >= 3:
        return 3

    return 2


def filter_duplicate_candidate_paths(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    result = []

    for item in candidates:
        key = str(item.get("path"))

        if key in seen:
            continue

        seen.add(key)
        result.append(item)

    return result


def write_image(path: Path, image: Any) -> None:
    """
    한글 경로 대응을 위해 cv2.imwrite 대신 imencode + tofile 사용.
    """
    import cv2

    extension = path.suffix or ".png"
    success, encoded = cv2.imencode(extension, image)

    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"OCR 전처리 이미지 저장에 실패했습니다: {path}",
        )

    encoded.tofile(str(path))


def cleanup_temp_dir(temp_dir: Path) -> None:
    try:
        shutil.rmtree(str(temp_dir), ignore_errors=True)
    except Exception:
        pass


# =========================================================
# PADDLE RESULT PARSING
# =========================================================

def print_ocr_raw_result(
    result: Any,
    label: str = "unknown",
    part_index: int = 1,
    total_parts: int = 1,
) -> None:
    print("\n" + "=" * 80, flush=True)
    print(f"[OCR RAW RESULT TYPE - {label} - {part_index}/{total_parts}]", flush=True)
    print(type(result), flush=True)
    print("=" * 80, flush=True)

    try:
        raw_text = json.dumps(result, ensure_ascii=False, default=str)
    except Exception:
        raw_text = str(result)

    print("[OCR RAW RESULT PREVIEW]", flush=True)
    print(raw_text[:1800], flush=True)

    if len(raw_text) > 1800:
        print("... 생략됨 ...", flush=True)

    print("=" * 80 + "\n", flush=True)


def parse_paddle_result(result: Any) -> str:
    parsed = parse_paddle_result_with_scores(result)
    return parsed["text"]


def parse_paddle_result_with_scores(result: Any) -> dict[str, Any]:
    """
    PaddleOCR 버전별 결과 구조를 방어적으로 파싱한다.

    개선점:
    - PaddleOCR 3.x 결과(dict 내부 rec_texts/rec_scores/dt_polys)를 우선 인식한다.
    - dt_polys 좌표가 있으면 같은 y축의 단어들을 한 줄로 묶어 표 구조를 최대한 복원한다.
    - 기존 재귀 파서는 rec_texts를 중복 수집하거나 엔진 출력 순서만 믿어서
      영수증 품목/단가/수량/금액 순서가 쉽게 깨졌다.
    """
    structured_items = collect_paddle_structured_items(result)

    if structured_items:
        ordered_lines = reconstruct_lines_from_ocr_items(structured_items)
        scores = [item.get("score") for item in structured_items if item.get("score") is not None]
        engine_confidence = calculate_average(scores)
        cleaned: list[str] = []
        for line in ordered_lines:
            value = normalize_ocr_line(str(line))
            if not value:
                continue
            if cleaned and normalize_line_for_dedupe(cleaned[-1]) == normalize_line_for_dedupe(value):
                continue
            cleaned.append(value)
        return {
            "text": "\n".join(cleaned),
            "scores": [float(x) for x in scores if isinstance(x, (int, float))],
            "engine_confidence": engine_confidence,
        }

    lines: list[str] = []
    scores: list[float] = []

    collect_texts_and_scores(result, lines, scores)

    cleaned: list[str] = []

    for line in lines:
        value = normalize_ocr_line(str(line))

        if not value:
            continue

        if cleaned and normalize_line_for_dedupe(cleaned[-1]) == normalize_line_for_dedupe(value):
            continue

        cleaned.append(value)

    engine_confidence = calculate_average(scores)

    return {
        "text": "\n".join(cleaned),
        "scores": scores,
        "engine_confidence": engine_confidence,
    }


def collect_paddle_structured_items(result: Any) -> list[dict[str, Any]]:
    """PaddleOCR 3.x rec_texts/dt_polys 구조를 좌표 포함 item 리스트로 변환한다."""
    records: list[dict[str, Any]] = []

    def visit(value: Any) -> None:
        if value is None:
            return
        if isinstance(value, dict):
            texts = value.get("rec_texts")
            if texts is None:
                texts = value.get("texts")
            polys = value.get("dt_polys")
            if polys is None:
                polys = value.get("rec_polys")
            if polys is None:
                polys = value.get("boxes")
            scores = value.get("rec_scores")
            if scores is None:
                scores = value.get("scores")
            if isinstance(texts, list) and texts:
                for idx, text in enumerate(texts):
                    if not isinstance(text, str):
                        continue
                    raw_text = text.strip()
                    if not raw_text:
                        continue
                    score = None
                    if isinstance(scores, list) and idx < len(scores):
                        try:
                            score = float(scores[idx])
                        except Exception:
                            score = None
                    poly = None
                    if isinstance(polys, list) and idx < len(polys):
                        poly = parse_ocr_poly(polys[idx])
                    records.append({
                        "text": raw_text,
                        "score": score,
                        "poly": poly,
                    })
                # rec_texts가 있는 dict는 여기서 종료한다. nested 재귀를 계속하면 같은 텍스트가 중복 수집된다.
                return
            for nested in value.values():
                visit(nested)
            return
        if isinstance(value, (list, tuple)):
            # PaddleOCR 2.x: [[box], (text, score)] 형태 처리
            if len(value) >= 2:
                box = parse_ocr_poly(value[0])
                second = value[1]
                if isinstance(second, (list, tuple)) and second and isinstance(second[0], str):
                    score = None
                    if len(second) >= 2:
                        try:
                            score = float(second[1])
                        except Exception:
                            score = None
                    records.append({"text": second[0], "score": score, "poly": box})
                    return
            for nested in value:
                visit(nested)

    visit(result)

    # 중복 제거. 동일 텍스트+좌표가 여러 번 잡히는 것을 제거한다.
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in records:
        text = normalize_ocr_line(item.get("text") or "")
        if not text:
            continue
        poly_key = ""
        if item.get("poly"):
            try:
                xs = [int(p[0]) for p in item["poly"]]
                ys = [int(p[1]) for p in item["poly"]]
                poly_key = f"{min(xs)//5}:{min(ys)//5}:{max(xs)//5}:{max(ys)//5}"
            except Exception:
                poly_key = ""
        key = normalize_line_for_dedupe(text) + ":" + poly_key
        if key in seen:
            continue
        seen.add(key)
        item = dict(item)
        item["text"] = text
        deduped.append(item)
    return deduped


def parse_ocr_poly(value: Any) -> list[tuple[float, float]] | None:
    """ndarray/list/string 형태의 bbox polygon을 [(x,y), ...]로 변환한다."""
    if value is None:
        return None
    try:
        if hasattr(value, "tolist"):
            value = value.tolist()
        if isinstance(value, str):
            nums = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", value)]
            if len(nums) >= 8:
                return [(nums[i], nums[i + 1]) for i in range(0, 8, 2)]
            return None
        if isinstance(value, (list, tuple)):
            pts: list[tuple[float, float]] = []
            # [[x,y], ...]
            if value and isinstance(value[0], (list, tuple)):
                for pt in value[:4]:
                    if len(pt) >= 2:
                        pts.append((float(pt[0]), float(pt[1])))
            # [x1,y1,x2,y2,...]
            elif len(value) >= 8:
                nums = [float(x) for x in value[:8]]
                pts = [(nums[i], nums[i + 1]) for i in range(0, 8, 2)]
            return pts if len(pts) >= 4 else None
    except Exception:
        return None
    return None


def ocr_item_box(item: dict[str, Any]) -> dict[str, float]:
    poly = item.get("poly") or []
    if not poly:
        return {"x1": 0.0, "y1": 0.0, "x2": 0.0, "y2": 0.0, "cx": 0.0, "cy": 0.0, "h": 16.0}
    xs = [float(p[0]) for p in poly]
    ys = [float(p[1]) for p in poly]
    x1, x2 = min(xs), max(xs)
    y1, y2 = min(ys), max(ys)
    return {
        "x1": x1,
        "y1": y1,
        "x2": x2,
        "y2": y2,
        "cx": (x1 + x2) / 2,
        "cy": (y1 + y2) / 2,
        "h": max(1.0, y2 - y1),
    }


def reconstruct_lines_from_ocr_items(items: list[dict[str, Any]]) -> list[str]:
    """좌표 기반으로 OCR 토큰을 줄 단위로 재구성한다."""
    if not items:
        return []

    if not any(item.get("poly") for item in items):
        return [item.get("text") or "" for item in items if item.get("text")]

    enriched: list[dict[str, Any]] = []
    heights: list[float] = []
    for item in items:
        box = ocr_item_box(item)
        enriched.append({**item, "box": box})
        if box["h"] > 1:
            heights.append(box["h"])

    heights_sorted = sorted(heights)
    median_h = heights_sorted[len(heights_sorted) // 2] if heights_sorted else 20.0
    y_tolerance = max(10.0, median_h * 0.65)

    enriched.sort(key=lambda x: (x["box"]["cy"], x["box"]["x1"]))

    rows: list[dict[str, Any]] = []
    for item in enriched:
        cy = item["box"]["cy"]
        target = None
        best_diff = None
        for row in rows:
            diff = abs(row["cy"] - cy)
            if diff <= y_tolerance and (best_diff is None or diff < best_diff):
                target = row
                best_diff = diff
        if target is None:
            rows.append({"cy": cy, "items": [item]})
        else:
            target["items"].append(item)
            target["cy"] = sum(x["box"]["cy"] for x in target["items"]) / len(target["items"])

    rows.sort(key=lambda row: row["cy"])

    lines: list[str] = []
    for row in rows:
        row_items = sorted(row["items"], key=lambda x: x["box"]["x1"])
        parts: list[str] = []
        prev_x2 = None
        for item in row_items:
            text = normalize_ocr_line(item.get("text") or "")
            if not text:
                continue
            # 같은 행 내 큰 간격은 공백 하나로 충분하다. 표 파서는 공백 분리 숫자를 활용한다.
            if prev_x2 is not None and item["box"]["x1"] - prev_x2 > median_h * 1.2:
                parts.append(" ")
            parts.append(text)
            prev_x2 = item["box"]["x2"]
        line = " ".join("".join(parts).split())
        if line:
            lines.append(line)

    return lines


def collect_texts_and_scores(value: Any, lines: list[str], scores: list[float]) -> None:
    if value is None:
        return

    if isinstance(value, dict):
        for key in ["rec_texts", "texts", "text", "rec_text", "transcription", "label"]:
            item = value.get(key)
            if isinstance(item, list):
                for text in item:
                    if isinstance(text, str):
                        lines.append(text)
            elif isinstance(item, str):
                lines.append(item)
        for key in ["rec_scores", "scores", "score", "confidence", "prob"]:
            item = value.get(key)
            if isinstance(item, list):
                for score in item:
                    append_score(scores, score)
            else:
                append_score(scores, item)
        # rec_texts를 가진 dict는 이미 처리했으므로 중복 재귀하지 않는다.
        if value.get("rec_texts") or value.get("texts"):
            return
        for nested_value in value.values():
            collect_texts_and_scores(nested_value, lines, scores)
        return

    if isinstance(value, (list, tuple)):
        if len(value) >= 2:
            second = value[1]
            if isinstance(second, (list, tuple)) and len(second) >= 1:
                first = second[0]
                if isinstance(first, str):
                    lines.append(first)
                if len(second) >= 2:
                    append_score(scores, second[1])
            elif isinstance(second, str):
                lines.append(second)
        for item in value:
            collect_texts_and_scores(item, lines, scores)
        return


def append_score(scores: list[float], value: Any) -> None:
    try:
        number = float(value)
    except Exception:
        return

    if 0 <= number <= 1:
        scores.append(number)


# =========================================================
# TEXT NORMALIZATION / QUALITY
# =========================================================

def normalize_ocr_line(line: str) -> str:
    if not line:
        return ""

    value = str(line).strip()

    value = value.replace("\u200b", "")
    value = value.replace("\ufeff", "")
    value = value.replace("\r", "")
    value = value.replace("｜", "|")
    value = value.replace("–", "-")
    value = value.replace("—", "-")
    value = value.replace("₩", "원")

    # 감열지/POS 영수증에서 자주 발생하는 OCR 분절/혼동 보정
    replacements = {
        "P0S": "POS",
        "p0s": "POS",
        "부 가 세": "부가세",
        "부가 세": "부가세",
        "공 급가액": "공급가액",
        "공 급가": "공급가",
        "합계글액": "합계금액",
        "받은금액": "받은금액",
        "발은금액": "받은금액",
        "영수번호::": "영수번호:",
        "판매시간:": "판매시간:",
    }
    for wrong, right in replacements.items():
        value = value.replace(wrong, right)

    if looks_like_money_line(value):
        value = value.replace("월", "원")
        value = value.replace("W", "원")
        value = value.replace("w", "원")
        value = value.replace("O", "0") if re.search(r"\d[O]\d", value) else value

    value = " ".join(value.split())

    return value


def looks_like_money_line(value: str) -> bool:
    if not value:
        return False

    if any(keyword in value for keyword in ["금액", "운임", "요금", "영수", "합계", "총액", "결제", "승인", "카드"]):
        return True

    if any(unit in value for unit in ["월", "W", "w", "₩"]) and any(char.isdigit() for char in value):
        return True

    if re.search(r"\d{1,3}(?:[,.]\d{3})+", value):
        return True

    return False


def calculate_ocr_text_quality(
    text: str,
    label: str = "",
    engine_confidence: float | None = None,
    input_quality: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    OCR 텍스트 품질 점수.
    실제 정답률이 아니라 OCR 품질 추정치다.
    """
    text = text or ""
    input_quality = input_quality or {}

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    joined = "\n".join(lines)

    if not joined:
        return {
            "quality_score": 0.0,
            "quality_percent": 0,
            "is_usable": False,
            "reason": "OCR 텍스트 없음",
            "metrics": {
                "line_count": 0,
                "length": 0,
                "input_quality": input_quality,
            },
        }

    length = len(joined)
    line_count = len(lines)

    korean_count = len(re.findall(r"[가-힣]", joined))
    digit_count = len(re.findall(r"\d", joined))
    english_count = len(re.findall(r"[A-Za-z]", joined))
    valid_count = korean_count + digit_count + english_count

    noise_count = len(re.findall(r"[λ^~`{}\[\]<>_=+|\\]", joined))
    punctuation_count = len(re.findall(r"[^\w가-힣\s,.:\-/()₩원%#*&]", joined))

    valid_ratio = valid_count / max(length, 1)
    noise_ratio = noise_count / max(length, 1)
    punctuation_ratio = punctuation_count / max(length, 1)

    money_pattern = bool(re.search(r"\d{1,3}(?:[,.]\d{3})+\s*원?", joined))
    date_pattern = bool(
        re.search(r"20\d{2}[-./년\s]*\d{1,2}[-./월\s]*\d{1,2}", joined)
        or re.search(r"\d{2}년\s*\d{1,2}\s*월?\s*\d{1,2}", joined)
        or re.search(r"\d{2}[-./]\d{1,2}[-./]\d{1,2}", joined)
    )
    time_pattern = bool(re.search(r"\d{1,2}:\d{2}", joined))
    business_no_pattern = bool(re.search(r"\d{3}[-\s]?\d{2}[-\s]?\d{5}", joined))
    card_pattern = bool(re.search(r"카드|승인|결제|일시불|매입|신용", joined))
    document_keyword = bool(
        re.search(
            r"영수증|승차권|열차|KTX|KORAIL|한국철도|합계|금액|결제|카드|사업자|운임|매출|승인",
            joined,
            re.IGNORECASE,
        )
    )

    score = 0.0

    if length >= 120:
        score += 0.16
    elif length >= 80:
        score += 0.13
    elif length >= 30:
        score += 0.08

    if line_count >= 10:
        score += 0.12
    elif line_count >= 8:
        score += 0.10
    elif line_count >= 3:
        score += 0.05

    score += min(valid_ratio, 0.78) * 0.24

    if money_pattern:
        score += 0.16

    if date_pattern:
        score += 0.11

    if time_pattern:
        score += 0.04

    if business_no_pattern:
        score += 0.04

    if card_pattern:
        score += 0.05

    if document_keyword:
        score += 0.10

    if engine_confidence is not None:
        score += max(0.0, min(1.0, engine_confidence)) * 0.18

    score -= min(noise_ratio * 1.5, 0.25)
    score -= min(punctuation_ratio * 0.8, 0.15)

    if "binary" in label.lower() and noise_ratio > 0.04:
        score -= 0.20

    if "rotate" in label.lower() and not document_keyword and not money_pattern:
        score -= 0.08

    if input_quality.get("very_blurry"):
        score -= 0.12
    elif input_quality.get("blurry"):
        score -= 0.06

    if input_quality.get("too_dark") or input_quality.get("too_bright"):
        score -= 0.05

    if input_quality.get("too_small"):
        score -= 0.05

    # 품질 문제가 있는 원본은 패턴이 있다고 100점이 되면 안 된다.
    # 이 점수는 실제 정확도가 아니라 자동통과 판단 근거라서 보수적으로 상한을 둔다.
    caps = []
    if input_quality.get("very_blurry"):
        caps.append(0.55)
    elif input_quality.get("blurry"):
        caps.append(0.78)
    if input_quality.get("too_small"):
        caps.append(0.85)
    if input_quality.get("low_contrast"):
        caps.append(0.85)
    if input_quality.get("too_dark") or input_quality.get("too_bright"):
        caps.append(0.75)

    # 엔진 자체 confidence가 낮으면 금액/날짜 패턴이 있어도 자동통과급 품질로 보지 않는다.
    # 예: 사용자가 올린 음식점 영수증은 quality_score는 0.97이었지만 engine_confidence는 0.715였고
    # 상호/품목 대부분이 깨져 있었다.
    if engine_confidence is not None:
        try:
            ec = float(engine_confidence)
            if ec < 0.65:
                caps.append(0.60)
            elif ec < 0.75:
                caps.append(0.72)
            elif ec < 0.82:
                caps.append(0.86)
        except Exception:
            pass

    if caps:
        score = min(score, min(caps))

    score = max(0.0, min(1.0, score))

    is_usable = score >= 0.42 and length >= 25 and noise_ratio < 0.15

    reason_parts = []

    if money_pattern:
        reason_parts.append("금액 패턴 확인")

    if date_pattern:
        reason_parts.append("날짜 패턴 확인")

    if document_keyword:
        reason_parts.append("문서 키워드 확인")

    if input_quality.get("blurry"):
        reason_parts.append("이미지 흐림")

    if input_quality.get("too_dark"):
        reason_parts.append("이미지 어두움")

    if input_quality.get("too_bright"):
        reason_parts.append("이미지 과노출")

    if input_quality.get("too_small"):
        reason_parts.append("해상도 낮음")

    if noise_ratio >= 0.10:
        reason_parts.append("노이즈 문자 많음")

    if not reason_parts:
        reason_parts.append("일반 텍스트 품질 기준")

    return {
        "quality_score": round(score, 4),
        "quality_percent": round(score * 100),
        "is_usable": is_usable,
        "reason": ", ".join(reason_parts),
        "metrics": {
            "line_count": line_count,
            "length": length,
            "korean_count": korean_count,
            "digit_count": digit_count,
            "english_count": english_count,
            "valid_ratio": round(valid_ratio, 4),
            "noise_ratio": round(noise_ratio, 4),
            "punctuation_ratio": round(punctuation_ratio, 4),
            "money_pattern": money_pattern,
            "date_pattern": date_pattern,
            "time_pattern": time_pattern,
            "business_no_pattern": business_no_pattern,
            "card_pattern": card_pattern,
            "document_keyword": document_keyword,
            "engine_confidence": engine_confidence,
            "input_quality": input_quality,
        },
    }


# =========================================================
# FIELD HINTS / CANDIDATE SELECTION
# =========================================================

def extract_field_hints_from_text(text: str) -> dict[str, Any]:
    """
    OCR 텍스트에서 금액/날짜/상호명 후보를 간단 추출한다.
    실제 최종 구조화는 LLM/검증 서비스에서 처리하되,
    OCR 후보 선택과 교차검증 근거로 활용한다.
    """
    text = text or ""
    lines = [normalize_ocr_line(line) for line in text.splitlines() if normalize_ocr_line(line)]

    amounts = extract_amount_candidates(text)
    dates = extract_date_candidates(text)
    vendor_candidates = extract_vendor_candidates(lines)

    return {
        "amounts": amounts[:10],
        "dates": dates[:10],
        "vendor_candidates": vendor_candidates[:8],
        "has_amount": len(amounts) > 0,
        "has_date": len(dates) > 0,
        "has_vendor_candidate": len(vendor_candidates) > 0,
    }


def extract_amount_candidates(text: str) -> list[dict[str, Any]]:
    result = []

    patterns = [
        r"(?P<amount>\d{1,3}(?:[,.]\d{3})+)\s*원?",
        r"(?P<amount>\d{4,9})\s*원",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text or ""):
            raw = match.group("amount")
            normalized = re.sub(r"[^\d]", "", raw)

            if not normalized:
                continue

            try:
                value = int(normalized)
            except Exception:
                continue

            if value <= 0:
                continue

            result.append(
                {
                    "raw": raw,
                    "value": value,
                    "start": match.start(),
                    "end": match.end(),
                }
            )

    unique = {}
    for item in result:
        key = item["value"]
        if key not in unique:
            unique[key] = item

    return sorted(unique.values(), key=lambda item: item["value"], reverse=True)


def extract_date_candidates(text: str) -> list[dict[str, Any]]:
    result = []

    patterns = [
        r"(?P<date>20\d{2}[-./년\s]*\d{1,2}[-./월\s]*\d{1,2})",
        r"(?P<date>\d{2}[-./]\d{1,2}[-./]\d{1,2})",
        r"(?P<date>\d{2}년\s*\d{1,2}\s*월?\s*\d{1,2})",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text or ""):
            raw = match.group("date")
            result.append(
                {
                    "raw": raw,
                    "start": match.start(),
                    "end": match.end(),
                }
            )

    unique = {}
    for item in result:
        key = re.sub(r"\s+", "", item["raw"])
        if key not in unique:
            unique[key] = item

    return list(unique.values())


def extract_vendor_candidates(lines: list[str]) -> list[str]:
    """
    상호명 후보.
    너무 일반적인 영수증 키워드 라인은 제외하고 상단부 짧은 한글/영문 라인을 우선 본다.
    """
    exclude_keywords = [
        "영수증",
        "매출전표",
        "카드",
        "승인",
        "합계",
        "금액",
        "일시불",
        "사업자",
        "대표",
        "전화",
        "주소",
        "부가세",
        "과세",
        "면세",
    ]

    candidates = []

    for line in lines[:12]:
        cleaned = normalize_ocr_line(line)

        if not cleaned:
            continue

        compact_cleaned = re.sub(r"\s+", "", cleaned)
        if any(keyword in cleaned or keyword in compact_cleaned for keyword in exclude_keywords):
            continue

        # 세액/공급가/받은금액처럼 OCR이 띄어쓴 정산 라인은 상호 후보가 아니다.
        if any(keyword in compact_cleaned for keyword in ["부가세", "공급가", "공급가액", "받은금액", "합계", "판매", "영수번호", "판매시간"]):
            continue

        if len(cleaned) < 2 or len(cleaned) > 30:
            continue

        if re.fullmatch(r"[\d\s,.:/\-()원]+", cleaned):
            continue

        if len(re.findall(r"[가-힣A-Za-z]", cleaned)) < 2:
            continue

        candidates.append(cleaned)

    return candidates


def merge_field_hints(hints_list: list[dict[str, Any]]) -> dict[str, Any]:
    amount_map = {}
    date_map = {}
    vendor_seen = set()
    vendors = []

    for hints in hints_list:
        for item in hints.get("amounts") or []:
            value = item.get("value")
            if value and value not in amount_map:
                amount_map[value] = item

        for item in hints.get("dates") or []:
            raw = item.get("raw")
            key = re.sub(r"\s+", "", raw or "")
            if key and key not in date_map:
                date_map[key] = item

        for vendor in hints.get("vendor_candidates") or []:
            key = normalize_line_for_dedupe(vendor)
            if key and key not in vendor_seen:
                vendor_seen.add(key)
                vendors.append(vendor)

    amounts = sorted(amount_map.values(), key=lambda item: item.get("value") or 0, reverse=True)
    dates = list(date_map.values())

    return {
        "amounts": amounts[:10],
        "dates": dates[:10],
        "vendor_candidates": vendors[:8],
        "has_amount": len(amounts) > 0,
        "has_date": len(dates) > 0,
        "has_vendor_candidate": len(vendors) > 0,
    }



def normalize_date_hint(raw: Any) -> str | None:
    value = str(raw or "")
    m = re.search(r"(20\d{2})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})", value) or re.search(r"(20\d{2})(\d{2})(\d{2})", value)
    if not m:
        return None
    try:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    except Exception:
        return None
    return None


def candidate_date_consensus_bonus(item: dict[str, Any], all_items: list[dict[str, Any]]) -> float:
    own_dates = {normalize_date_hint(x.get("raw")) for x in (item.get("field_hints") or {}).get("dates") or []}
    own_dates = {x for x in own_dates if x}
    if not own_dates:
        return -0.03
    counts: dict[str, int] = {}
    for other in all_items:
        for x in (other.get("field_hints") or {}).get("dates") or []:
            nd = normalize_date_hint(x.get("raw"))
            if nd:
                counts[nd] = counts.get(nd, 0) + 1
    if not counts:
        return 0.0
    max_count = max(counts.values())
    consensus_dates = {k for k, v in counts.items() if v == max_count and max_count >= 2}
    if own_dates & consensus_dates:
        return 0.08
    if len(counts) >= 2:
        return -0.05
    return 0.0



def candidate_item_block_score(lines: list[str]) -> float:
    """품목명 줄 + 금액 행 구조가 살아있는 OCR 후보를 가산한다.

    예: 징기스칸 양갈비 / 33,000 3개 0 99,000
    이 구조는 line_preserved/binary 후보에서 깨지는 경우가 많아 OCR 후보 선택에 직접 반영한다.
    """
    score = 0.0
    money = r"\d{1,3}(?:[,\.]\d{3})+"
    amount_row = re.compile(rf"^(?P<unit>{money})\s+(?P<qty>\d{{1,2}})\s*개?\s+\d{{1,2}}\s+(?P<amount>{money})\s*$")
    inline_row = re.compile(rf"[가-힣A-Za-z]{{2,}}.*{money}.*\d{{1,2}}\s*개?.*{money}")

    def amount_to_int(raw: str) -> int | None:
        try:
            return int(re.sub(r"\D", "", raw or ""))
        except Exception:
            return None

    for idx, line in enumerate(lines):
        compact_line = re.sub(r"\s+", "", line)
        if re.search(r"합계|총액|결제|승인|부가세|공급가", compact_line):
            continue
        if inline_row.search(line):
            score += 0.10
            continue
        if not re.search(r"[가-힣A-Za-z]{2,}", line):
            continue
        if re.search(money, line):
            continue
        for nxt in lines[idx + 1:idx + 4]:
            m = amount_row.match(nxt)
            if not m:
                continue
            unit = amount_to_int(m.group("unit"))
            qty = int(m.group("qty") or 1)
            amount = amount_to_int(m.group("amount"))
            if unit and amount and abs(unit * qty - amount) <= max(10, amount * 0.03):
                score += 0.14
                break
    return min(score, 0.42)

def candidate_receipt_item_parse_score(text: str, hints: dict[str, Any]) -> float:
    """OCR 후보 선택에서 실제 품목 파싱 가능성을 직접 반영한다.

    engine confidence가 높아도 품목명이 깨진 후보가 선택되면 후처리에서 품목 누락이 발생한다.
    따라서 상위 금액 후보를 총액으로 가정해 POS 품목 파서가 몇 개의 품목을 만들고,
    그 합계가 총액과 맞는지를 OCR 후보 선택 점수에 반영한다.
    """
    try:
        from app.services.parsers.receipt_item_parser import extract_pos_receipt_item_candidates
    except Exception:
        return 0.0

    amounts = []
    for item in (hints.get("amounts") or []):
        try:
            value = int(item.get("value") or 0)
        except Exception:
            value = 0
        if value > 0 and value not in amounts:
            amounts.append(value)
    if not amounts:
        return 0.0

    likely_total = max(amounts)
    if likely_total <= 0:
        return 0.0

    try:
        items = extract_pos_receipt_item_candidates(text, total_amount=likely_total)
    except Exception:
        return 0.0
    if not items:
        return -0.08

    clean_items = []
    for item in items:
        name = str(item.get("item_name") or item.get("description") or "")
        if not (re.search(r"[가-힣]{2,}", name) or re.search(r"[A-Za-z]{2,}", name)):
            continue
        amount = item.get("amount")
        try:
            amount = float(amount)
        except Exception:
            continue
        if amount <= 0 or amount > max(likely_total + 100, likely_total * 1.05):
            continue
        clean_items.append(item)

    if not clean_items:
        return -0.08

    item_sum = sum(float(item.get("amount") or 0) for item in clean_items)
    diff = abs(round(item_sum) - round(likely_total))
    score = min(0.22, len(clean_items) * 0.035)
    if diff == 0:
        score += 0.30
    elif diff <= max(100, likely_total * 0.03):
        score += 0.18
    elif diff <= max(1000, likely_total * 0.12):
        score += 0.04
    else:
        score -= 0.08

    # 품목 수가 많은 영수증에서 1~2개만 잡히는 후보는 감점한다.
    if len(amounts) >= 5 and len(clean_items) <= 2:
        score -= 0.12
    return score


def candidate_structure_score(text: str, hints: dict[str, Any]) -> float:
    """OCR 후보 선택용 구조 점수.

    단순 품질점수/engine confidence만 높아도 품목명이 빠진 후보가 선택되는 문제가 있었다.
    예: 송림전집에서 enhanced 후보는 공급가액/부가세는 잘 읽지만 소주/맥주/모듬전 품목명이 빠져
    `두부김치 = 총액` 같은 오답을 만들었다. 따라서 품목행 복원력을 별도 점수로 본다.
    """
    lines = [normalize_ocr_line(x) for x in str(text or "").splitlines() if normalize_ocr_line(x)]
    joined = "\n".join(lines)
    score = 0.0
    if re.search(r"상품명|제품명|품명|상품\s*단가\s*수량\s*금액", joined):
        score += 0.08
    if re.search(r"합계|총액|계\s*$|결제|승인금액|받은금액", joined, re.M):
        score += 0.06
    if re.search(r"20\d{2}[-./]\d{1,2}[-./]\d{1,2}", joined):
        score += 0.07

    vendors = hints.get("vendor_candidates") or []
    if vendors:
        first_good = next((v for v in vendors if re.search(r"[가-힣]{2,}", str(v)) and not re.search(r"번호|TEL|전화|주소", str(v), re.I)), None)
        if first_good:
            score += 0.08
        first = str(vendors[0])
        if len(re.sub(r"\s+", "", first)) <= 2 or re.search(r"번호|TEL|전화", first, re.I):
            score -= 0.05

    product_pattern = r"라떼|커피|우동|카츠|버거|샌드|물티슈|키친타올|패치|두부김치|소주|맥주|김치전|모듬전|전\s|봉투|쇼핑백|비누|가위|핸드워시|양갈비|프렌치랙|마늘밥|감바스|참이슬|하이볼|자몽|모히또|피치|코젤|고기|밥|탕|찌개|면"
    if re.search(product_pattern, joined, re.I):
        score += 0.06

    score += candidate_item_block_score(lines)

    item_line_score = 0.0
    amount_only_rows = 0
    in_item_area = False
    for line in lines:
        c = re.sub(r"\s+", "", line)
        if re.search(r"상품명|제품명|품명|상품단가수량금액", c):
            in_item_area = True
            continue
        if re.search(r"합계|총액|받은금액|결제|승인|부가세|공급가|과세|갑세|YIC", c):
            in_item_area = False
        has_amount = bool(re.search(r"\d{1,3}(?:[,\.]\d{3})+", line))
        has_korean = bool(re.search(r"[가-힣]{2,}", line))
        has_product = bool(re.search(product_pattern, line, re.I))
        if has_amount and (has_product or (in_item_area and has_korean)):
            item_line_score += 0.08
        elif in_item_area and has_amount and not has_korean:
            amount_only_rows += 1

    score += min(0.36, item_line_score)
    score -= min(0.18, amount_only_rows * 0.045)

    # 승인/전화/카드번호성 긴 숫자 라인이 너무 많으면 감점
    long_digit_lines = sum(1 for line in lines if len(re.sub(r"\D", "", line)) >= 8 and not re.search(r"[,\.]\d{3}|원|금액|합계|결제", line))
    score -= min(0.12, long_digit_lines * 0.025)
    score += candidate_receipt_item_parse_score(joined, hints)
    return score

def _candidate_hint_count(hints: dict[str, Any]) -> int:
    return (
        len(hints.get("amounts") or [])
        + len(hints.get("dates") or [])
        + len(hints.get("vendor_candidates") or [])
    )


def _candidate_text_len(item: dict[str, Any]) -> int:
    return len(str(item.get("text") or "").strip())


def _is_destructive_ocr_candidate(label: str) -> bool:
    label = str(label or "").lower()
    return any(token in label for token in ["binary", "line_preserved", "shadow_removed", "illumination"])


def select_best_ocr_candidates(candidate_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    OCR 후보 선택 개선.

    기준:
    - 기본은 품질 점수 최고 후보
    - 긴 영수증 crop 후보가 충분히 좋으면 crop 여러 개 선택
    - 금액/날짜가 있는 후보를 가산
    - binary/line/illumination 후보가 원본계 후보보다 텍스트를 많이 잃으면 감점
    """
    if not candidate_results:
        return []

    stable_items = [
        item for item in candidate_results
        if any(token in str(item.get("label") or "").lower() for token in ["resized_color", "enhanced_gray", "enhanced_gray_fast"])
    ]
    stable_source = stable_items or candidate_results
    stable_best_len = max((_candidate_text_len(item) for item in stable_source), default=0)
    stable_best_hints = max((_candidate_hint_count(item.get("field_hints") or {}) for item in stable_source), default=0)

    scored_items = []

    for item in candidate_results:
        score = float(item.get("quality_score") or 0)
        hints = item.get("field_hints") or {}
        label = str(item.get("label") or "").lower()

        if hints.get("has_amount"):
            score += 0.05

        if hints.get("has_date"):
            score += 0.04

        if hints.get("has_vendor_candidate"):
            score += 0.03

        structure_bonus = candidate_structure_score(item.get("text") or "", hints)
        score += structure_bonus
        score += candidate_date_consensus_bonus(item, candidate_results)
        if "line_preserved" in label and structure_bonus < 0.20:
            score -= 0.14

        current_len = _candidate_text_len(item)
        current_hints = _candidate_hint_count(hints)

        if _is_destructive_ocr_candidate(label):
            if stable_best_len >= 80 and current_len < stable_best_len * 0.65:
                score -= 0.18
            if stable_best_hints >= 2 and current_hints < stable_best_hints:
                score -= min(0.16, (stable_best_hints - current_hints) * 0.04)

        metrics = item.get("metrics") or {}
        noise_ratio = 0.0
        try:
            noise_ratio = float(metrics.get("noise_ratio") or 0)
        except Exception:
            noise_ratio = 0.0

        if "binary" in label:
            if not hints.get("has_amount") and score < 0.5:
                score -= 0.10
            if noise_ratio > 0.03:
                score -= 0.12

        # 1.0으로 강제 clip하지 않는다. 기존에는 quality_score=1.0 후보가 무조건 이겨서
        # 보정 후보의 더 좋은 날짜/상호가 버려졌다.
        item["_selection_score"] = round(max(0.0, score), 4)
        scored = dict(item)
        scored_items.append(scored)

    usable = [
        item for item in scored_items
        if item.get("is_usable")
    ]

    source = usable if usable else scored_items

    sorted_items = sorted(
        source,
        key=lambda item: item.get("_selection_score") or item.get("quality_score") or 0,
        reverse=True,
    )

    best = sorted_items[0]

    crop_items = [
        item for item in sorted_items
        if "crop" in str(item.get("label") or "").lower()
        and item.get("is_usable")
        and (item.get("_selection_score") or 0) >= 0.42
    ]

    if len(crop_items) >= 2:
        return crop_items[:5]

    # 일반 영수증은 여러 전처리 후보를 텍스트로 이어 붙이면 같은 영수증이 2번 반복되고,
    # 금액/품목 순서가 섞여 구조화가 더 나빠진다.
    # 따라서 crop으로 분할된 긴 문서가 아닌 경우에는 가장 일관적인 후보 1개만 사용한다.
    return [best]


def merge_selected_ocr_texts(selected: list[dict[str, Any]]) -> str:
    """
    고품질 후보만 병합한다.
    """
    if not selected:
        return ""

    if len(selected) == 1:
        return selected[0].get("text") or ""

    merged_lines: list[str] = []
    normalized_seen: set[str] = set()

    for item in selected:
        text = item.get("text") or ""

        for line in text.splitlines():
            cleaned = normalize_ocr_line(line)

            if not cleaned:
                continue

            key = normalize_line_for_dedupe(cleaned)

            if not key:
                continue

            if key in normalized_seen:
                continue

            normalized_seen.add(key)
            merged_lines.append(cleaned)

    return "\n".join(merged_lines)


def normalize_line_for_dedupe(line: str) -> str:
    value = str(line or "").strip().lower()
    value = re.sub(r"\s+", "", value)
    value = value.replace(",", "")
    value = value.replace(".", "")
    return value


def merge_ocr_texts(texts: list[str]) -> str:
    merged_lines: list[str] = []
    normalized_seen: set[str] = set()

    for text in texts:
        for line in text.splitlines():
            cleaned = normalize_ocr_line(line)

            if not cleaned:
                continue

            key = normalize_line_for_dedupe(cleaned)

            if not key:
                continue

            if key in normalized_seen:
                continue

            normalized_seen.add(key)
            merged_lines.append(cleaned)

    return "\n".join(merged_lines)


def should_mark_as_supplement_candidate(
    input_quality: dict[str, Any],
    final_quality: dict[str, Any],
    merged_text: str,
    field_hints: dict[str, Any],
) -> dict[str, Any]:
    """
    보완요청 후보 판단.
    실제 DB 상태를 NEED_SUPPLEMENT로 바꾸는 것은 처리/검증 서비스에서 해야 한다.
    이 함수는 판단 근거만 meta로 제공한다.
    """
    reasons = []

    if input_quality.get("very_blurry"):
        reasons.append("이미지가 매우 흐립니다.")

    if input_quality.get("too_small"):
        reasons.append("이미지 해상도가 낮습니다.")

    if input_quality.get("too_dark"):
        reasons.append("이미지가 너무 어둡습니다.")

    if input_quality.get("too_bright"):
        reasons.append("이미지가 과노출되었습니다.")

    quality_score = final_quality.get("quality_score") or 0
    text_length = len(merged_text or "")

    if quality_score < 0.35:
        reasons.append("OCR 품질 점수가 낮습니다.")

    if text_length < 20:
        reasons.append("OCR로 추출된 텍스트가 너무 적습니다.")

    if not field_hints.get("has_amount"):
        reasons.append("금액 후보를 찾지 못했습니다.")

    if not field_hints.get("has_date"):
        reasons.append("날짜 후보를 찾지 못했습니다.")

    is_candidate = len(reasons) > 0

    return {
        "is_candidate": is_candidate,
        "reasons": reasons,
        "recommended_status": "NEED_SUPPLEMENT" if is_candidate else "NONE",
    }


def calculate_average(values: list[Any]) -> float | None:
    numbers = []

    for value in values:
        try:
            number = float(value)
        except Exception:
            continue

        if 0 <= number <= 1:
            numbers.append(number)

    if not numbers:
        return None

    return round(sum(numbers) / len(numbers), 4)


# =========================================================
# PDF OCR
# =========================================================

def extract_text_from_pdf(pdf_path: str | Path) -> str:
    """
    PDF 처리.

    개선:
    1. 텍스트 PDF는 PyMuPDF로 직접 텍스트 추출 우선
    2. 텍스트가 충분하면 OCR 생략
    3. 스캔 PDF 또는 텍스트가 부족한 PDF만 이미지 렌더링 OCR 수행
    """
    try:
        import fitz
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="PDF OCR을 위해 PyMuPDF 설치가 필요합니다. pip install PyMuPDF 를 실행하세요.",
        ) from exc

    pdf_path = Path(pdf_path)

    direct_text_result = extract_text_from_pdf_direct(pdf_path)

    if direct_text_result["is_usable"]:
        meta = {
            "source": "PDF_DIRECT_TEXT",
            "page_count": direct_text_result["page_count"],
            "ocr_confidence": 0.98,
            "ocr_confidence_percent": 98,
            "ocr_quality_score": 0.98,
            "ocr_quality_percent": 98,
            "engine_confidence": None,
            "direct_text_used": True,
            "text_length": len(direct_text_result["text"]),
            "supplement_candidate": {
                "is_candidate": False,
                "reasons": [],
                "recommended_status": "NONE",
            },
            "field_hints": extract_field_hints_from_text(direct_text_result["text"]),
        }

        set_last_ocr_meta(meta)

        print("\n" + "=" * 80, flush=True)
        print("[PDF DIRECT TEXT USED]", flush=True)
        print(json.dumps(meta, ensure_ascii=False, indent=2, default=str), flush=True)
        print("=" * 80 + "\n", flush=True)

        return direct_text_result["text"]

    texts: list[str] = []
    page_metas: list[dict[str, Any]] = []

    try:
        with tempfile.TemporaryDirectory(prefix="pdf_ocr_") as temp_dir:
            temp_path = Path(temp_dir)
            document = fitz.open(str(pdf_path))

            for page_index in range(len(document)):
                page = document.load_page(page_index)

                pix = page.get_pixmap(
                    matrix=fitz.Matrix(3, 3),
                    alpha=False,
                )

                image_path = temp_path / f"page_{page_index + 1}.png"
                pix.save(str(image_path))

                page_text = extract_text_from_image(image_path)
                page_meta = get_last_ocr_meta()

                if page_text:
                    texts.append(page_text)

                page_metas.append(
                    {
                        "page": page_index + 1,
                        "ocr_meta": page_meta,
                    }
                )

            document.close()

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"PDF OCR 처리에 실패했습니다: {str(exc)}",
        ) from exc

    merged = "\n\n".join(texts)

    page_scores = [
        item.get("ocr_meta", {}).get("ocr_quality_score")
        for item in page_metas
    ]

    final_score = calculate_average(page_scores)
    field_hints = extract_field_hints_from_text(merged)

    supplement_candidate = should_mark_as_supplement_candidate(
        input_quality={
            "available": True,
            "quality_ok": bool(merged),
        },
        final_quality={
            "quality_score": final_score or 0,
        },
        merged_text=merged,
        field_hints=field_hints,
    )

    set_last_ocr_meta(
        {
            "source": "PaddleOCR PDF",
            "page_count": len(page_metas),
            "direct_text_used": False,
            "direct_text_reason": direct_text_result.get("reason"),
            "ocr_confidence": final_score or 0,
            "ocr_confidence_percent": round((final_score or 0) * 100),
            "ocr_quality_score": final_score or 0,
            "ocr_quality_percent": round((final_score or 0) * 100),
            "field_hints": field_hints,
            "supplement_candidate": supplement_candidate,
            "pages": page_metas,
        }
    )

    return merged


def extract_text_from_pdf_direct(pdf_path: Path) -> dict[str, Any]:
    """
    텍스트 PDF 직접 추출.
    스캔 PDF가 아닌 경우 OCR보다 훨씬 정확하다.
    """
    try:
        import fitz

        document = fitz.open(str(pdf_path))
        page_texts = []

        for page_index in range(len(document)):
            page = document.load_page(page_index)
            text = page.get_text("text") or ""

            if text.strip():
                page_texts.append(text.strip())

        page_count = len(document)
        document.close()

        merged = "\n\n".join(page_texts)
        cleaned = clean_pdf_direct_text(merged)

        quality = calculate_direct_pdf_text_quality(cleaned)

        return {
            "text": cleaned,
            "page_count": page_count,
            "is_usable": quality["is_usable"],
            "quality": quality,
            "reason": quality["reason"],
        }

    except Exception as exc:
        return {
            "text": "",
            "page_count": 0,
            "is_usable": False,
            "quality": {},
            "reason": f"PDF 직접 텍스트 추출 실패: {str(exc)}",
        }


def clean_pdf_direct_text(text: str) -> str:
    lines = []

    for line in (text or "").splitlines():
        cleaned = normalize_ocr_line(line)

        if not cleaned:
            continue

        lines.append(cleaned)

    return "\n".join(lines)


def calculate_direct_pdf_text_quality(text: str) -> dict[str, Any]:
    text = text or ""
    lines = [line for line in text.splitlines() if line.strip()]
    length = len(text)

    has_korean = bool(re.search(r"[가-힣]", text))
    has_digit = bool(re.search(r"\d", text))
    has_amount = bool(re.search(r"\d{1,3}(?:[,.]\d{3})+\s*원?", text))
    has_date = bool(
        re.search(r"20\d{2}[-./년\s]*\d{1,2}[-./월\s]*\d{1,2}", text)
        or re.search(r"\d{2}[-./]\d{1,2}[-./]\d{1,2}", text)
    )

    is_usable = length >= 40 and len(lines) >= 3 and (has_korean or has_digit)

    if has_amount or has_date:
        is_usable = length >= 25 and len(lines) >= 2

    reasons = []

    if length < 40:
        reasons.append("텍스트 길이 부족")

    if len(lines) < 3:
        reasons.append("텍스트 줄 수 부족")

    if not has_korean and not has_digit:
        reasons.append("유효 문자 부족")

    if not reasons:
        reasons.append("PDF 직접 텍스트 추출 가능")

    return {
        "is_usable": is_usable,
        "length": length,
        "line_count": len(lines),
        "has_korean": has_korean,
        "has_digit": has_digit,
        "has_amount": has_amount,
        "has_date": has_date,
        "reason": ", ".join(reasons),
    }