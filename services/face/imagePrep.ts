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

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Read JPEG EXIF orientation (1..8). Default 1 = no transform. */
function readJpegOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker === 0xda) break; // SOS
    if (marker === 0xe1 && offset + 4 + len <= bytes.length) {
      const start = offset + 4;
      // "Exif\0\0"
      if (
        bytes[start] === 0x45 &&
        bytes[start + 1] === 0x78 &&
        bytes[start + 2] === 0x69 &&
        bytes[start + 3] === 0x66
      ) {
        const tiff = start + 6;
        const little = bytes[tiff] === 0x49;
        const u16 = (i: number) =>
          little ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1];
        const u32 = (i: number) =>
          little
            ? bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)
            : (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
        const ifd0 = tiff + u32(tiff + 4);
        const entries = u16(ifd0);
        for (let e = 0; e < entries; e++) {
          const entry = ifd0 + 2 + e * 12;
          if (entry + 12 > bytes.length) break;
          const tag = u16(entry);
          if (tag === 0x0112) return u16(entry + 8) || 1;
        }
      }
    }
    offset += 2 + len;
  }
  return 1;
}

function rotateRgb(img: RgbImage, orientation: number): RgbImage {
  if (orientation === 1) return img;
  const { width: w, height: h, data } = img;
  const get = (x: number, y: number) => {
    const i = (y * w + x) * 3;
    return [data[i], data[i + 1], data[i + 2]] as const;
  };

  if (orientation === 3) {
    const out = new Uint8Array(data.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [r, g, b] = get(w - 1 - x, h - 1 - y);
        const j = (y * w + x) * 3;
        out[j] = r;
        out[j + 1] = g;
        out[j + 2] = b;
      }
    }
    return { width: w, height: h, data: out };
  }

  if (orientation === 6 || orientation === 8) {
    const nw = h;
    const nh = w;
    const out = new Uint8Array(nw * nh * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [r, g, b] = get(x, y);
        const nx = orientation === 6 ? h - 1 - y : y;
        const ny = orientation === 6 ? x : w - 1 - x;
        const j = (ny * nw + nx) * 3;
        out[j] = r;
        out[j + 1] = g;
        out[j + 2] = b;
      }
    }
    return { width: nw, height: nh, data: out };
  }

  return img;
}

/** Load a local JPEG into upright RGB (applies EXIF orientation).
 * Downscales so long edge ≤ 960 — enough for 80/112 face crops, much faster. */
export async function loadJpegRgb(uri: string): Promise<RgbImage> {
  const path = uri.startsWith("file://") ? uri : `file://${uri}`;
  const b64 = await FileSystem.readAsStringAsync(path, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const orientation = readJpegOrientation(bytes);
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  const rgb = new Uint8Array(decoded.width * decoded.height * 3);
  for (let i = 0, j = 0; i < decoded.data.length; i += 4, j += 3) {
    rgb[j] = decoded.data[i];
    rgb[j + 1] = decoded.data[i + 1];
    rgb[j + 2] = decoded.data[i + 2];
  }
  const upright = rotateRgb(
    { width: decoded.width, height: decoded.height, data: rgb },
    orientation
  );
  return downscaleRgb(upright, 960);
}

function downscaleRgb(img: RgbImage, maxEdge: number): RgbImage {
  const long = Math.max(img.width, img.height);
  if (long <= maxEdge) return img;
  const scale = maxEdge / long;
  const nw = Math.max(1, Math.round(img.width * scale));
  const nh = Math.max(1, Math.round(img.height * scale));
  const out = new Uint8Array(nw * nh * 3);
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y / nh) * img.height));
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x / nw) * img.width));
      const si = (sy * img.width + sx) * 3;
      const di = (y * nw + x) * 3;
      out[di] = img.data[si] ?? 0;
      out[di + 1] = img.data[si + 1] ?? 0;
      out[di + 2] = img.data[si + 2] ?? 0;
    }
  }
  return { width: nw, height: nh, data: out };
}

/** Oval-aligned box matching FaceCaptureCamera framing (photo pixels). */
export function ovalFallbackBox(img: RgbImage): FaceBox {
  const side = Math.min(img.width, img.height) * 0.5;
  return {
    x: (img.width - side) / 2,
    y: img.height * 0.14,
    width: side,
    height: side * 1.15,
  };
}

/** True if box looks like real photo-pixel coords (not a tiny preview box on a 4K image). */
export function faceBoxUsable(box: FaceBox, img: RgbImage): boolean {
  if (!(box.width > 30 && box.height > 30)) return false;
  if (box.x > img.width || box.y > img.height) return false;
  if (box.x + box.width < 0 || box.y + box.height < 0) return false;
  const area = box.width * box.height;
  const imgArea = img.width * img.height;
  if (area < imgArea * 0.03) return false;
  if (area > imgArea * 0.92) return false;
  return true;
}

/** Crop face with margin — RGB, (x-127.5)/128 for MobileFaceNet. */
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
      const nchwBase = oy * outSize + ox;
      out[0 * outSize * outSize + nchwBase] = (r - 127.5) / 128;
      out[1 * outSize * outSize + nchwBase] = (g - 127.5) / 128;
      out[2 * outSize * outSize + nchwBase] = (b - 127.5) / 128;
    }
  }
  return out;
}

/**
 * MiniFASNetV2 crop. Silent-Face/OpenCV: BGR, pixel/255, 2.7× box.
 * `unitRange=false` keeps 0–255 floats (some ONNX ports skip /255).
 */
export function cropLivenessNchw(
  img: RgbImage,
  box: FaceBox,
  outSize = 80,
  scale = 2.7,
  bgr = true,
  unitRange = true
): Float32Array {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const side = Math.max(box.width, box.height) * scale;
  const x0 = clamp(Math.floor(cx - side / 2), 0, img.width - 1);
  const y0 = clamp(Math.floor(cy - side / 2), 0, img.height - 1);
  const x1 = clamp(Math.floor(cx + side / 2), 0, img.width);
  const y1 = clamp(Math.floor(cy + side / 2), 0, img.height);
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const div = unitRange ? 255 : 1;

  const out = new Float32Array(3 * outSize * outSize);
  for (let oy = 0; oy < outSize; oy++) {
    for (let ox = 0; ox < outSize; ox++) {
      const ix = x0 + Math.floor((ox / outSize) * w);
      const iy = y0 + Math.floor((oy / outSize) * h);
      const src = (iy * img.width + ix) * 3;
      const r = (img.data[src] ?? 0) / div;
      const g = (img.data[src + 1] ?? 0) / div;
      const b = (img.data[src + 2] ?? 0) / div;
      const nchwBase = oy * outSize + ox;
      if (bgr) {
        out[0 * outSize * outSize + nchwBase] = b;
        out[1 * outSize * outSize + nchwBase] = g;
        out[2 * outSize * outSize + nchwBase] = r;
      } else {
        out[0 * outSize * outSize + nchwBase] = r;
        out[1 * outSize * outSize + nchwBase] = g;
        out[2 * outSize * outSize + nchwBase] = b;
      }
    }
  }
  return out;
}

export function alignFaceToNchw(
  img: RgbImage,
  box: FaceBox,
  eyes?: { left: { x: number; y: number }; right: { x: number; y: number } },
  outSize = 112
): Float32Array {
  if (!eyes) return cropAndResize(img, box, outSize);

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
