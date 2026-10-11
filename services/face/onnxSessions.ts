/**
 * ONNX sessions for MobileFaceNet (512-d) + Silent-Face-Anti-Spoofing.
 * Models load from documentDirectory/models (bootstrapFaceModels copies from assets).
 *
 * Requires a Dev Client / release APK rebuilt with the onnxruntime-react-native native module.
 */
import { NativeModules } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { FACE_THRESHOLDS } from "@/services/face/thresholds";
import { l2Normalize } from "@/services/face/math";

type OrtNs = typeof import("onnxruntime-react-native");
type OrtSession = import("onnxruntime-react-native").InferenceSession;

let ort: OrtNs | null = null;
let embedSession: OrtSession | null = null;
let livenessSession: OrtSession | null = null;

export class ModelsMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelsMissingError";
  }
}

/** Mock only in __DEV__ when explicitly enabled — never in release builds. */
function mockEnabled() {
  if (!__DEV__) return false;
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

function loadOrt(): OrtNs {
  if (ort) return ort;

  // Native module must be in the APK (config plugin + rebuild). Checking first
  // avoids a hard crash from binding.ts calling null.install().
  if (!NativeModules.Onnxruntime) {
    throw new ModelsMissingError(
      "ONNX native module missing from this install. Rebuild Android (npx expo run:android) — a Metro reload cannot add native code."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("onnxruntime-react-native") as OrtNs & { default?: OrtNs };
  const resolved = (mod.InferenceSession ? mod : mod.default) as OrtNs | undefined;
  if (!resolved?.InferenceSession) {
    throw new ModelsMissingError(
      "ONNX InferenceSession missing after load. Rebuild the Dev Client with onnxruntime-react-native linked."
    );
  }
  ort = resolved;
  return ort;
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

async function assertModelFile(path: string, label: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists || (info.size != null && info.size < 50_000)) {
    throw new ModelsMissingError(
      `${label} model missing or empty (${path}). Run: npm run models:fetch then rebuild the app.`
    );
  }
}

function fsPath(uri: string) {
  return uri.replace(/^file:\/\//, "");
}

export async function ensureFaceSessions() {
  if (mockEnabled()) return { mock: true as const };
  if (embedSession && livenessSession) return { mock: false as const };

  await assertModelFile(embedPath(), "MobileFaceNet");
  await assertModelFile(livenessPath(), "Anti-spoof");

  const ORT = loadOrt();
  embedSession = await ORT.InferenceSession.create(fsPath(embedPath()));
  livenessSession = await ORT.InferenceSession.create(fsPath(livenessPath()));
  return { mock: false as const };
}

export async function runEmbedding(inputNchw: Float32Array): Promise<number[]> {
  if (mockEnabled()) return mockEmbedding(Math.abs(inputNchw[10] * 1000) || 42);

  await ensureFaceSessions();
  const ORT = loadOrt();
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
  const ORT = loadOrt();
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

  let liveness: number;
  let spoof: number;
  if (probs.length >= 3) {
    // Upstream Silent-Face MiniFASNet training labels: [fake, real, fake]
    // (HF card saying [live,print,replay] contradicts bit-equivalent upstream).
    const asSilent = {
      liveness: probs[1] ?? 0,
      spoof: (probs[0] ?? 0) + (probs[2] ?? 0),
    };
    // Alternate HF-card order: [live, print, replay]
    const asHf = {
      liveness: probs[0] ?? 0,
      spoof: (probs[1] ?? 0) + (probs[2] ?? 0),
    };
    // ponytail: pick the reading that maximizes live — log raw to calibrate later
    if (asSilent.liveness >= asHf.liveness) {
      liveness = asSilent.liveness;
      spoof = asSilent.spoof;
    } else {
      liveness = asHf.liveness;
      spoof = asHf.spoof;
    }
  } else if (probs.length >= 2) {
    // 2-class: [spoof, live]
    spoof = probs[0] ?? 0;
    liveness = probs[1] ?? 0;
  } else {
    liveness = probs[0] ?? 0;
    spoof = 1 - liveness;
  }

  return { liveness, spoof, raw: probs };
}

export { embedPath, livenessPath, modelsDir };
