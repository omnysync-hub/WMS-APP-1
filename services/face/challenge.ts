import { FACE_THRESHOLDS } from "@/services/face/thresholds";

export type ChallengeKind = "blink" | "turn_head" | null;

export function maybePickChallenge(): ChallengeKind {
  if (Math.random() > FACE_THRESHOLDS.challengeProbability) return null;
  return Math.random() < 0.5 ? "blink" : "turn_head";
}

export function challengePrompt(kind: ChallengeKind): string | null {
  if (kind === "blink") return "Blink both eyes now";
  if (kind === "turn_head") return "Turn your head slightly left, then center";
  return null;
}

type LandmarkSample = {
  leftEyeOpenProb?: number;
  rightEyeOpenProb?: number;
  yaw?: number;
  at: number;
};

/**
 * Verify active challenge using ML Kit landmark samples over ~1–1.5s.
 * Blink: eye-open prob dips then recovers. Turn: yaw delta exceeds threshold.
 */
export function verifyChallenge(
  kind: ChallengeKind,
  samples: LandmarkSample[]
): boolean {
  if (!kind) return true;
  if (samples.length < 4) return false;

  if (kind === "blink") {
    const opens = samples.map(
      (s) => ((s.leftEyeOpenProb ?? 1) + (s.rightEyeOpenProb ?? 1)) / 2
    );
    const min = Math.min(...opens);
    const max = Math.max(...opens);
    // Closed then open
    return min < 0.35 && max > 0.6;
  }

  if (kind === "turn_head") {
    const yaws = samples.map((s) => s.yaw ?? 0);
    const span = Math.max(...yaws) - Math.min(...yaws);
    return Math.abs(span) > 8; // degrees-ish from ML Kit
  }

  return false;
}
