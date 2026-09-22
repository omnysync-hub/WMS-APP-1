import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
import { evaluateCheckInFace, warmFaceModels } from "@/services/face/pipeline";
import { hydrateEnrollmentEmbedding } from "@/services/face/enrollmentService";
import { FACE_THRESHOLDS, logFaceScores } from "@/services/face/thresholds";
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { colors } from "@/constants/theme";
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
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [pin, setPin] = useState("");
  const [processingFace, setProcessingFace] = useState(false);
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

  const loadZones = useCallback(async () => {
    if (sessionZones !== null) return sessionZones;
    const zones = await fetchGeofenceZones();
    setSessionZones(zones);
    return zones;
  }, [sessionZones]);

  useEffect(() => {
    void refreshLocation();
    void loadZones().catch(() => {});
    if (employee?.id) {
      void hydrateEnrollmentEmbedding(employee.id).then((emb) => {
        enrolledRef.current = emb;
      });
      void warmFaceModels().catch(() => {});
    }
  }, [refreshLocation, loadZones, employee?.id]);

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
      const timestamp = captureTimestampRef.current ?? new Date().toISOString();
      const { faceMatchScore, livenessScore, notes } = scoresRef.current;

      return submitAttendancePunch({
        employeeId: employee.id,
        geofenceZoneId: near?.zone.id,
        lat: coords.lat,
        lng: coords.lng,
        timestamp,
        faceMatchScore,
        livenessScore,
        deviceId,
        notes:
          notes ??
          (near
            ? `Nearest: ${near.zone.name} (${Math.round(near.distanceM)}m)`
            : "No client geofence match"),
      });
    },
    onSuccess: (result) => {
      setShowCamera(false);
      setShowPinFallback(false);
      captureTimestampRef.current = null;
      qc.invalidateQueries({ queryKey: ["attendance"] });

      if (result.queued) {
        setLastResultBanner({
          kind: "pending",
          title: "Pending sync",
          detail:
            "No network — check-in queued. Not marked checked-in until the server confirms.",
        });
        return;
      }

      if (result.status === "rejected") {
        const staleHint =
          result.code === "STALE_PAYLOAD"
            ? " Retry promptly — clock drift or slow network."
            : "";
        setLastResultBanner({
          kind: "error",
          title: "Check-in rejected",
          detail: `${result.message}${staleHint}`,
        });
        Alert.alert(
          result.code === "STALE_PAYLOAD" ? "Retry needed" : "Rejected",
          `${result.message}${staleHint}`
        );
        return;
      }

      if (result.status === "accepted-but-flagged") {
        const zone = result.zoneName ?? nearest?.zone.name ?? "site";
        setLastResultBanner({
          kind: "flagged",
          title: `Checked in at ${zone} — flagged for review`,
          detail: result.flagReason ?? result.message,
        });
        Alert.alert(
          "Checked in (flagged)",
          `Checked in at ${zone}.\n\nFlagged for review: ${result.flagReason ?? result.message}`
        );
        return;
      }

      const zone = result.zoneName ?? nearest?.zone.name ?? "site";
      setLastResultBanner({
        kind: "ok",
        title: `Checked in at ${zone}`,
        detail: result.message,
      });
      Alert.alert("Checked in", `Checked in at ${zone}`);
    },
    onError: (e: Error) => {
      setLastResultBanner({ kind: "error", title: "Check-in failed", detail: e.message });
      Alert.alert("Check-in failed", e.message);
    },
  });

  async function openCameraFlow() {
    if (!coords) {
      Alert.alert("Location required", "Enable GPS to check in.");
      await refreshLocation();
      return;
    }

    if (!enrolledRef.current) {
      const emb = employee?.id ? await hydrateEnrollmentEmbedding(employee.id) : null;
      enrolledRef.current = emb;
      if (!emb) {
        Alert.alert("Face not enrolled", "Enroll your face before biometric check-in.", [
          { text: "Cancel", style: "cancel" },
          { text: "Enroll", onPress: () => router.push("/enrollment") },
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
      setShowPinFallback(false);
      setShowCamera(true);
    };

    if (
      near &&
      !near.within &&
      near.distanceM > near.zone.radiusMeters * FACE_THRESHOLDS.farWarningMultiplier
    ) {
      Alert.alert(
        "Far from office",
        `You appear ${Math.round(near.distanceM)}m from ${near.zone.name}. Check-in may be flagged.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue anyway", onPress: proceed },
        ]
      );
      return;
    }

    if (near && !near.within) {
      Alert.alert(
        "Outside zone",
        `Outside ${near.zone.name} (${Math.round(near.distanceM)}m). Server still decides.`,
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
      });

      if (!result.ok) {
        if (result.reason === "spoof") {
          Alert.alert("Liveness failed", result.message);
          setLastResultBanner({ kind: "error", title: "Spoof rejected", detail: result.message });
          return;
        }
        if (result.reason === "low_match") {
          const next = matchAttempts + 1;
          setMatchAttempts(next);
          if (next > FACE_THRESHOLDS.maxMatchRetries) {
            setShowCamera(false);
            setShowPinFallback(true);
            logFaceScores({
              outcome: "pin_fallback",
              cosine: result.faceMatchScore,
              liveness: result.livenessScore,
            });
            Alert.alert(
              "Manual check-in",
              "Face match failed after retries. Enter PIN — this punch will be flagged for HR."
            );
          } else {
            Alert.alert("Retry", `${result.message} (attempt ${next}/${FACE_THRESHOLDS.maxMatchRetries})`);
          }
          return;
        }
        Alert.alert("Face check failed", result.message);
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

  function submitPinFallback() {
    if (pin.length < 4) {
      Alert.alert("PIN required");
      return;
    }
    captureTimestampRef.current = new Date().toISOString();
    scoresRef.current = {
      faceMatchScore: 0,
      livenessScore: 0,
      notes: `PIN_OVERRIDE flagged for HR review (face match exhausted)`,
    };
    logFaceScores({ outcome: "pin_override_submit" });
    mutation.mutate();
  }

  const bannerColor =
    lastResultBanner?.kind === "ok"
      ? colors.primary
      : lastResultBanner?.kind === "flagged"
        ? colors.high
        : lastResultBanner?.kind === "pending"
          ? colors.textDim
          : colors.danger;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>Attendance</Text>
      <Text style={{ color: colors.textMuted, marginBottom: 14 }}>
        Geofence + on-device face match & liveness (pilot thresholds — scores logged)
      </Text>

      {!isOnline && (
        <Card style={{ marginBottom: 12, borderColor: colors.high }}>
          <Text style={{ color: colors.high, fontWeight: "700" }}>Offline</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 13 }}>
            Pending sync until server confirms
            {pendingCount > 0 ? ` (${pendingCount} queued)` : ""}.
          </Text>
        </Card>
      )}

      {lastResultBanner && (
        <Card style={{ marginBottom: 12, borderColor: bannerColor }}>
          <Text style={{ color: bannerColor, fontWeight: "800" }}>{lastResultBanner.title}</Text>
          {!!lastResultBanner.detail && (
            <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
              {lastResultBanner.detail}
            </Text>
          )}
        </Card>
      )}

      <GeofenceMapCard
        label={nearest?.zone.name ?? (sessionZones ? "No active zones" : "Loading zones…")}
        distanceM={nearest?.distanceM ?? null}
        radiusM={nearest?.zone.radiusMeters}
      />

      {showCamera ? (
        <View style={{ marginTop: 14 }}>
          <FaceCaptureCamera
            mode="checkin"
            enableChallenge
            busy={processingFace || mutation.isPending}
            captureLabel="Capture & Verify"
            onCancel={() => setShowCamera(false)}
            onCaptured={({ uri, face }) => void onFaceCaptured(uri, face)}
          />
        </View>
      ) : showPinFallback ? (
        <Card style={{ marginTop: 14 }}>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>
            PIN override (flagged for HR)
          </Text>
          <TextInput
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            placeholder="Employee PIN"
            placeholderTextColor={colors.textDim}
            style={{
              backgroundColor: colors.surfaceElevated,
              color: colors.text,
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
            }}
          />
          <Button title="Submit flagged check-in" loading={mutation.isPending} onPress={submitPinFallback} />
        </Card>
      ) : (
        <View style={{ marginTop: 14, gap: 10 }}>
          <Button
            title="Check In"
            loading={mutation.isPending}
            onPress={() => void openCameraFlow()}
          />
          <Button
            title="Face enrollment"
            variant="secondary"
            onPress={() => router.push("/enrollment")}
          />
        </View>
      )}

      <Text style={{ color: colors.text, fontWeight: "700", marginTop: 24, marginBottom: 10 }}>
        My attendance
      </Text>
      <PunchLogList logs={history.data ?? []} />
    </ScrollView>
  );
}
