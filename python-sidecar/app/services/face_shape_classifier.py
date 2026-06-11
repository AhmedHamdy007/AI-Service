import json
import math
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

from app.services.face_shape import classify_face_shape

MODEL_FILE = os.getenv("FACE_SHAPE_MODEL_FILE", "xception_faceshape_best.keras")
MODEL_PREPROCESSOR = os.getenv("FACE_SHAPE_MODEL_PREPROCESSOR", "xception").strip().lower()
CLASS_NAMES_FILE = "class_names.json"
VIEW_CONFIDENCE_THRESHOLD = 0.50
CONSENSUS_MIN_VOTES = 2
IMAGE_SIZE = (224, 224)

_model = None
_class_names: Optional[List[str]] = None
_tf = None
_preprocess_input = None
_face_mesh = None
_face_mesh_lock = threading.Lock()


class FaceShapeModelError(RuntimeError):
    pass


def _candidate_model_dirs() -> List[Path]:
    sidecar_root = Path(__file__).resolve().parents[2]
    return [
        sidecar_root / "models",
        sidecar_root / "model",
    ]


def _find_model_asset(filename: str) -> Path:
    for model_dir in _candidate_model_dirs():
        candidate = model_dir / filename
        if candidate.exists():
            return candidate
    searched = ", ".join(str(path) for path in _candidate_model_dirs())
    raise FaceShapeModelError(f"Missing model asset {filename}; searched: {searched}")


def _load_tensorflow():
    global _tf
    if _tf is not None:
        return _tf

    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

    import tensorflow as tf

    tf.config.threading.set_inter_op_parallelism_threads(2)
    tf.config.threading.set_intra_op_parallelism_threads(2)

    for gpu in tf.config.list_physical_devices("GPU"):
        try:
            tf.config.experimental.set_memory_growth(gpu, True)
        except Exception:
            pass

    _tf = tf
    return tf


def load_face_shape_model():
    global IMAGE_SIZE, _model, _class_names, _preprocess_input
    if _model is not None and _class_names is not None:
        return _model

    tf = _load_tensorflow()
    model_path = _find_model_asset(MODEL_FILE)
    class_names_path = _find_model_asset(CLASS_NAMES_FILE)

    with class_names_path.open("r", encoding="utf-8") as class_file:
        class_names = json.load(class_file)

    if not isinstance(class_names, list) or not all(isinstance(item, str) for item in class_names):
        raise FaceShapeModelError("class_names.json must contain a JSON array of strings")

    _model = tf.keras.models.load_model(str(model_path), compile=False)
    _class_names = class_names
    IMAGE_SIZE = _model_image_size(_model) or IMAGE_SIZE
    _preprocess_input = _resolve_preprocessor(tf)
    _warm_up_model()
    _warm_up_face_mesh()
    return _model


def _model_image_size(model: Any) -> Optional[Tuple[int, int]]:
    input_shape = getattr(model, "input_shape", None)
    if isinstance(input_shape, list):
        input_shape = input_shape[0] if input_shape else None
    if not input_shape or len(input_shape) < 4:
        return None

    height = input_shape[1]
    width = input_shape[2]
    if isinstance(height, int) and isinstance(width, int) and height > 0 and width > 0:
        return (width, height)
    return None


def _resolve_preprocessor(tf: Any):
    if MODEL_PREPROCESSOR in {"", "none", "raw"}:
        return None
    if MODEL_PREPROCESSOR == "xception":
        return tf.keras.applications.xception.preprocess_input
    if MODEL_PREPROCESSOR == "convnext":
        return tf.keras.applications.convnext.preprocess_input
    raise FaceShapeModelError(
        "FACE_SHAPE_MODEL_PREPROCESSOR must be one of: xception, convnext, raw"
    )


def _warm_up_model() -> None:
    if _model is None:
        return

    # Compile TensorFlow's first inference path during startup, not during the
    # first user request that is already racing the gateway timeout.
    dummy_input = np.zeros((1, IMAGE_SIZE[1], IMAGE_SIZE[0], 3), dtype=np.float32)
    if _preprocess_input is not None:
        dummy_input = _preprocess_input(dummy_input)
    _model.predict(dummy_input, verbose=0)


def _get_face_mesh():
    global _face_mesh
    if _face_mesh is not None:
        return _face_mesh

    import mediapipe as mp

    with _face_mesh_lock:
        if _face_mesh is None:
            _face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
    return _face_mesh


def _warm_up_face_mesh() -> None:
    # MediaPipe creates native graph state lazily; running one tiny blank frame
    # at startup keeps the first real user image from paying that setup cost.
    blank_image = np.zeros((256, 256, 3), dtype=np.uint8)
    _detect_face_landmarks(blank_image)


