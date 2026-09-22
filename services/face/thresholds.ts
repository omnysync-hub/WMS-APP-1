/**
 * PILOT THRESHOLDS — conservative defaults for logging & soft gates.
 * Do NOT treat as production finals. Recalibrate after a 5–10 employee
 * office pilot with real lighting / glasses / spoof attempts.
 *
 * Ask product/HR before locking these numbers.
 */
export const FACE_THRESHOLDS = {
  /** Cosine similarity vs enrolled embedding. Start ~0.65 (ArcFace-ish scale). */
  cosineSimilarityMin: 0.65,

  /**
   * Model-dependent liveness score (higher = more live).
   * Silent-Face MiniFASNet: use real-class probability after softmax.
   */
  livenessMin: 0.80,

  /** Max failed match attempts before PIN/manual fallback flagged for HR. */
  maxMatchRetries: 2,

  /** Randomized active challenge (blink / head turn) rate. */
  challengeProbability: 0.18,

  /** Soft “far from zone” multiplier (phase 1, unchanged). */
  farWarningMultiplier: 3,

  /** Expected MobileFaceNet / ArcFace embedding size (ERP contract). */
  embeddingDim: 512,

  /** Enrollment captures required. */
  enrollmentShots: 4,
} as const;

export type FaceScoreLog = {
  at: string;
  cosine?: number;
  liveness?: number;
  spoof?: number;
  challenge?: string | null;
  outcome: string;
};

/** In-memory ring for pilot calibration — scores only, never embeddings. */
const scoreLog: FaceScoreLog[] = [];

export function logFaceScores(entry: Omit<FaceScoreLog, "at">) {
  // Explicit allow-list — never accept or forward embedding vectors
  const row: FaceScoreLog = {
    at: new Date().toISOString(),
    outcome: entry.outcome,
    ...(entry.cosine != null ? { cosine: entry.cosine } : {}),
    ...(entry.liveness != null ? { liveness: entry.liveness } : {}),
    ...(entry.spoof != null ? { spoof: entry.spoof } : {}),
    ...(entry.challenge != null ? { challenge: entry.challenge } : {}),
  };
  scoreLog.push(row);
  if (scoreLog.length > 200) scoreLog.shift();
  if (__DEV__) {
    console.log("[face-pilot]", JSON.stringify(row));
  }
  return row;
}

export function getFaceScoreLog() {
  return [...scoreLog];
}
