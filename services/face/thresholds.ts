/**
 * Attendance face thresholds — tuned for on-device MobileFaceNet + MiniFASNet.
 * Not a mathematical guarantee of zero FAR; rejects spoof/low-quality aggressively.
 */
export const FACE_THRESHOLDS = {
  /** Cosine vs enrolled embedding (L2-normalized). */
  cosineSimilarityMin: 0.52,

  /**
   * Each enroll vector must be this close to the provisional mean (not pairwise).
   * Lower than old pairwise gate so left/right angles can contribute.
   */
  enrollmentConsistencyMin: 0.32,

  /** MiniFASNet live-class probability after softmax (check-in, no challenge). */
  livenessMin: 0.55,

  /** Reject if spoof class is this high (check-in, no challenge). */
  spoofMax: 0.5,

  /** After blink/head challenge — ONNX is secondary. */
  livenessMinWithChallenge: 0.4,
  spoofMaxWithChallenge: 0.65,

  /** Enrollment: softer ONNX floor — oval framing + consistency still required. */
  enrollmentLivenessMin: 0.45,
  enrollmentSpoofMax: 0.55,

  /** Failed match attempts before flagged PIN override. */
  maxMatchRetries: 2,

  /** Check-in always requires an active challenge (blink or head turn). */
  checkInChallengeRequired: true,

  /** Enrollment: no blink UI — ONNX liveness on each shot. */
  enrollmentChallengeOnFirstShot: false,

  /** Soft “far from zone” multiplier for client warning. */
  farWarningMultiplier: 3,

  /** ERP embedding contract. */
  embeddingDim: 512,

  /** Multi-angle enrollment captures (averaged into one 512-d template). */
  enrollmentShots: 12,

  /** Preview quality */
  minFaceAreaRatio: 0.08,
  minFacePx: 100,
  maxCenterOffset: 0.28,
  maxYawDeg: 32,
  maxPitchDeg: 28,
  minEyeOpenForCapture: 0.25,
  minBrightness: 35,
  maxBrightness: 235,
} as const;

export type FaceScoreLog = {
  at: string;
  cosine?: number;
  liveness?: number;
  spoof?: number;
  challenge?: string | null;
  outcome: string;
};

const scoreLog: FaceScoreLog[] = [];

export function logFaceScores(entry: Omit<FaceScoreLog, "at">) {
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
    console.log("[face]", JSON.stringify(row));
  }
  return row;
}

export function getFaceScoreLog() {
  return [...scoreLog];
}

/** ERP / HR screens expect 0–100 style match scores. */
export function matchScoreForErp(cosine: number) {
  return Math.round(Math.max(0, Math.min(1, cosine)) * 1000) / 10;
}
