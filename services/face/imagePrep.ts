import * as FileSystem from "expo-file-system/legacy";
import jpeg from "jpeg-js";

export type RgbImage = {
  width: number;
  height: number;
  /** RGB interleaved 0–255 */
  data: Uint8Array;
};

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Load a local JPEG (vision-camera takePhoto path / file://) into RGB. */
export async function loadJpegRgb(uri: string): Promise<RgbImage> {
  const path = uri.startsWith("file://") ? uri : `file://${uri}`;
  const b64 = await FileSystem.readAsStringAsync(path, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  const rgb = new Uint8Array(decoded.width * decoded.height * 3);
  for (let i = 0, j = 0; i < decoded.data.length; i += 4, j += 3) {
    rgb[j] = decoded.data[i];
    rgb[j + 1] = decoded.data[i + 1];
    rgb[j + 2] = decoded.data[i + 2];
  }
  return { width: decoded.width, height: decoded.height, data: rgb };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Crop face with margin, then resize to square size (nearest neighbor — fine for pilot). */
export function cropAndResize(
  img: RgbImage,
  box: FaceBox,
  outSize: number,
  margin = 0.25
): Float32Array {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const side = Math.max(box.width, box.height) * (1 + margin);
  const x0 = clamp(Math.floor(cx - side / 2), 0, img.width - 1);
  const y0 = clamp(Math.floor(cy - side / 2), 0, img.height - 1);
  const x1 = clamp(Math.floor(cx + side / 2), 0, img.width);
  const y1 = clamp(Math.floor(cy + side / 2), 0, img.height);
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);

  const out = new Float32Array(3 * outSize * outSize);
  for (let oy = 0; oy < outSize; oy++) {
    for (let ox = 0; ox < outSize; ox++) {
      const ix = x0 + Math.floor((ox / outSize) * w);
      const iy = y0 + Math.floor((oy / outSize) * h);
      const src = (iy * img.width + ix) * 3;
      const r = img.data[src] ?? 0;
      const g = img.data[src + 1] ?? 0;
      const b = img.data[src + 2] ?? 0;
      // MobileFaceNet common: (pixel - 127.5) / 128
      const nchwBase = oy * outSize + ox;
      out[0 * outSize * outSize + nchwBase] = (r - 127.5) / 128;
      out[1 * outSize * outSize + nchwBase] = (g - 127.5) / 128;
      out[2 * outSize * outSize + nchwBase] = (b - 127.5) / 128;
    }
  }
  return out;
}

/**
 * Eye-line alignment (2D rotate) using left/right eye centers when available.
 * Falls back to axis-aligned crop if landmarks missing.
 */
export function alignFaceToNchw(
  img: RgbImage,
  box: FaceBox,
  eyes?: { left: { x: number; y: number }; right: { x: number; y: number } },
  outSize = 112
): Float32Array {
  if (!eyes) return cropAndResize(img, box, outSize);

  // Rotate image conceptually by sampling with inverse rotation around face center
  const angle = Math.atan2(eyes.right.y - eyes.left.y, eyes.right.x - eyes.left.x);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const side = Math.max(box.width, box.height) * 1.35;
  const out = new Float32Array(3 * outSize * outSize);

  for (let oy = 0; oy < outSize; oy++) {
    for (let ox = 0; ox < outSize; ox++) {
      const fx = (ox / outSize - 0.5) * side;
      const fy = (oy / outSize - 0.5) * side;
      const rx = fx * cos - fy * sin + cx;
      const ry = fx * sin + fy * cos + cy;
      const ix = clamp(Math.floor(rx), 0, img.width - 1);
      const iy = clamp(Math.floor(ry), 0, img.height - 1);
      const src = (iy * img.width + ix) * 3;
      const nchwBase = oy * outSize + ox;
      out[0 * outSize * outSize + nchwBase] = ((img.data[src] ?? 0) - 127.5) / 128;
      out[1 * outSize * outSize + nchwBase] = ((img.data[src + 1] ?? 0) - 127.5) / 128;
      out[2 * outSize * outSize + nchwBase] = ((img.data[src + 2] ?? 0) - 127.5) / 128;
    }
  }
  return out;
}
