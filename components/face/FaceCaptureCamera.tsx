/**
 * Production face capture — one stable camera session, countdown shutter, no remount jank.
 *
 * Enroll: face in frame → short hold → auto shutter (ONNX liveness later).
 * Check-in: optional blink, then same hold → shutter.
 *
 * Critical: VisionCamera requires memoized `outputs`. Recreating them on each
 * status re-render tears down ImageCapture → "Camera is closed".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from "react-native-vision-camera";
import { createFaceDetectorOutput, type Face } from "react-native-vision-camera-face-detector";
import { Button } from "@/components/ui/Button";
import { colors } from "@/constants/theme";
import type { DetectedFace } from "@/services/face/pipeline";
import {
  latestEyeOpenLabel,
  verifyChallenge,
  type ChallengeKind,
  type LandmarkSample,
} from "@/services/face/challenge";
import { logFaceScores } from "@/services/face/thresholds";
import { haptic } from "@/lib/haptics";

export type FaceCaptureResult = {
  uri: string;
  face: DetectedFace;
  challenge: ChallengeKind;
};

type Props = {
  mode: "enroll" | "checkin";
  onCaptured: (result: FaceCaptureResult) => void;
  onCancel?: () => void;
  busy?: boolean;
  /** 0-based shot index (enrollment multi-shot). Changing this re-arms the shutter. */
  shotIndex?: number;
  shotTotal?: number;
  /** Blink once before hold (check-in). Off for enroll — smooth + ONNX covers spoof. */
  enableBlinkChallenge?: boolean;
  captureLabel?: string;
};

const HOLD_MS = 550;
/** Pause after each shot so the user sees feedback before the next auto-shutter. */
const BETWEEN_SHOT_MS = 700;
const CAPTURE_SETTINGS = { flashMode: "off" as const, enableShutterSound: false };
// Quality is set on usePhotoOutput — keep modest for faster JPEG decode.

/** Cycle through angles — index wraps so 12+ shots still get variety. */
const ENROLL_POSES = [
  "Look straight at the camera",
  "Turn a little left",
  "Turn a little right",
  "Look straight — chin slightly up",
  "Look straight — chin slightly down",
  "Turn left again — hold still",
  "Turn right again — hold still",
  "Look straight — closer to the oval",
  "Slight left — eyes open",
  "Slight right — eyes open",
  "Look straight — relax",
  "Last angles — look straight",
];

function poseHint(index: number, total: number): string {
  if (total <= 1) return "Center your face — hold still";
  return ENROLL_POSES[index % ENROLL_POSES.length] ?? "Hold still";
}

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
      pitch: face.pitchAngle,
    },
  };
}

function toFileUri(path: string): string {
  return path.startsWith("file://") ? path : `file://${path}`;
}

