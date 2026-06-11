"""Compare raw-image and production-crop face shape inference.

Usage examples:
  python tools/evaluate_face_shape_pipeline.py --image-dir ../../web-app/src/assets --output-dir eval-output/local-assets
  python tools/evaluate_face_shape_pipeline.py --dataset-dir /path/to/test_dataset --output-dir eval-output/test-set

Dataset mode expects one folder per class:
  test_dataset/
    Heart/
    Oblong/
    Oval/
    Round/
    Square/
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import numpy as np
from PIL import Image


SIDECAR_ROOT = Path(__file__).resolve().parents[1]
if str(SIDECAR_ROOT) not in sys.path:
    sys.path.insert(0, str(SIDECAR_ROOT))

from app.services import face_shape_classifier as classifier  # noqa: E402
from app.services.face_shape import classify_face_shape  # noqa: E402


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass
class Prediction:
    shape: Optional[str]
    confidence: float
    scores: Dict[str, float]
    error: Optional[str] = None


def read_image_bytes(path: Path) -> bytes:
    return path.read_bytes()


def resize_raw_for_model(image_bytes: bytes) -> np.ndarray:
    rgb = classifier._image_bytes_to_rgb(image_bytes)
    resized = Image.fromarray(rgb, mode="RGB").resize(classifier.IMAGE_SIZE, Image.Resampling.BICUBIC)
    return np.asarray(resized, dtype=np.float32)


def predict_array(model, image_array: np.ndarray) -> Prediction:
    prediction = model.predict(classifier._prepare_model_input(image_array), verbose=0)[0]
    scores = classifier._normalize_model_scores(prediction)
    class_names = classifier._class_names
    if class_names is None:
        raise RuntimeError("Class names were not loaded")

    best_index = int(np.argmax(scores))
    score_map = {
        class_name: round(float(score), 4)
        for class_name, score in zip(class_names, scores)
    }
    return Prediction(
        shape=class_names[best_index],
        confidence=round(float(scores[best_index]), 4),
        scores=score_map,
    )


def predict_raw(model, image_bytes: bytes) -> Prediction:
    return predict_array(model, resize_raw_for_model(image_bytes))


def predict_production_crop(model, image_bytes: bytes) -> tuple[Prediction, Prediction, Optional[dict], Optional[np.ndarray]]:
    rgb = classifier._resize_for_detection(classifier._image_bytes_to_rgb(image_bytes))
    landmarks = classifier._detect_face_landmarks(rgb)
    if landmarks is None:
        no_face = Prediction(shape=None, confidence=0.0, scores={}, error="no_face_detected")
        return no_face, no_face, None, None

    cropped = classifier._crop_aligned_face(rgb, landmarks)
    cnn_prediction = predict_array(model, cropped)
    geometric = classify_face_shape(landmarks)
    geometric_prediction = Prediction(
        shape=geometric.get("face_shape"),
        confidence=float(geometric.get("confidence", 0.0)),
        scores=geometric.get("all_scores", {}),
    )
    return cnn_prediction, geometric_prediction, geometric.get("measurements", {}), cropped


def iter_dataset_images(dataset_dir: Path) -> Iterable[tuple[Path, Optional[str]]]:
    class_names = set(classifier._class_names or [])
    class_dirs = [
        path
        for path in dataset_dir.rglob("*")
        if path.is_dir() and path.name in class_names
    ]
    if dataset_dir.name in class_names:
        class_dirs.append(dataset_dir)

    seen_dirs = set()
    for class_dir in sorted(class_dirs):
        if class_dir in seen_dirs:
            continue
        seen_dirs.add(class_dir)
        for image_path in iter_image_files(class_dir, recursive=True):
            yield image_path, class_dir.name


def iter_image_files(root: Path, recursive: bool = True) -> Iterable[Path]:
    pattern = "**/*" if recursive else "*"
    for path in sorted(root.glob(pattern)):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            yield path


def make_empty_confusion(labels: List[str]) -> Dict[str, Dict[str, int]]:
    return {actual: {predicted: 0 for predicted in labels} for actual in labels}


def update_confusion(matrix: Dict[str, Dict[str, int]], actual: Optional[str], predicted: Optional[str]) -> None:
    if actual is None or predicted is None:
        return
    if actual not in matrix or predicted not in matrix[actual]:
        return
    matrix[actual][predicted] += 1


def classification_metrics(matrix: Dict[str, Dict[str, int]]) -> Dict[str, dict]:
    labels = list(matrix.keys())
    metrics: Dict[str, dict] = {}
    total_correct = 0
    total_count = 0

    for label in labels:
        tp = matrix[label][label]
        fp = sum(matrix[actual][label] for actual in labels if actual != label)
        fn = sum(matrix[label][predicted] for predicted in labels if predicted != label)
        support = sum(matrix[label].values())
        total_correct += tp
        total_count += support

        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        metrics[label] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": support,
        }

    metrics["accuracy"] = {
        "score": round(total_correct / total_count, 4) if total_count else 0.0,
        "support": total_count,
    }
    return metrics


def write_confusion_csv(path: Path, labels: List[str], matrix: Dict[str, Dict[str, int]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["actual\\predicted", *labels])
        for actual in labels:
            writer.writerow([actual, *[matrix[actual][predicted] for predicted in labels]])


def evaluate(args: argparse.Namespace) -> dict:
    model = classifier.load_face_shape_model()
    labels = list(classifier._class_names or [])
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.dataset_dir:
        images = list(iter_dataset_images(args.dataset_dir.resolve()))
    else:
        images = [(path, None) for path in iter_image_files(args.image_dir.resolve(), recursive=True)]

    if args.max_images:
        images = images[: args.max_images]

    raw_confusion = make_empty_confusion(labels)
    crop_confusion = make_empty_confusion(labels)
    raw_distribution: Counter[str] = Counter()
    crop_distribution: Counter[str] = Counter()
    geometry_distribution: Counter[str] = Counter()
    no_face_count = 0

    rows = []
    raw_preview_dir = output_dir / "raw_resized"
    crop_preview_dir = output_dir / "production_crops"
    if args.save_images:
        raw_preview_dir.mkdir(parents=True, exist_ok=True)
        crop_preview_dir.mkdir(parents=True, exist_ok=True)

    for index, (image_path, actual) in enumerate(images, start=1):
        image_bytes = read_image_bytes(image_path)
        raw_preview_path = ""
        crop_preview_path = ""

        try:
            raw_array = resize_raw_for_model(image_bytes)
            raw = predict_array(model, raw_array)
            if args.save_images:
                raw_preview_path = str(raw_preview_dir / f"{index:04d}_{image_path.stem}.jpg")
                Image.fromarray(np.clip(raw_array, 0, 255).astype(np.uint8), mode="RGB").save(raw_preview_path, quality=92)
        except Exception as error:
            raw = Prediction(shape=None, confidence=0.0, scores={}, error=str(error))

        try:
            cropped, geometric, measurements, crop_array = predict_production_crop(model, image_bytes)
            if args.save_images and crop_array is not None:
                crop_preview_path = str(crop_preview_dir / f"{index:04d}_{image_path.stem}.jpg")
                Image.fromarray(np.clip(crop_array, 0, 255).astype(np.uint8), mode="RGB").save(crop_preview_path, quality=92)
        except Exception as error:
            cropped = Prediction(shape=None, confidence=0.0, scores={}, error=str(error))
            geometric = Prediction(shape=None, confidence=0.0, scores={}, error=str(error))
            measurements = None

        if cropped.error == "no_face_detected":
            no_face_count += 1

        if raw.shape:
            raw_distribution[raw.shape] += 1
        if cropped.shape:
            crop_distribution[cropped.shape] += 1
        if geometric.shape:
            geometry_distribution[geometric.shape] += 1

        update_confusion(raw_confusion, actual, raw.shape)
        update_confusion(crop_confusion, actual, cropped.shape)

        rows.append(
            {
                "image": str(image_path),
                "actual": actual or "",
                "raw_shape": raw.shape or "",
                "raw_confidence": raw.confidence,
                "raw_error": raw.error or "",
                "crop_shape": cropped.shape or "",
                "crop_confidence": cropped.confidence,
                "crop_error": cropped.error or "",
                "geometric_shape": geometric.shape or "",
                "geometric_confidence": geometric.confidence,
                "geometric_error": geometric.error or "",
                "raw_preview": raw_preview_path,
                "crop_preview": crop_preview_path,
                "raw_scores": json.dumps(raw.scores, sort_keys=True),
                "crop_scores": json.dumps(cropped.scores, sort_keys=True),
                "geometric_scores": json.dumps(geometric.scores, sort_keys=True),
                "measurements": json.dumps(measurements or {}, sort_keys=True),
            }
        )

        if args.verbose:
            print(
                f"[{index}/{len(images)}] {image_path.name}: "
                f"raw={raw.shape}:{raw.confidence} crop={cropped.shape}:{cropped.confidence} "
                f"geo={geometric.shape}:{geometric.confidence}"
            )

    predictions_csv = output_dir / "pipeline_predictions.csv"
    with predictions_csv.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = list(rows[0].keys()) if rows else [
            "image",
            "actual",
            "raw_shape",
            "raw_confidence",
            "raw_error",
            "crop_shape",
            "crop_confidence",
            "crop_error",
            "geometric_shape",
            "geometric_confidence",
            "geometric_error",
            "raw_preview",
            "crop_preview",
            "raw_scores",
            "crop_scores",
            "geometric_scores",
            "measurements",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "labels": labels,
        "total_images": len(images),
        "no_face_count": no_face_count,
        "raw_distribution": dict(raw_distribution),
        "crop_distribution": dict(crop_distribution),
        "geometric_distribution": dict(geometry_distribution),
        "raw_metrics": classification_metrics(raw_confusion) if args.dataset_dir else None,
        "crop_metrics": classification_metrics(crop_confusion) if args.dataset_dir else None,
        "files": {
            "predictions_csv": str(predictions_csv),
        },
    }

    if args.dataset_dir:
        raw_confusion_csv = output_dir / "raw_confusion.csv"
        crop_confusion_csv = output_dir / "production_crop_confusion.csv"
        write_confusion_csv(raw_confusion_csv, labels, raw_confusion)
        write_confusion_csv(crop_confusion_csv, labels, crop_confusion)
        summary["files"]["raw_confusion_csv"] = str(raw_confusion_csv)
        summary["files"]["production_crop_confusion_csv"] = str(crop_confusion_csv)

    summary_json = output_dir / "summary.json"
    summary_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    summary["files"]["summary_json"] = str(summary_json)
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare raw vs production MediaPipe-crop face shape inference.")
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--dataset-dir", type=Path, help="Labeled dataset folder with one subfolder per class.")
    input_group.add_argument("--image-dir", type=Path, help="Unlabeled image folder to summarize predictions for.")
    parser.add_argument("--output-dir", type=Path, default=Path("eval-output/face-shape-pipeline"))
    parser.add_argument("--max-images", type=int, default=0, help="Optional cap for quick smoke runs.")
    parser.add_argument("--save-images", action="store_true", help="Save 224x224 raw-resize and production-crop previews.")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    if args.max_images <= 0:
        args.max_images = None
    return args


def main() -> None:
    summary = evaluate(parse_args())
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
