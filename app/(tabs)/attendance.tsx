import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { GeofenceMapCard } from "@/components/attendance/GeofenceMapCard";
import { PunchLogList } from "@/components/attendance/PunchLogList";
import { FaceCaptureCamera } from "@/components/face/FaceCaptureCamera";
import {
  fetchAttendance,
  fetchGeofenceZones,
  findNearestZone,
  getStableDeviceId,
  submitAttendancePunch,
} from "@/services/attendanceService";
import { evaluateCheckInFace } from "@/services/face/pipeline";
import { hydrateEnrollmentEmbedding } from "@/services/face/enrollmentService";
import { FACE_THRESHOLDS, logFaceScores } from "@/services/face/thresholds";
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { colors, space, type } from "@/constants/theme";
import type { GeofenceZone } from "@/types";
import type { DetectedFace } from "@/services/face/pipeline";

export default function AttendanceScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);
  const qc = useQueryClient();
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const { isOnline } = useNetworkStatus();

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [sessionZones, setSessionZones] = useState<GeofenceZone[] | null>(null);
  const [matchAttempts, setMatchAttempts] = useState(0);
  const [showBackupVerification, setShowBackupVerification] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [processingFace, setProcessingFace] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [lastResultBanner, setLastResultBanner] = useState<{
    kind: "ok" | "flagged" | "pending" | "error";
    title: string;
    detail?: string;
  } | null>(null);

  const captureTimestampRef = useRef<string | null>(null);
  const scoresRef = useRef<{ faceMatchScore: number; livenessScore: number; notes?: string }>({
    faceMatchScore: 0,
    livenessScore: 0,
  });
  const enrolledRef = useRef<number[] | null>(null);

  const refreshLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  }, []);

  const loadZones = useCallback(
    async (force = false) => {
      if (!force && sessionZones !== null) return sessionZones;
      const zones = await fetchGeofenceZones(employee?.id);
      setSessionZones(zones);
      return zones;
    },
    [sessionZones, employee?.id]
  );

  useEffect(() => {
    void refreshLocation();
    setSessionZones(null);
    void loadZones(true).catch(() => {});
    if (employee?.id) {
      void hydrateEnrollmentEmbedding(employee.id).then((emb) => {
        enrolledRef.current = emb;
      });
    }
  }, [refreshLocation, employee?.id]);

  const history = useQuery({
    queryKey: ["attendance", employee?.id],
    enabled: !!employee?.id,
    queryFn: () => fetchAttendance(employee!.id),
  });

  const nearest = useMemo(() => {
    if (!coords || !sessionZones?.length) return null;
    return findNearestZone(coords.lat, coords.lng, sessionZones);
  }, [coords, sessionZones]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id || !coords) throw new Error("Missing employee or GPS");
      const zones = await loadZones();
      const near = findNearestZone(coords.lat, coords.lng, zones);
      const deviceId = await getStableDeviceId();
      const timestamp = new Date().toISOString();
      const { faceMatchScore, livenessScore, notes } = scoresRef.current;
      if (livenessScore == null || Number.isNaN(livenessScore)) {
        throw new Error("Face check incomplete — try again.");
      }

      return submitAttendancePunch({
        employeeId: employee.id,
        geofenceZoneId: near?.zone.id,
        lat: coords.lat,
        lng: coords.lng,
        timestamp,
        faceMatchScore,
        livenessScore: Number(livenessScore),
        deviceId,
        backupPassword: showBackupVerification ? backupPassword : undefined,
        notes:
          notes ??
          (near
            ? `Nearest: ${near.zone.name} (${Math.round(near.distanceM)}m)`
            : "No client geofence match"),
      });
    },
    onSuccess: (result) => {
      setShowCamera(false);
      captureTimestampRef.current = null;
      qc.invalidateQueries({ queryKey: ["attendance"] });

      if (result.queued) {
        setShowBackupVerification(false);
        setBackupPassword("");
        setLastResultBanner({
          kind: "pending",
          title: "Saved on this phone",
          detail: "No network — we’ll send it when you’re back online.",
        });
        return;
      }

      if (result.status === "rejected") {
        const staleHint =
          result.code === "STALE_PAYLOAD"
            ? " Tap Try again soon — the check timed out."
            : "";
        setLastResultBanner({
          kind: "error",
          title: "Check-in didn’t go through",
          detail: `${result.message}${staleHint}`,
        });
        return;
      }

      setShowBackupVerification(false);
      setBackupPassword("");

      if (result.status === "accepted-but-flagged") {
        const zone = result.zoneName ?? nearest?.zone.name ?? "site";
        setLastResultBanner({
          kind: "flagged",
          title: `Checked in at ${zone}`,
          detail: `Office will review: ${result.flagReason ?? result.message}`,
        });
        return;
      }

      const zone = result.zoneName ?? nearest?.zone.name ?? "site";
      setLastResultBanner({
        kind: "ok",
        title: `You’re checked in at ${zone}`,
        detail: result.message || "All set — have a good shift.",
      });
    },
    onError: (e: Error) => {
      setLastResultBanner({
        kind: "error",
        title: "Check-in failed",
        detail: e.message,
      });
    },
  });

  async function openCameraFlow() {
    setLastResultBanner(null);
    if (!coords) {
      setLastResultBanner({
        kind: "error",
        title: "Location needed",
        detail: "Turn on GPS, then try Check in again.",
      });
      await refreshLocation();
      return;
    }

    if (!enrolledRef.current) {
      const emb = employee?.id ? await hydrateEnrollmentEmbedding(employee.id) : null;
      enrolledRef.current = emb;
      if (!emb) {
        Alert.alert("Face not set up", "Take your enrollment photos once, then check in with your face.", [
          { text: "Cancel", style: "cancel" },
          { text: "Set up face", onPress: () => router.push("/enrollment") },
        ]);
        return;
      }
    }

    let zones = sessionZones;
    try {
      zones = await loadZones();
    } catch {
      zones = sessionZones;
    }

    const near =
      coords && zones?.length ? findNearestZone(coords.lat, coords.lng, zones) : null;

    const proceed = () => {
      setMatchAttempts(0);
      setShowBackupVerification(false);
      setShowCamera(true);
    };

    if (
      near &&
      !near.within &&
      near.distanceM > near.zone.radiusMeters * FACE_THRESHOLDS.farWarningMultiplier
    ) {
      Alert.alert(
        "Far from site",
        `You look about ${Math.round(near.distanceM)}m from ${near.zone.name}. Check-in may be flagged.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue anyway", onPress: proceed },
        ]
      );
      return;
    }

    if (near && !near.within) {
      Alert.alert(
        "Away from site",
        `Outside ${near.zone.name} (${Math.round(near.distanceM)}m). You can still try — office may review.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: proceed },
        ]
      );
      return;
    }

    proceed();
  }

  async function onFaceCaptured(uri: string, face: DetectedFace) {
    if (!enrolledRef.current) return;
    setProcessingFace(true);
    captureTimestampRef.current = new Date().toISOString();
    try {
      const result = await evaluateCheckInFace({
        photoUri: uri,
        face,
        enrolledEmbedding: enrolledRef.current,
        challengeOk: true,
      });

      if (!result.ok) {
        if (result.reason === "spoof") {
          setLastResultBanner({
            kind: "error",
            title: "Couldn’t verify live face",
            detail: result.message,
          });
          return;
        }
        if (result.reason === "quality") {
          setLastResultBanner({
            kind: "error",
            title: "Photo unclear",
            detail: result.message,
          });
          return;
        }
        if (result.reason === "models") {
          Alert.alert(
            "Face models missing",
            `${result.message}\n\nAsk IT to run npm run models:fetch and rebuild the app.`
          );
          return;
        }
        if (result.reason === "low_match") {
          const next = matchAttempts + 1;
          setMatchAttempts(next);
          if (next > FACE_THRESHOLDS.maxMatchRetries) {
            setShowCamera(false);
            setShowBackupVerification(true);
            logFaceScores({
              outcome: "password_fallback",
              cosine: result.faceMatchScore,
              liveness: result.livenessScore,
            });
            setLastResultBanner({
              kind: "error",
              title: "Face didn’t match",
              detail: "Use your work password for backup verification. You must be online.",
            });
          } else {
            setLastResultBanner({
              kind: "error",
              title: "Try again",
              detail: `${result.message} (${next}/${FACE_THRESHOLDS.maxMatchRetries})`,
            });
          }
          return;
        }
        setLastResultBanner({
          kind: "error",
          title: "Face check failed",
          detail: result.message,
        });
        return;
      }

      scoresRef.current = {
        faceMatchScore: result.faceMatchScore,
        livenessScore: result.livenessScore,
        notes: `Face match ${result.faceMatchScore.toFixed(3)} · liveness ${result.livenessScore.toFixed(3)}`,
      };
      setShowCamera(false);
      mutation.mutate();
    } finally {
      setProcessingFace(false);
    }
  }

  function submitBackupVerification() {
    if (!isOnline) {
      setLastResultBanner({
        kind: "error",
        title: "Internet needed",
        detail: "Backup verification cannot be saved offline. Connect to the internet and try again.",
      });
      return;
    }
    if (!backupPassword.trim()) {
      setLastResultBanner({
        kind: "error",
        title: "Password needed",
        detail: "Enter the same work password you use to sign in.",
      });
      return;
    }
    captureTimestampRef.current = new Date().toISOString();
    scoresRef.current = {
      faceMatchScore: 0,
      livenessScore: 0,
      notes: "Backup verification used after face match attempts were exhausted",
    };
    logFaceScores({ outcome: "password_fallback_submit" });
    mutation.mutate();
  }

  const bannerTone =
    lastResultBanner?.kind === "ok"
      ? "success"
      : lastResultBanner?.kind === "flagged"
        ? "warn"
        : lastResultBanner?.kind === "pending"
          ? "info"
          : "error";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={history.isRefetching}
          onRefresh={() => {
            void refreshLocation();
            void history.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <ScreenHeader
        title="Check-in"
        subtitle="One tap, then blink once at the camera."
      />

      {!isOnline && (
        <InlineBanner
          title="You’re offline"
          detail={
            pendingCount > 0
              ? `${pendingCount} check-in(s) waiting to sync.`
              : "Check-ins save on this phone until you’re back online."
          }
          tone="warn"
        />
      )}

      {lastResultBanner && (
        <InlineBanner
          title={lastResultBanner.title}
          detail={lastResultBanner.detail}
          tone={bannerTone}
        />
      )}

      {lastResultBanner?.kind === "error" && !showCamera && !showBackupVerification && (
        <Button
          title="Try again"
          onPress={() => void openCameraFlow()}
          style={{ marginBottom: space.lg }}
        />
      )}

      <GeofenceMapCard
        label={
          nearest?.zone.name ??
          (sessionZones?.length === 0
            ? "No assigned site"
            : sessionZones
              ? "No active zones"
              : "Loading sites…")
        }
        distanceM={nearest?.distanceM ?? null}
        radiusM={nearest?.zone.radiusMeters}
      />

      {showCamera ? (
        <View style={{ marginTop: space.lg }}>
          <FaceCaptureCamera
            mode="checkin"
            enableBlinkChallenge
            busy={processingFace || mutation.isPending}
            captureLabel="Verify & check in"
            onCancel={() => setShowCamera(false)}
            onCaptured={({ uri, face }) => void onFaceCaptured(uri, face)}
          />
        </View>
      ) : showBackupVerification ? (
        <Card style={{ marginTop: space.lg }}>
          <Text style={{ color: colors.text, marginBottom: space.sm, ...type.body, fontWeight: "800" }}>
            Backup verification
          </Text>
          <Text style={{ color: colors.textMuted, marginBottom: space.md, ...type.subtitle }}>
            Enter your work password. The office may review this check-in.
          </Text>
          <TextInput
            value={backupPassword}
            onChangeText={setBackupPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Work password"
            placeholderTextColor={colors.textDim}
            accessibilityLabel="Work password for backup verification"
            style={{
              backgroundColor: colors.surfaceElevated,
              color: colors.text,
              borderRadius: 10,
              padding: space.md,
              marginBottom: space.md,
              minHeight: 52,
              fontSize: 17,
            }}
          />
          <Button
            title="Verify & check in"
            loading={mutation.isPending}
            disabled={!isOnline}
            onPress={submitBackupVerification}
          />
        </Card>
      ) : (
        <View style={{ marginTop: space.lg, gap: space.md }}>
          <Button
            title="Check in now"
            loading={mutation.isPending}
            onPress={() => void openCameraFlow()}
            style={{ minHeight: 64 }}
          />
          <Button
            title="Set up face first"
            variant="secondary"
            onPress={() => router.push("/enrollment")}
          />
        </View>
      )}

      <Button
        title={showHistory ? "Hide recent check-ins" : "Show recent check-ins"}
        variant="ghost"
        size="md"
        onPress={() => setShowHistory((v) => !v)}
        style={{ marginTop: space.xl }}
      />
      {showHistory ? (
        <>
          <Text
            style={{
              color: colors.text,
              fontWeight: "700",
              marginTop: space.md,
              marginBottom: space.sm,
            }}
          >
            Recent
          </Text>
          <PunchLogList logs={history.data ?? []} />
        </>
      ) : null}
    </ScrollView>
  );
}
