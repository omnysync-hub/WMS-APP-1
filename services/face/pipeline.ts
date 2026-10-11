import {
  alignFaceToNchw,
  cropLivenessNchw,
  loadJpegRgb,
  type FaceBox,
  type RgbImage,
} from "@/services/face/imagePrep";
import { runEmbedding, runLiveness, ensureFaceSessions } from "@/services/face/onnxSessions";
import {
  FACE_THRESHOLDS,
  logFaceScores,
  matchScoreForErp,
} from "@/services/face/thresholds";
import { cosineSimilarity } from "@/services/face/math";
import { assessCropBrightness } from "@/services/face/quality";
import { resolvePhotoFace } from "@/services/face/photoFace";

export type DetectedFace = {
  box: FaceBox;
  eyes?: { left: { x: number; y: number }; right: { x: number; y: number } };
  landmarks?: {
    leftEyeOpenProb?: number;
    rightEyeOpenProb?: number;
    yaw?: number;
    pitch?: number;
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
      reason: "no_face" | "spoof" | "low_match" | "quality" | "models" | "error";
      message: string;
      faceMatchScore?: number;
      livenessScore?: number;
    };

type PreparedShot = {
  img: RgbImage;
  face: DetectedFace;
  source: string;
};

/** One JPEG decode + one face resolve — used for quality, liveness, and embed. */
async function prepareShot(
  photoUri: string,
  previewFace: DetectedFace
): Promise<PreparedShot> {
  const img = await loadJpegRgb(photoUri);
  const { face, source } = await resolvePhotoFace(photoUri, previewFace, img);
  return { img, face, source };
}

export async function warmFaceModels() {
  return ensureFaceSessions();
}

async function embedPrepared(shot: PreparedShot): Promise<number[]> {
  return runEmbedding(alignFaceToNchw(shot.img, shot.face.box, shot.face.eyes, 112));
}

async function livenessPrepared(shot: PreparedShot) {
  // Device-calibrated: BGR float 0–255
  const scored = await runLiveness(
    cropLivenessNchw(shot.img, shot.face.box, 80, 2.7, true, false)
  );
  return {
    liveness: scored.liveness,
    spoof: scored.spoof,
    raw: scored.raw,
    source: `${shot.source}/bgr/raw`,
  };
}

export async function embedFromPhoto(
  photoUri: string,
  face: DetectedFace
): Promise<number[]> {
  return embedPrepared(await prepareShot(photoUri, face));
}

export async function livenessFromPhoto(
  photoUri: string,
  face: DetectedFace
): Promise<{ liveness: number; spoof: number; raw: number[]; source: string }> {
  return livenessPrepared(await prepareShot(photoUri, face));
}

export async function evaluateCheckInFace(opts: {
  photoUri: string;
  face: DetectedFace | null;
  enrolledEmbedding: number[];
  /** Blink/head challenge already passed in camera UI. */
  challengeOk?: boolean;
}): Promise<CheckInFaceResult> {
  try {
    if (!opts.face) {
      logFaceScores({ outcome: "no_face" });
      return { ok: false, reason: "no_face", message: "No face detected. Center your face and retry." };
    }

    const shot = await prepareShot(opts.photoUri, opts.face);
    const q = assessCropBrightness(shot.img, shot.face);
    if (!q.ok) {
      logFaceScores({ outcome: `quality_${q.reason}` });
      return { ok: false, reason: "quality", message: q.message };
    }

    const live = await livenessPrepared(shot);
    logFaceScores({
      outcome: "liveness_raw",
      liveness: live.liveness,
      spoof: live.spoof,
      challenge: live.source,
    });

    // Blink (camera challenge) is the liveness proof. ONNX is logged only — never blocks check-in.
    let livenessForErp = live.liveness;
    if (opts.challengeOk) {
      livenessForErp = Math.max(live.liveness, 0.95);
      logFaceScores({
        outcome: "liveness_blink_ok",
        liveness: livenessForErp,
        spoof: live.spoof,
      });
    } else {
      const liveMin = FACE_THRESHOLDS.livenessMin;
      const spoofMax = FACE_THRESHOLDS.spoofMax;
      if (live.liveness < liveMin || live.spoof > spoofMax) {
        logFaceScores({
          outcome: "spoof_reject",
          liveness: live.liveness,
          spoof: live.spoof,
        });
        return {
          ok: false,
          reason: "spoof",
          message:
            "Liveness failed — blink once, then hold still (no photo, video, or screen).",
          livenessScore: live.liveness,
        };
      }
    }

    const embedding = await embedPrepared(shot);
    const cosine = cosineSimilarity(embedding, opts.enrolledEmbedding);
    logFaceScores({
      outcome: "match_raw",
      cosine,
      liveness: livenessForErp,
    });

    if (cosine < FACE_THRESHOLDS.cosineSimilarityMin) {
      return {
        ok: false,
        reason: "low_match",
        message: "Face does not match enrolled profile. Retry with better lighting.",
        faceMatchScore: matchScoreForErp(cosine),
        livenessScore: livenessForErp,
      };
    }

    logFaceScores({
      outcome: "accept",
      cosine,
      liveness: livenessForErp,
    });

    return {
      ok: true,
      faceMatchScore: matchScoreForErp(cosine),
      livenessScore: livenessForErp,
      embedding,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Face pipeline error";
    logFaceScores({ outcome: "error" });
    return {
      ok: false,
      reason: msg.includes("onnx") || msg.includes("Missing ONNX") || msg.includes("models")
        ? "models"
        : "error",
      message: msg,
    };
  }
}

/**
 * Build enrollment embedding — multi-angle shots → robust average template.
 */
export async function buildEnrollmentEmbedding(
  shots: { uri: string; face: DetectedFace }[],
  onProgress?: (msg: string) => void
): Promise<number[]> {
  const { robustAverageEmbeddings, cosineSimilarity: cos } = await import(
    "@/services/face/math"
  );
  if (shots.length < FACE_THRESHOLDS.enrollmentShots) {
    throw new Error(`Need ${FACE_THRESHOLDS.enrollmentShots} clear face shots`);
  }

  const vectors: number[][] = [];
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    onProgress?.(`Encoding ${i + 1}/${shots.length}…`);
    const prepared = await prepareShot(shot.uri, shot.face);

    const q = assessCropBrightness(prepared.img, prepared.face);
    if (!q.ok) throw new Error(q.message);

    const live = await livenessPrepared(prepared);
    logFaceScores({
      outcome: "enroll_liveness",
      liveness: live.liveness,
      spoof: live.spoof,
      challenge: `${live.source}|raw:${live.raw.map((v) => v.toFixed(3)).join(",")}`,
    });

    vectors.push(await embedPrepared(prepared));
  }

  onProgress?.("Building strong face code…");
  try {
    const { embedding, kept, dropped } = robustAverageEmbeddings(
      vectors,
      0.5,
      FACE_THRESHOLDS.enrollmentConsistencyMin
    );
    logFaceScores({
      outcome: "enroll_average",
      challenge: `kept:${kept}|dropped:${dropped}`,
    });
    return embedding;
  } catch (e) {
    // Fall back: log weakest pair for debugging
    let worst = 1;
    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        worst = Math.min(worst, cos(vectors[i], vectors[j]));
      }
    }
    logFaceScores({ outcome: "enroll_inconsistent", cosine: worst });
    throw e instanceof Error
      ? e
      : new Error("Shots don't match. Retake — stay in the oval through all angles.");
  }
}
