/**
 * Vision Camera (v5) + ML Kit face detector.
 *
 * Why ML Kit (react-native-vision-camera-face-detector) over MediaPipe:
 * - Landmarks + eye-open probs + yaw are enough for blink / head-turn challenges
 * - Officially targets VisionCamera ≥5 with Nitro modules (matches our stack)
 * - Smaller Expo prebuild surface than MediaPipe Face Mesh
 *
 * ONNX embed/liveness runs after capture on the ORT thread — not inside the
 * face-detector worklet (onnxruntime-react-native has no worklet binding).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useCameraDevice, useCameraPermission, usePhotoOutput } from "react-native-vision-camera";
import {
  Camera,
  type Face,
} from "react-native-vision-camera-face-detector";
import { Button } from "@/components/ui/Button";
import { colors } from "@/constants/theme";
import type { DetectedFace } from "@/services/face/pipeline";
import {
  challengePrompt,
  maybePickChallenge,
  verifyChallenge,
  type ChallengeKind,
} from "@/services/face/challenge";
import { logFaceScores } from "@/services/face/thresholds";

type Props = {
  mode: "enroll" | "checkin";
  onCaptured: (result: {
    uri: string;
    face: DetectedFace;
    challenge: ChallengeKind;
  }) => void;
  onCancel?: () => void;
  enableChallenge?: boolean;
  busy?: boolean;
  captureLabel?: string;
};

function mapFace(face: Face): DetectedFace {
  const bounds = face.bounds;
  const landmarks = face.landmarks;
  let eyes: DetectedFace["eyes"];
  if (landmarks?.LEFT_EYE && landmarks?.RIGHT_EYE) {
    eyes = {
      left: { x: landmarks.LEFT_EYE.x, y: landmarks.LEFT_EYE.y },
      right: { x: landmarks.RIGHT_EYE.x, y: landmarks.RIGHT_EYE.y },
    };
  }
  return {
    box: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
    eyes,
    landmarks: {
      leftEyeOpenProb: face.leftEyeOpenProbability,
      rightEyeOpenProb: face.rightEyeOpenProbability,
      yaw: face.yawAngle,
    },
  };
}

export function FaceCaptureCamera({
  mode,
  onCaptured,
  onCancel,
  enableChallenge = false,
  busy,
  captureLabel = "Capture",
}: Props) {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({});
  const latestFace = useRef<DetectedFace | null>(null);
  const samplesRef = useRef<
    {
      leftEyeOpenProb?: number;
      rightEyeOpenProb?: number;
      yaw?: number;
      at: number;
    }[]
  >([]);

  const [faceCount, setFaceCount] = useState(0);
  const [challenge, setChallenge] = useState<ChallengeKind>(null);
  const [challengeOk, setChallengeOk] = useState(!enableChallenge);
  const [hint, setHint] = useState("Position your face in the frame");

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (enableChallenge && mode === "checkin") {
      const c = maybePickChallenge();
      setChallenge(c);
      setChallengeOk(!c);
      if (c) setHint(challengePrompt(c) ?? "");
    }
  }, [enableChallenge, mode]);

  const onFacesDetected = useCallback(
    (faces: Face[]) => {
      setFaceCount(faces.length);
      if (!faces.length) {
        latestFace.current = null;
        return;
      }
      const f = faces[0];
      const detected = mapFace(f);
      latestFace.current = detected;
      samplesRef.current.push({
        leftEyeOpenProb: f.leftEyeOpenProbability,
        rightEyeOpenProb: f.rightEyeOpenProbability,
        yaw: f.yawAngle,
        at: Date.now(),
      });
      if (samplesRef.current.length > 30) samplesRef.current.shift();

      if (challenge && !challengeOk) {
        const ok = verifyChallenge(challenge, samplesRef.current);
        if (ok) {
          setChallengeOk(true);
          setHint("Challenge passed — hold still and capture");
          logFaceScores({ outcome: "challenge_pass", challenge });
        }
      }
    },
    [challenge, challengeOk]
  );

  async function capture() {
    if (faceCount < 1 || !latestFace.current) {
      setHint("No face detected");
      return;
    }
    if (challenge && !challengeOk) {
      setHint(challengePrompt(challenge) ?? "Complete the challenge first");
      return;
    }
    try {
      const photoFile = await photoOutput.capturePhotoToFile(
        { flashMode: "off" },
        {}
      );
      const path = (photoFile as { path?: string; uri?: string }).path
        ?? (photoFile as { uri?: string }).uri;
      if (!path) throw new Error("Photo capture returned no path");
      const uri = path.startsWith("file://") ? path : `file://${path}`;
      onCaptured({ uri, face: latestFace.current, challenge });
    } catch (e: unknown) {
      setHint(e instanceof Error ? e.message : "Capture failed");
    }
  }

  if (!hasPermission) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.text}>Camera permission required</Text>
        <Button title="Grant Camera" onPress={() => void requestPermission()} />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.text}>No front camera found</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        outputs={[photoOutput]}
        performanceMode="fast"
        runLandmarks
        runClassifications
        onFacesDetected={onFacesDetected}
        onError={(err) => setHint(err?.message ?? "Camera error")}
      />
      <View style={styles.overlay}>
        <Text style={styles.hint}>{hint}</Text>
        <Text style={styles.meta}>
          Faces: {faceCount}
          {challenge ? ` · Challenge: ${challenge}` : ""}
          {challengeOk && challenge ? " ✓" : ""}
        </Text>
        <Button
          title={captureLabel}
          loading={busy}
          onPress={() => void capture()}
          style={{ marginTop: 10 }}
        />
        {!!onCancel && (
          <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ marginTop: 8 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 360, borderRadius: 14, overflow: "hidden", backgroundColor: "#000" },
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
  },
  hint: { color: colors.text, fontWeight: "700", textAlign: "center" },
  meta: { color: colors.textMuted, textAlign: "center", marginTop: 4, fontSize: 12 },
  fallback: {
    height: 200,
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  text: { color: colors.text, marginBottom: 12, textAlign: "center" },
});
