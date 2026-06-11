import numpy as np
import cv2
from typing import Optional

# ---------------------------------------------------------------------------
# MediaPipe Face Mesh — 468 landmark indices
#
# Verified against MediaPipe canonical face model:
# https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
# ---------------------------------------------------------------------------

# --- Jaw ---
JAW_LEFT        = 172   # left jaw corner
JAW_RIGHT       = 397   # right jaw corner
CHIN            = 152   # chin tip (bottom center)

# --- Cheekbones (widest face points) ---
CHEEK_LEFT      = 234   # left cheekbone (zygomatic arch)
CHEEK_RIGHT     = 454   # right cheekbone

# --- Forehead (temple width) ---
FOREHEAD_LEFT   = 103   # left temple / forehead edge
FOREHEAD_RIGHT  = 332   # right temple / forehead edge

# --- Face height anchors ---
NOSE_BRIDGE_TOP = 168   # top of nose bridge (proxy for mid-face)
CHIN_TIP        = 152   # bottom of face

# --- Jaw angle points (sharpness detection) ---
JAW_ANGLE_LEFT  = 136   # left jaw angle
JAW_ANGLE_RIGHT = 365   # right jaw angle


def euclidean(p1, p2) -> float:
    return float(np.linalg.norm(np.array(p1) - np.array(p2)))


def classify_face_shape(landmarks: list) -> dict:
    """
    Classify face shape using Gaussian scoring on 5 geometric ratios.

    Ratios used:
      height_ratio      = face_height / cheek_width
      jaw_to_cheek      = jaw_width / cheek_width
      forehead_to_jaw   = forehead_width / jaw_width
      cheek_to_forehead = cheek_width / forehead_width
      jaw_taper         = jaw_angle_width / jaw_width  (angularity)

    Each shape is scored as a weighted sum of Gaussian functions
    centered on its ideal ratio values.
    """
    lm = landmarks

    jaw_w        = euclidean(lm[JAW_LEFT],       lm[JAW_RIGHT])
    cheek_w      = euclidean(lm[CHEEK_LEFT],     lm[CHEEK_RIGHT])
    forehead_w   = euclidean(lm[FOREHEAD_LEFT],  lm[FOREHEAD_RIGHT])
    face_h       = euclidean(lm[NOSE_BRIDGE_TOP], lm[CHIN_TIP]) * 2.1
    jaw_angle_w  = euclidean(lm[JAW_ANGLE_LEFT], lm[JAW_ANGLE_RIGHT])

    # Key ratios
    height_ratio      = face_h / cheek_w         if cheek_w     > 0 else 1.0
    jaw_to_cheek      = jaw_w  / cheek_w          if cheek_w     > 0 else 1.0
    forehead_to_jaw   = forehead_w / jaw_w        if jaw_w       > 0 else 1.0
    cheek_to_forehead = cheek_w / forehead_w      if forehead_w  > 0 else 1.0
    jaw_taper         = jaw_angle_w / jaw_w       if jaw_w       > 0 else 1.0
    widths_cv         = _cv([jaw_w, cheek_w, forehead_w])

    def G(v, c, w):
        return _gaussian(v, c, w)

    scores = {}

    # OBLONG — tall face, uniform widths
    scores["Oblong"] = (
        G(height_ratio, 1.60, 0.22) * 0.75 +
        (1.0 - min(widths_cv * 2, 1.0)) * 0.25
    )

    # ROUND — short face, uniform widths, soft (tapered) jaw
    scores["Round"] = (
        G(height_ratio,  1.05, 0.18) * 0.40 +
        (1.0 - min(widths_cv * 3, 1.0)) * 0.35 +
        G(jaw_taper,     0.85, 0.10) * 0.25
    )

    # SQUARE — short face, uniform widths, ANGULAR (non-tapered) jaw
    scores["Square"] = (
        G(height_ratio,  1.10, 0.18) * 0.30 +
        (1.0 - min(widths_cv * 3, 1.0)) * 0.25 +
        G(jaw_taper,     0.72, 0.10) * 0.30 +
        G(jaw_to_cheek,  0.90, 0.10) * 0.15
    )

    # HEART — wide forehead, narrow jaw, tapered chin
    scores["Heart"] = (
        G(forehead_to_jaw, 1.20, 0.15) * 0.60 +
        G(jaw_taper,       0.80, 0.12) * 0.40
    )

    # OVAL — balanced, moderate height, cheek slightly widest
    scores["Oval"] = (
        G(height_ratio,    1.35, 0.20) * 0.40 +
        G(jaw_to_cheek,    0.85, 0.10) * 0.35 +
        G(forehead_to_jaw, 0.95, 0.12) * 0.25
    )

    best_shape = max(scores, key=lambda k: scores[k])
    total      = sum(scores.values())
    confidence = round(min((scores[best_shape] / total) * 1.8, 0.99), 3) if total > 0 else 0.5

    return {
        "face_shape": best_shape,
        "confidence": confidence,
        "measurements": {
            "jaw_width":         round(jaw_w, 2),
            "cheek_width":       round(cheek_w, 2),
            "forehead_width":    round(forehead_w, 2),
            "face_height":       round(face_h, 2),
            "height_ratio":      round(height_ratio, 3),
            "jaw_to_cheek":      round(jaw_to_cheek, 3),
            "forehead_to_jaw":   round(forehead_to_jaw, 3),
            "cheek_to_forehead": round(cheek_to_forehead, 3),
            "jaw_taper":         round(jaw_taper, 3),
        },
        "all_scores": {k: round(v, 4) for k, v in scores.items()},
    }


def _gaussian(value: float, center: float, width: float) -> float:
    """Bell curve scoring — peaks at center, falls off smoothly."""
    return float(np.exp(-0.5 * ((value - center) / width) ** 2))


def _cv(values: list) -> float:
    """Coefficient of variation — 0 means all values identical."""
    arr = np.array(values, dtype=float)
    mean = arr.mean()
    return float(arr.std() / mean) if mean > 0 else 0.0


def analyze_face_from_bytes(image_bytes: bytes) -> dict:
    """
    Run MediaPipe Face Mesh on image bytes → classify face shape.
    """
    import mediapipe as mp

    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Could not decode image")

    h, w = image.shape[:2]

    with mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:
        rgb     = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)

    if not results.multi_face_landmarks:
        raise ValueError("No face detected. Ensure the face is clearly visible and well-lit.")

    raw       = results.multi_face_landmarks[0].landmark
    landmarks = [[lm.x * w, lm.y * h] for lm in raw]

    result = classify_face_shape(landmarks)

    xs = [p[0] for p in landmarks]
    ys = [p[1] for p in landmarks]
    result["bbox"]      = [round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)]
    result["num_faces"] = len(results.multi_face_landmarks)

    return result
