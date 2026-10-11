export type ChallengeKind = "blink" | "turn_head" | "smile" | null;

import { FACE_THRESHOLDS } from "@/services/face/thresholds";

/** Always pick a challenge for check-in; enroll prefers blink. */
export function pickChallenge(mode: "checkin" | "enroll" | "optional"): ChallengeKind {
  if (mode === "enroll" && FACE_THRESHOLDS.enrollmentChallengeOnFirstShot) {
    return "blink";
  }
  if (mode === "checkin" && FACE_THRESHOLDS.checkInChallengeRequired) {
    return Math.random() < 0.5 ? "blink" : "turn_head";
  }
  return Math.random() < 0.5 ? "blink" : "turn_head";
}

/** @deprecated use pickChallenge */
export function maybePickChallenge(): ChallengeKind {
  return pickChallenge("optional");
}

export function challengePrompt(kind: ChallengeKind): string | null {
  if (kind === "blink") return "Blink both eyes (a few times if needed)";
  if (kind === "turn_head") return "Turn your head left, then look forward";
  if (kind === "smile") return "Smile clearly at the camera";
  return null;
}

export type LandmarkSample = {
  leftEyeOpenProb?: number;
  rightEyeOpenProb?: number;
  smilingProb?: number;
  yaw?: number;
  at: number;
};

function eyeOpenAvg(s: LandmarkSample): number | null {
  const l = s.leftEyeOpenProb;
  const r = s.rightEyeOpenProb;
  if (l == null && r == null) return null;
  if (l == null) return r as number;
  if (r == null) return l;
  return (l + r) / 2;
}

/**
 * Blink: ML Kit often never goes below ~0.5, so detect a relative dip
 * (open → more closed → open) rather than a hard closed threshold.
 */
export function verifyChallenge(
  kind: ChallengeKind,
  samples: LandmarkSample[]
): boolean {
  if (!kind) return true;
  const recent = samples.filter((s) => Date.now() - s.at < 3000);
  if (recent.length < 3) return false;

  if (kind === "blink") {
    const opens = recent.map(eyeOpenAvg).filter((v): v is number => v != null);
    if (opens.length < 3) return false;

    const min = Math.min(...opens);
    const max = Math.max(...opens);
    const span = max - min;

    // Relative blink (works when device never reports near-0)
    if (span >= 0.12 && max >= 0.35) return true;
    // Classic hard close
    if (min <= 0.55 && max >= 0.65) return true;
    // Single-eye blink
    const lefts = recent.map((s) => s.leftEyeOpenProb).filter((v): v is number => v != null);
    const rights = recent.map((s) => s.rightEyeOpenProb).filter((v): v is number => v != null);
    if (lefts.length >= 3) {
      const ls = Math.max(...lefts) - Math.min(...lefts);
      if (ls >= 0.14) return true;
    }
    if (rights.length >= 3) {
      const rs = Math.max(...rights) - Math.min(...rights);
      if (rs >= 0.14) return true;
    }
    return false;
  }

  if (kind === "turn_head") {
    const yaws = recent.map((s) => s.yaw ?? 0);
    const span = Math.max(...yaws) - Math.min(...yaws);
    return Math.abs(span) > 8;
  }

  if (kind === "smile") {
    const smiles = recent
      .map((s) => s.smilingProb)
      .filter((v): v is number => v != null);
    if (smiles.length < 2) return false;
    return Math.max(...smiles) >= 0.45;
  }

  return false;
}

/** True when ML Kit is actually returning eye classification numbers. */
export function hasEyeClassifications(samples: LandmarkSample[]): boolean {
  const recent = samples.filter((s) => Date.now() - s.at < 2000);
  return recent.some(
    (s) => s.leftEyeOpenProb != null || s.rightEyeOpenProb != null
  );
}

export function latestEyeOpenLabel(samples: LandmarkSample[]): string | null {
  for (let i = samples.length - 1; i >= 0; i--) {
    const v = eyeOpenAvg(samples[i]);
    if (v != null) return v.toFixed(2);
  }
  return null;
}
