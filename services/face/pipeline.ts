import {
  alignFaceToNchw,
  cropAndResize,
  loadJpegRgb,
  type FaceBox,
} from "@/services/face/imagePrep";
import { runEmbedding, runLiveness, ensureFaceSessions } from "@/services/face/onnxSessions";
import { FACE_THRESHOLDS, logFaceScores } from "@/services/face/thresholds";
import { cosineSimilarity } from "@/services/face/math";

export type DetectedFace = {
  box: FaceBox;
  eyes?: { left: { x: number; y: number }; right: { x: number; y: number } };
  /** Landmark-derived metrics for active challenges */
  landmarks?: {
    leftEyeOpenProb?: number;
    rightEyeOpenProb?: number;
    yaw?: number;
  };
};

export type CheckInFaceResult =
  | {
      ok: true;
      faceMatchScore: number;
      livenessScore: number;
      embedding: number[];
    }
  | {
      ok: false;
      reason: "no_face" | "spoof" | "low_match" | "models" | "error";
      message: string;
      faceMatchScore?: number;
      livenessScore?: number;
    };

export async function warmFaceModels() {
  return ensureFaceSessions();
}

export async function embedFromPhoto(
  photoUri: string,
  face: DetectedFace
): Promise<number[]> {
  const img = await loadJpegRgb(photoUri);
  const nchw = alignFaceToNchw(img, face.box, face.eyes, 112);
  return runEmbedding(nchw);
}

export async function livenessFromPhoto(
  photoUri: string,
  face: DetectedFace
): Promise<{ liveness: number; spoof: number }> {
  const img = await loadJpegRgb(photoUri);
  // MiniFASNet commonly 80×80
  const nchw = cropAndResize(img, face.box, 80, 0.1);
  return runLiveness(nchw);
}

export async function evaluateCheckInFace(opts: {
  photoUri: string;
  face: DetectedFace | null;
  enrolledEmbedding: number[];
}): Promise<CheckInFaceResult> {
  try {
    if (!opts.face) {
      logFaceScores({ outcome: "no_face" });
      return { ok: false, reason: "no_face", message: "No face detected. Center your face and retry." };
    }

    const live = await livenessFromPhoto(opts.photoUri, opts.face);
    logFaceScores({
      outcome: "liveness_raw",
      liveness: live.liveness,
      spoof: live.spoof,
    });

    if (live.liveness < FACE_THRESHOLDS.livenessMin) {
      logFaceScores({
        outcome: "spoof_reject",
        liveness: live.liveness,
        spoof: live.spoof,
      });
      return {
        ok: false,
        reason: "spoof",
        message: `Liveness check failed (score ${live.liveness.toFixed(3)}). Use a live face — not a photo or screen.`,
        livenessScore: live.liveness,
      };
    }

    const embedding = await embedFromPhoto(opts.photoUri, opts.face);
    const cosine = cosineSimilarity(embedding, opts.enrolledEmbedding);
    logFaceScores({
      outcome: "match_raw",
      cosine,
      liveness: live.liveness,
    });

    if (cosine < FACE_THRESHOLDS.cosineSimilarityMin) {
      return {
        ok: false,
        reason: "low_match",
        message: `Face match too low (${cosine.toFixed(3)}). Retry with better lighting.`,
        faceMatchScore: cosine,
        livenessScore: live.liveness,
      };
    }

    logFaceScores({
      outcome: "accept",
      cosine,
      liveness: live.liveness,
    });

    return {
      ok: true,
      faceMatchScore: cosine,
      livenessScore: live.liveness,
      embedding,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Face pipeline error";
    logFaceScores({ outcome: "error" });
    return {
      ok: false,
      reason: msg.includes("onnx") || msg.includes("Missing ONNX") ? "models" : "error",
      message: msg,
    };
  }
}

/** Average several enrollment embeddings from photos. */
export async function buildEnrollmentEmbedding(
  shots: { uri: string; face: DetectedFace }[]
): Promise<number[]> {
  const { averageEmbeddings } = await import("@/services/face/math");
  const vectors: number[][] = [];
  for (const shot of shots) {
    vectors.push(await embedFromPhoto(shot.uri, shot.face));
  }
  return averageEmbeddings(vectors);
}
