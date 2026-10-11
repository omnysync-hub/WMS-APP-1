/**
 * Face box for a saved JPEG.
 * Skip still-image ML Kit (slow on full-res) — scale preview box or use oval.
 */
import {
  faceBoxUsable,
  loadJpegRgb,
  ovalFallbackBox,
  type RgbImage,
} from "@/services/face/imagePrep";
import type { DetectedFace } from "@/services/face/pipeline";

/** Scale preview-space box into JPEG pixel space. */
function scalePreviewToPhoto(
  face: DetectedFace,
  img: RgbImage
): DetectedFace | null {
  const box = face.box;

  const candidates: { pw: number; ph: number }[] = [
    { pw: img.width, ph: img.height },
    { pw: 1080, ph: 1920 },
    { pw: 720, ph: 1280 },
    { pw: 1440, ph: 2560 },
    { pw: img.height, ph: img.width },
  ];

  const tryScale = (pw: number, ph: number, mirrorX: boolean): DetectedFace | null => {
    if (pw < 100 || ph < 100) return null;
    const sx = img.width / pw;
    const sy = img.height / ph;
    let x = box.x * sx;
    const y = box.y * sy;
    const width = box.width * sx;
    const height = box.height * sy;
    if (mirrorX) x = img.width - (x + width);

    const mapEye = (p: { x: number; y: number }) => {
      let ex = p.x * sx;
      const ey = p.y * sy;
      if (mirrorX) ex = img.width - ex;
      return { x: ex, y: ey };
    };

    const scaled: DetectedFace = {
      box: { x, y, width, height },
      eyes: face.eyes
        ? { left: mapEye(face.eyes.left), right: mapEye(face.eyes.right) }
        : undefined,
      landmarks: face.landmarks,
    };
    return faceBoxUsable(scaled.box, img) ? scaled : null;
  };

  for (const { pw, ph } of candidates) {
    const hit = tryScale(pw, ph, true) ?? tryScale(pw, ph, false);
    if (hit) return hit;
  }
  return null;
}

/**
 * Resolve a face box in the same pixel space as `loadJpegRgb`.
 * Pass `img` when already decoded to avoid a second JPEG load.
 */
export async function resolvePhotoFace(
  uri: string,
  previewFallback: DetectedFace | null,
  imgIn?: RgbImage
): Promise<{ face: DetectedFace; source: "scaled" | "oval" }> {
  const img = imgIn ?? (await loadJpegRgb(uri));

  if (previewFallback) {
    const scaled = scalePreviewToPhoto(previewFallback, img);
    if (scaled) return { face: scaled, source: "scaled" };
  }

  return {
    face: { box: ovalFallbackBox(img) },
    source: "oval",
  };
}
