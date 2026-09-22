/**
 * ONNX sessions for MobileFaceNet (512-d) + Silent-Face-Anti-Spoofing.
 * Models load from documentDirectory/models (after scripts/fetch-models.mjs)
 * or EXPO_PUBLIC_FACE_ML_MOCK=1 for simulator stubs.
 */
import * as FileSystem from "expo-file-system/legacy";
import { FACE_THRESHOLDS } from "@/services/face/thresholds";
import { l2Normalize } from "@/services/face/math";

type OrtModule = typeof import("onnxruntime-react-native");

let ort: OrtModule | null = null;
let embedSession: import("onnxruntime-react-native").InferenceSession | null = null;
let livenessSession: import("onnxruntime-react-native").InferenceSession | null = null;

export class ModelsMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelsMissingError";
  }
}

function mockEnabled() {
  return process.env.EXPO_PUBLIC_FACE_ML_MOCK === "1";
}

function modelsDir() {
  return `${FileSystem.documentDirectory}models/`;
}

function embedPath() {
  return `${modelsDir()}mobilefacenet_int8.onnx`;
}

function livenessPath() {
  return `${modelsDir()}silent_face_anti_spoof_int8.onnx`;
}

async function loadOrt() {
  if (ort) return ort;
  try {
    ort = await import("onnxruntime-react-native");
    return ort;
  } catch {
    throw new ModelsMissingError(
      "onnxruntime-react-native unavailable. Build a Dev Client (Expo Go unsupported)."
    );
  }
}

function mockEmbedding(seed: number): number[] {
  const out = new Array(FACE_THRESHOLDS.embeddingDim);
  let s = seed || 1;
  for (let i = 0; i < out.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return l2Normalize(out);
}

export async function ensureFaceSessions() {
  if (mockEnabled()) return { mock: true as const };
  if (embedSession && livenessSession) return { mock: false as const };

  const [embedInfo, liveInfo] = await Promise.all([
    FileSystem.getInfoAsync(embedPath()),
    FileSystem.getInfoAsync(livenessPath()),
  ]);

  if (!embedInfo.exists || !liveInfo.exists) {
    throw new ModelsMissingError(
      "ONNX models missing. Run: node scripts/fetch-models.mjs then rebuild the Dev Client, or set EXPO_PUBLIC_FACE_ML_MOCK=1 for stub inference."
    );
  }

  const ORT = await loadOrt();
  embedSession = await ORT.InferenceSession.create(embedPath());
  livenessSession = await ORT.InferenceSession.create(livenessPath());
  return { mock: false as const };
}

export async function runEmbedding(inputNchw: Float32Array): Promise<number[]> {
  if (mockEnabled()) return mockEmbedding(Math.abs(inputNchw[10] * 1000) || 42);

  await ensureFaceSessions();
  const ORT = await loadOrt();
  if (!embedSession) throw new ModelsMissingError("Embedding session not ready");

  const inputName = embedSession.inputNames[0];
  const tensor = new ORT.Tensor("float32", inputNchw, [1, 3, 112, 112]);
  const out = await embedSession.run({ [inputName]: tensor });
  const first = out[embedSession.outputNames[0]];
  const data = Array.from(first.data as Float32Array);
  if (data.length !== FACE_THRESHOLDS.embeddingDim) {
    throw new Error(
      `Model output dim ${data.length} ≠ ${FACE_THRESHOLDS.embeddingDim}. Use a 512-d MobileFaceNet ONNX.`
    );
  }
  return l2Normalize(data);
}

export async function runLiveness(inputNchw: Float32Array): Promise<{
  liveness: number;
  spoof: number;
  raw: number[];
}> {
  if (mockEnabled()) {
    return { liveness: 0.92, spoof: 0.08, raw: [0.08, 0.92] };
  }

  await ensureFaceSessions();
  const ORT = await loadOrt();
  if (!livenessSession) throw new ModelsMissingError("Liveness session not ready");

  const inputName = livenessSession.inputNames[0];
  const n = inputNchw.length;
  const side = Math.round(Math.sqrt(n / 3));
  const tensor = new ORT.Tensor("float32", inputNchw, [1, 3, side, side]);
  const out = await livenessSession.run({ [inputName]: tensor });
  const first = out[livenessSession.outputNames[0]];
  const raw = Array.from(first.data as Float32Array);

  const max = Math.max(...raw);
  const exps = raw.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  const probs = exps.map((e) => e / sum);

  const liveIdx = probs.length >= 2 ? 1 : 0;
  const spoofIdx = 0;
  const liveness = probs[liveIdx] ?? 0;
  const spoof = probs.length >= 2 ? probs[spoofIdx] : 1 - liveness;

  return { liveness, spoof, raw: probs };
}

export { embedPath, livenessPath, modelsDir };
