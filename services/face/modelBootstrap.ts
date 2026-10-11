/**
 * Ensure ONNX models exist under documentDirectory/models.
 * Prefers bundled assets when metro can resolve .onnx; otherwise downloads once.
 */
import * as FileSystem from "expo-file-system/legacy";
import { modelsDir, embedPath, livenessPath } from "@/services/face/onnxSessions";

const EMBED_URL =
  process.env.EXPO_PUBLIC_MOBILEFACENET_URL ||
  "https://hailo-model-zoo.s3.eu-west-2.amazonaws.com/FaceRecognition/arcface/arcface_mobilefacenet/pretrained/2022-08-24/arcface_mobilefacenet.zip";

const LIVE_URL =
  process.env.EXPO_PUBLIC_ANTISPOOF_URL ||
  "https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/resolve/main/minifasnet_v2.onnx?download=true";

async function fileOk(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  return !!(info.exists && info.size && info.size > 50_000);
}

async function tryCopyBundled() {
  try {
    // Nested under expo — may be unavailable in some Metro graphs
    const { Asset } = await import("expo-asset");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const embedMod = require("../../assets/models/mobilefacenet_int8.onnx");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const liveMod = require("../../assets/models/silent_face_anti_spoof_int8.onnx");
    for (const [mod, dest] of [
      [embedMod, embedPath()],
      [liveMod, livenessPath()],
    ] as const) {
      if (await fileOk(dest)) continue;
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      const src = asset.localUri ?? asset.uri;
      if (!src) continue;
      await FileSystem.copyAsync({ from: src, to: dest });
    }
  } catch {
    // fall through to network fetch
  }
}

async function downloadLiveOnnx() {
  if (await fileOk(livenessPath())) return;
  const result = await FileSystem.downloadAsync(LIVE_URL, livenessPath());
  if (result.status !== 200) {
    throw new Error(`Anti-spoof download failed (${result.status})`);
  }
}

/**
 * Hailo ships a zip; if EXPO_PUBLIC_MOBILEFACENET_URL points at a raw .onnx, download direct.
 * Otherwise skip network zip unpack on device — expect models:fetch into assets + bundled copy.
 */
async function downloadEmbedIfDirectOnnx() {
  if (await fileOk(embedPath())) return;
  const url = process.env.EXPO_PUBLIC_MOBILEFACENET_URL;
  if (url && url.endsWith(".onnx")) {
    const result = await FileSystem.downloadAsync(url, embedPath());
    if (result.status !== 200) {
      throw new Error(`Embedding model download failed (${result.status})`);
    }
  }
}

export async function bootstrapFaceModels() {
  await FileSystem.makeDirectoryAsync(modelsDir(), { intermediates: true }).catch(() => {});
  await tryCopyBundled();
  try {
    await downloadLiveOnnx();
    await downloadEmbedIfDirectOnnx();
  } catch (e) {
    if (__DEV__) {
      console.warn("[face] model bootstrap download issue", e);
    }
  }

  // Avoid unused EMBED_URL warning when only used for docs / future zip unpack
  void EMBED_URL;
}