def close_face_shape_resources() -> None:
    global _face_mesh
    with _face_mesh_lock:
        if _face_mesh is not None:
            _face_mesh.close()
            _face_mesh = None


def _image_bytes_to_rgb(image_bytes: bytes) -> np.ndarray:
    from io import BytesIO

    with Image.open(BytesIO(image_bytes)) as image:
        return np.array(image.convert("RGB"))


def _resize_for_detection(rgb_image: np.ndarray, max_dimension: int = 1280) -> np.ndarray:
    height, width = rgb_image.shape[:2]
    largest_dimension = max(width, height)
    if largest_dimension <= max_dimension:
        return rgb_image

    scale = max_dimension / float(largest_dimension)
    target_size = (
        max(1, int(round(width * scale))),
        max(1, int(round(height * scale))),
    )
    resized = Image.fromarray(rgb_image, mode="RGB").resize(target_size, Image.Resampling.BILINEAR)
    return np.asarray(resized, dtype=np.uint8)


def _detect_face_landmarks(rgb_image: np.ndarray) -> Optional[List[List[float]]]:
    height, width = rgb_image.shape[:2]
    face_mesh = _get_face_mesh()

    with _face_mesh_lock:
        results = face_mesh.process(rgb_image)

    if not results.multi_face_landmarks:
        return None

    raw_landmarks = results.multi_face_landmarks[0].landmark
    return [[point.x * width, point.y * height] for point in raw_landmarks]


def _face_bbox(landmarks: List[List[float]], width: int, height: int, padding_ratio: float = 0.18) -> Tuple[int, int, int, int]:
    xs = [point[0] for point in landmarks]
    ys = [point[1] for point in landmarks]
    left, top, right, bottom = min(xs), min(ys), max(xs), max(ys)
    box_width = max(right - left, 1.0)
    box_height = max(bottom - top, 1.0)
    padding = max(box_width, box_height) * padding_ratio

    return (
        max(int(math.floor(left - padding)), 0),
        max(int(math.floor(top - padding)), 0),
        min(int(math.ceil(right + padding)), width),
        min(int(math.ceil(bottom + padding)), height),
    )


def _eye_angle_degrees(landmarks: List[List[float]]) -> float:
    left_eye = landmarks[33]
    right_eye = landmarks[263]
    return math.degrees(math.atan2(right_eye[1] - left_eye[1], right_eye[0] - left_eye[0]))


def _resize_raw_for_model(rgb_image: np.ndarray) -> np.ndarray:
    resized = Image.fromarray(rgb_image, mode="RGB").resize(IMAGE_SIZE, Image.BICUBIC)
    return np.asarray(resized, dtype=np.float32)


def _crop_aligned_face(
    rgb_image: np.ndarray,
    landmarks: List[List[float]],
    padding_ratio: float = 0.18,
) -> np.ndarray:
    height, width = rgb_image.shape[:2]
    left, top, right, bottom = _face_bbox(landmarks, width, height, padding_ratio)
    center = ((left + right) / 2.0, (top + bottom) / 2.0)
    angle = _eye_angle_degrees(landmarks)

    pil_image = Image.fromarray(rgb_image, mode="RGB")
    aligned = pil_image.rotate(-angle, resample=Image.BICUBIC, center=center)
    cropped = aligned.crop((left, top, right, bottom)).resize(IMAGE_SIZE, Image.BICUBIC)
    return np.asarray(cropped, dtype=np.float32)


def _prepare_model_input(image_array: np.ndarray) -> np.ndarray:
    batch = np.expand_dims(image_array.astype(np.float32, copy=False), axis=0)
    if _preprocess_input is not None:
        return _preprocess_input(batch)
    return batch


def _softmax(values: np.ndarray) -> np.ndarray:
    shifted = values - np.max(values)
    exp = np.exp(shifted)
    return exp / np.sum(exp)


def _normalize_model_scores(prediction: np.ndarray) -> np.ndarray:
    scores = np.asarray(prediction, dtype=np.float64).reshape(-1)
    if np.any(scores < 0) or np.any(scores > 1) or not np.isclose(np.sum(scores), 1.0, atol=1e-3):
        scores = _softmax(scores)
    return scores


def _scores_by_class(scores: np.ndarray) -> Dict[str, float]:
    if _class_names is None:
        raise FaceShapeModelError("Face shape class names are not loaded")
    if len(scores) != len(_class_names):
        raise FaceShapeModelError(
            f"Model output has {len(scores)} scores but class_names.json has {len(_class_names)} classes"
        )
    return {
        class_name: round(float(score), 4)
        for class_name, score in zip(_class_names, scores)
    }