export function FaceCaptureCamera({
  mode,
  onCaptured,
  onCancel,
  busy = false,
  shotIndex = 0,
  shotTotal = 1,
  enableBlinkChallenge,
  captureLabel,
}: Props) {
  const wantBlink = enableBlinkChallenge ?? mode === "checkin";
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({
    containerFormat: "jpeg",
    qualityPrioritization: "speed",
    quality: 0.6,
  });

  const latestFace = useRef<DetectedFace | null>(null);
  const samplesRef = useRef<LandmarkSample[]>([]);
  const blinkOkRef = useRef(!wantBlink);
  const shutterLock = useRef(false);
  const faceSinceRef = useRef<number | null>(null);
  const lastStatusRef = useRef("");
  const sessionReady = useRef(false);
  const onFacesRef = useRef<(faces: Face[]) => void>(() => {});
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;

  const [faceOk, setFaceOk] = useState(false);
  const [blinkOk, setBlinkOk] = useState(!wantBlink);
  const [status, setStatus] = useState(poseHint(shotIndex, shotTotal));
  const [phase, setPhase] = useState<"seek" | "blink" | "hold" | "done">("seek");
  const [capturing, setCapturing] = useState(false);
  const [eyeLabel, setEyeLabel] = useState<string | null>(null);

  const faceOutput = useMemo(
    () =>
      createFaceDetectorOutput({
        performanceMode: "fast",
        runLandmarks: true,
        runClassifications: true,
        trackingEnabled: true,
        outputResolution: "preview",
        onFacesDetected: (faces) => onFacesRef.current(faces),
        onError: (err) => {
          if (__DEV__) console.warn("[face] detect", err);
        },
      }),
    []
  );

  const outputs = useMemo(() => [faceOutput, photoOutput], [faceOutput, photoOutput]);

  useEffect(() => {
    void photoOutput.prepareSettings([CAPTURE_SETTINGS]).catch(() => {});
  }, [photoOutput]);

  const setStatusSafe = (s: string) => {
    if (lastStatusRef.current === s) return;
    lastStatusRef.current = s;
    setStatus(s);
  };

  const clearHold = () => {
    faceSinceRef.current = null;
  };

  const armSession = useCallback(() => {
    clearHold();
    shutterLock.current = false;
    setCapturing(false);
    samplesRef.current = [];
    latestFace.current = null;
    blinkOkRef.current = !wantBlink;
    setBlinkOk(!wantBlink);
    setFaceOk(false);
    setPhase(wantBlink ? "blink" : "seek");
    lastStatusRef.current = "";
    const hint = poseHint(shotIndex, shotTotal);
    setStatusSafe(
      wantBlink
        ? "Blink once, then hold still"
        : shotTotal > 1
          ? `Photo ${shotIndex + 1} of ${shotTotal}: ${hint}`
          : hint
    );
    setEyeLabel(null);
  }, [wantBlink, shotIndex, shotTotal]);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    armSession();
  }, [shotIndex, armSession]);

  const takePhoto = useCallback(async () => {
    if (shutterLock.current || busy) return;
    if (!sessionReady.current) {
      setStatusSafe("Camera warming up…");
      return;
    }
    if (!latestFace.current) {
      setStatusSafe("No face — center yourself");
      return;
    }
    if (wantBlink && !blinkOkRef.current) {
      setStatusSafe("Blink once first");
      return;
    }

    shutterLock.current = true;
    clearHold();
    setCapturing(true);
    setStatusSafe("Capturing…");
    void haptic.press();

    try {
      const photo = await photoOutput.capturePhoto(CAPTURE_SETTINGS, {});
      let path: string;
      try {
        path = await photo.saveToTemporaryFileAsync();
      } finally {
        photo.dispose();
      }
      if (!path) throw new Error("save_failed");
      const uri = toFileUri(path);
      const face = latestFace.current;
      const isLast = shotIndex + 1 >= shotTotal;

      setCapturing(false);
      setPhase("done");
      setStatusSafe(
        isLast
          ? `All ${shotTotal} photos done — saving…`
          : `Photo ${shotIndex + 1} of ${shotTotal} ✓ — ${poseHint(shotIndex + 1, shotTotal)}`
      );
      void haptic.success();
      logFaceScores({
        outcome: "capture_ok",
        challenge: wantBlink ? "blink" : null,
      });

      // Stay locked until parent advances shotIndex (or unmounts on last shot).
      // Unlocking here caused endless re-capture with a stale onShot closure.
      setTimeout(() => {
        onCapturedRef.current({
          uri,
          face,
          challenge: wantBlink ? "blink" : null,
        });
      }, isLast ? 400 : BETWEEN_SHOT_MS);
    } catch (e: unknown) {
      shutterLock.current = false;
      setCapturing(false);
      setPhase(blinkOkRef.current ? "seek" : "blink");
      const msg = e instanceof Error ? e.message : String(e);
      setStatusSafe(
        /closed/i.test(msg)
          ? "Camera busy — hold still again"
          : /save_failed|path|file/i.test(msg)
            ? "Couldn't save — tap Capture"
            : "Capture failed — tap Capture"
      );
      void haptic.error();
      logFaceScores({
        outcome: "capture_fail",
        challenge: msg.slice(0, 120),
      });
    }
  }, [busy, photoOutput, shotIndex, shotTotal, wantBlink]);

  const onFacesDetected = useCallback(
    (faces: Face[]) => {
      if (shutterLock.current || busy || phase === "done") return;

      if (faces.length !== 1) {
        clearHold();
        latestFace.current = null;
        setFaceOk(false);
        setStatusSafe(
          faces.length > 1
            ? "Only one person please"
            : wantBlink && !blinkOkRef.current
              ? "Center face, then blink"
              : poseHint(shotIndex, shotTotal)
        );
        return;
      }

      const f = faces[0];
      const detected = mapFace(f);
      latestFace.current = detected;
      setFaceOk(true);

      samplesRef.current.push({
        leftEyeOpenProb: f.leftEyeOpenProbability,
        rightEyeOpenProb: f.rightEyeOpenProbability,
        smilingProb: f.smilingProbability,
        yaw: f.yawAngle,
        at: Date.now(),
      });
      if (samplesRef.current.length > 36) samplesRef.current.shift();

      const eye = latestEyeOpenLabel(samplesRef.current);
      if (eye) setEyeLabel(eye);

      if (wantBlink && !blinkOkRef.current) {
        setPhase("blink");
        if (verifyChallenge("blink", samplesRef.current)) {
          blinkOkRef.current = true;
          setBlinkOk(true);
          samplesRef.current = [];
          void haptic.success();
          setStatusSafe("Blink OK — hold still");
          setPhase("hold");
          logFaceScores({ outcome: "challenge_pass", challenge: "blink" });
        } else {
          setStatusSafe(eye ? `Blink once  (eyes ${eye})` : "Blink once clearly");
          return;
        }
      }

      if (!faceSinceRef.current) {
        faceSinceRef.current = Date.now();
        setPhase("hold");
        setStatusSafe("Hold still…");
      }

      const held = Date.now() - faceSinceRef.current;
      if (held >= HOLD_MS) {
        void takePhoto();
      } else {
        setStatusSafe("Hold still…");
      }
    },
    [busy, phase, takePhoto, wantBlink, shotIndex, shotTotal]
  );

  onFacesRef.current = onFacesDetected;

  if (!hasPermission) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.text}>Camera permission required</Text>
        <Button title="Allow camera" onPress={() => void requestPermission()} />
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

  const label =
    captureLabel ??
    (shotTotal > 1 ? `Photo ${shotIndex + 1} of ${shotTotal}` : "Capture");

  const ringColor =
    phase === "done"
      ? colors.success
      : capturing
        ? colors.primary
        : faceOk && blinkOk
          ? colors.success
          : wantBlink && !blinkOk
            ? colors.high
            : colors.primary;

  return (
    <View style={styles.wrap}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={outputs}
        onConfigured={() => {
          sessionReady.current = true;
        }}
        onStopped={() => {
          sessionReady.current = false;
        }}
        onError={(err) => {
          if (__DEV__) console.warn("[face] camera", err);
        }}
      />
      <View style={styles.vignette} pointerEvents="none" />
      <View pointerEvents="none" style={[styles.oval, { borderColor: ringColor }]} />

      <View style={styles.overlay}>
        <Text style={styles.hint}>{status}</Text>
        <Text style={styles.meta}>
          {shotTotal > 1
            ? `Photo ${shotIndex + 1} of ${shotTotal}`
            : mode === "checkin"
              ? "Check-in"
              : "Enroll"}
          {eyeLabel ? ` · eyes ${eyeLabel}` : ""}
          {blinkOk && wantBlink ? " · blink ✓" : ""}
        </Text>

        <Button
          title={capturing || busy || phase === "done" ? "Working…" : label}
          loading={capturing || busy || phase === "done"}
          disabled={busy || capturing || phase === "done" || !faceOk}
          onPress={() => void takePhoto()}
          style={{ marginTop: 12 }}
        />
        {!!onCancel && (
          <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ marginTop: 8 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 460,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  oval: {
    position: "absolute",
    alignSelf: "center",
    top: "11%",
    width: "64%",
    height: "52%",
    borderRadius: 999,
    borderWidth: 3,
  },
  overlay: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
  },
  hint: {
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  meta: {
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    marginTop: 4,
    fontSize: 12,
  },
  fallback: {
    height: 200,
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  text: { color: colors.text, marginBottom: 12, textAlign: "center" },
});
