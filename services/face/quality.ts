import type { DetectedFace } from "@/services/face/pipeline";
import type { RgbImage } from "@/services/face/imagePrep";
import { FACE_THRESHOLDS } from "@/services/face/thresholds";

export type QualityFail =
  | "no_face"
  | "multi_face"
  | "too_small"
  | "off_center"
  | "pose"
  | "eyes_closed"
  | "dark"
  | "bright";

export type QualityResult =
  | { ok: true }
  | { ok: false; reason: QualityFail; message: string };

/** Live preview gates before capture (ML Kit frame metrics). */
export function assessPreviewQuality(
  faceCount: number,
  face: DetectedFace | null,
  frameW?: number,
  frameH?: number,
  opts?: { relaxEyeOpen?: boolean }
): QualityResult {
  if (faceCount < 1 || !face) {
    return { ok: false, reason: "no_face", message: "Center your face in the oval" };
  }
  if (faceCount > 1) {
    return {
      ok: false,
      reason: "multi_face",
      message: "Only one person in frame — others must step away",
    };
  }

  const { box, landmarks } = face;
  const area = box.width * box.height;
  const frameArea =
    frameW && frameH && frameW > 0 && frameH > 0 ? frameW * frameH : null;
  if (frameArea && area / frameArea < FACE_THRESHOLDS.minFaceAreaRatio) {
    return { ok: false, reason: "too_small", message: "Move closer — face too small" };
  }
  if (box.width < FACE_THRESHOLDS.minFacePx || box.height < FACE_THRESHOLDS.minFacePx) {
    return { ok: false, reason: "too_small", message: "Move closer — face too small" };
  }

  if (frameW && frameH) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const dx = Math.abs(cx - frameW / 2) / frameW;
    const dy = Math.abs(cy - frameH / 2) / frameH;
    if (dx > FACE_THRESHOLDS.maxCenterOffset || dy > FACE_THRESHOLDS.maxCenterOffset) {
      return { ok: false, reason: "off_center", message: "Hold face in the center oval" };
    }
  }

  const yaw = Math.abs(landmarks?.yaw ?? 0);
  const pitch = Math.abs(landmarks?.pitch ?? 0);
  if (yaw > FACE_THRESHOLDS.maxYawDeg || pitch > FACE_THRESHOLDS.maxPitchDeg) {
    return {
      ok: false,
      reason: "pose",
      message: "Look straight at the camera",
    };
  }

  const left = landmarks?.leftEyeOpenProb;
  const right = landmarks?.rightEyeOpenProb;
  if (left != null && right != null && !opts?.relaxEyeOpen) {
    const open = (left + right) / 2;
    if (open < FACE_THRESHOLDS.minEyeOpenForCapture) {
      return { ok: false, reason: "eyes_closed", message: "Open your eyes" };
    }
  }

  return { ok: true };
}

/** Post-capture brightness on the face crop (anti print / dark room). */
export function assessCropBrightness(img: RgbImage, face: DetectedFace): QualityResult {
  const { box } = face;
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(img.width, Math.floor(box.x + box.width));
  const y1 = Math.min(img.height, Math.floor(box.y + box.height));
  let sum = 0;
  let n = 0;
  const step = 4;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * img.width + x) * 3;
      sum += 0.299 * (img.data[i] ?? 0) + 0.587 * (img.data[i + 1] ?? 0) + 0.114 * (img.data[i + 2] ?? 0);
      n++;
    }
  }
  const mean = n ? sum / n : 0;
  if (mean < FACE_THRESHOLDS.minBrightness) {
    return { ok: false, reason: "dark", message: "Too dark — face a light source" };
  }
  if (mean > FACE_THRESHOLDS.maxBrightness) {
    return { ok: false, reason: "bright", message: "Too bright — avoid glare / screen flash" };
  }
  return { ok: true };
}