def _predict_view(model: Any, name: str, image_array: np.ndarray) -> Dict[str, Any]:
    if _class_names is None:
        raise FaceShapeModelError("Face shape class names are not loaded")

    prediction = model.predict(_prepare_model_input(image_array), verbose=0)[0]
    scores = _normalize_model_scores(prediction)
    best_index = int(np.argmax(scores))
    return {
        "view": name,
        "shape": _class_names[best_index],
        "confidence": round(float(scores[best_index]), 4),
        "scores": _scores_by_class(scores),
        "_scores_array": scores,
    }


def _strip_internal_prediction_fields(prediction: Dict[str, Any]) -> Dict[str, Any]:
    return {
        key: value
        for key, value in prediction.items()
        if not key.startswith("_")
    }


def _average_scores(view_predictions: List[Dict[str, Any]]) -> np.ndarray:
    if not view_predictions:
        raise FaceShapeModelError("No CNN view predictions were produced")
    return np.mean([item["_scores_array"] for item in view_predictions], axis=0)


def _top_candidates(scores: np.ndarray, limit: int = 3) -> List[Dict[str, Any]]:
    if _class_names is None:
        raise FaceShapeModelError("Face shape class names are not loaded")
    ranked_indexes = np.argsort(scores)[::-1][:limit]
    return [
        {
            "shape": _class_names[index],
            "confidence": round(float(scores[index]), 4),
        }
        for index in ranked_indexes
    ]


def _resolve_cnn_consensus(view_predictions: List[Dict[str, Any]]) -> Dict[str, Any]:
    if _class_names is None:
        raise FaceShapeModelError("Face shape class names are not loaded")

    averaged_scores = _average_scores(view_predictions)
    averaged_scores_by_class = _scores_by_class(averaged_scores)
    candidates = _top_candidates(averaged_scores)

    confident_votes = [
        prediction
        for prediction in view_predictions
        if prediction["confidence"] >= VIEW_CONFIDENCE_THRESHOLD
    ]

    vote_counts: Dict[str, int] = {}
    for prediction in confident_votes:
        vote_counts[prediction["shape"]] = vote_counts.get(prediction["shape"], 0) + 1

    consensus_shape = None
    if vote_counts:
        consensus_shape, votes = max(vote_counts.items(), key=lambda item: item[1])
        if votes < CONSENSUS_MIN_VOTES:
            consensus_shape = None

    if consensus_shape:
        confidence = averaged_scores_by_class[consensus_shape]
        return {
            "shape": consensus_shape,
            "confidence": confidence,
            "method": "cnn_consensus",
            "is_confident": True,
            "all_scores": averaged_scores_by_class,
            "cnn_shape": consensus_shape,
            "cnn_confidence": confidence,
            "candidates": candidates,
            "view_predictions": [
                _strip_internal_prediction_fields(prediction)
                for prediction in view_predictions
            ],
        }

    top_candidate = candidates[0]
    return {
        "shape": top_candidate["shape"],
        "confidence": top_candidate["confidence"],
        "method": "cnn_low_confidence",
        "is_confident": False,
        "uncertainty_reason": "cnn_views_disagree",
        "all_scores": averaged_scores_by_class,
        "cnn_shape": top_candidate["shape"],
        "cnn_confidence": top_candidate["confidence"],
        "candidates": candidates,
        "view_predictions": [
            _strip_internal_prediction_fields(prediction)
            for prediction in view_predictions
        ],
    }


def _no_face_response() -> Dict[str, Any]:
    return {
        "face_detected": False,
        "shape": None,
        "confidence": 0.0,
        "method": None,
        "all_scores": {},
    }


def predict(image_bytes: bytes) -> Dict[str, Any]:
    model = load_face_shape_model()
    original_rgb_image = _image_bytes_to_rgb(image_bytes)
    rgb_image = _resize_for_detection(original_rgb_image)
    landmarks = _detect_face_landmarks(rgb_image)

    if landmarks is None:
        return _no_face_response()

    view_predictions = [
        _predict_view(model, "raw_resize", _resize_raw_for_model(original_rgb_image)),
        _predict_view(model, "mediapipe_crop", _crop_aligned_face(rgb_image, landmarks, 0.18)),
        _predict_view(model, "mediapipe_loose_crop", _crop_aligned_face(rgb_image, landmarks, 0.80)),
    ]
    cnn_result = _resolve_cnn_consensus(view_predictions)

    # Geometry is diagnostic only. It must not override or replace CNN output.
    geometric = classify_face_shape(landmarks)

    return {
        "face_detected": True,
        "model": MODEL_FILE,
        "model_preprocessor": MODEL_PREPROCESSOR or "raw",
        **cnn_result,
        "geometric_shape": geometric["face_shape"],
        "geometric_confidence": geometric["confidence"],
        "geometric_scores": geometric.get("all_scores", {}),
        "measurements": geometric.get("measurements", {}),
    }
