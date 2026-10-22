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
import type { AttendanceLog, GeofenceZone } from "@/types";
import type { DetectedFace } from "@/services/face/pipeline";

export default function AttendanceScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);
  const qc = useQueryClient();
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const { isOnline } = useNetworkStatus();

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [targetPunchType, setTargetPunchType] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");
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

  // Calculate today's status
  const todayLogs = useMemo(() => {
    if (!history.data?.length) return [];
    const todayStr = new Date().toDateString();
    return history.data
      .filter((l) => new Date(l.timestamp).toDateString() === todayStr)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [history.data]);

  const latestTodayPunch = todayLogs[0] ?? null;
  const isLatestCheckOut = Boolean(
    latestTodayPunch &&
      (latestTodayPunch.notes?.includes("[CHECK_OUT]") ||
        latestTodayPunch.type?.toLowerCase() === "check_out" ||
        latestTodayPunch.notes?.toLowerCase().includes("check out") ||
        latestTodayPunch.notes?.toLowerCase().includes("clock out"))
  );

  const isCheckedIn = Boolean(latestTodayPunch && !isLatestCheckOut);

  const firstTodayCheckIn = useMemo(() => {
    const checkIns = todayLogs.filter(
      (l) =>
        !l.notes?.includes("[CHECK_OUT]") &&
        l.type?.toLowerCase() !== "check_out" &&
        !l.notes?.toLowerCase().includes("check out") &&
        !l.notes?.toLowerCase().includes("clock out")
    );
    return checkIns[checkIns.length - 1] ?? null;
  }, [todayLogs]);

  const dutyHoursText = useMemo(() => {
    if (!firstTodayCheckIn) return null;
    const start = new Date(firstTodayCheckIn.timestamp).getTime();
    const end = isCheckedIn
      ? Date.now()
      : latestTodayPunch
        ? new Date(latestTodayPunch.timestamp).getTime()
        : Date.now();
    const diffMs = Math.max(0, end - start);
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  }, [firstTodayCheckIn, isCheckedIn, latestTodayPunch]);

  const nearest = useMemo(() => {
    if (!coords || !sessionZones?.length) return null;
    return findNearestZone(coords.lat, coords.lng, sessionZones);
  }, [coords, sessionZones]);

  const mutation = useMutation({
    mutationFn: async (punchTypeToSubmit?: "CHECK_IN" | "CHECK_OUT") => {
      const pType = punchTypeToSubmit || targetPunchType;
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
        punchType: pType,
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

      const isCheckOutAction = targetPunchType === "CHECK_OUT";

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
          title: isCheckOutAction ? "Check-out didn’t go through" : "Check-in didn’t go through",
          detail: `${result.message}${staleHint}`,
        });
        return;
      }

      setShowBackupVerification(false);
      setBackupPassword("");

      const zone = result.zoneName ?? nearest?.zone.name ?? "site";

      if (result.status === "accepted-but-flagged") {
        setLastResultBanner({
          kind: "flagged",
          title: isCheckOutAction ? `Checked out from ${zone}` : `Checked in at ${zone}`,
          detail: `Office will review: ${result.flagReason ?? result.message}`,
        });
        return;
      }

      if (isCheckOutAction) {
        setLastResultBanner({
          kind: "ok",
          title: `Clocked out successfully`,
          detail: result.message || "Shift finished. Check-out recorded on ERP.",
        });
      } else {
        setLastResultBanner({
          kind: "ok",
          title: `You’re checked in at ${zone}`,
          detail: result.message || "Marked Available & Ready for jobs on ERP.",
        });
      }
    },
    onError: (e: Error) => {
      setLastResultBanner({
        kind: "error",
        title: targetPunchType === "CHECK_OUT" ? "Check-out failed" : "Check-in failed",
        detail: e.message,
      });
    },
  });

  async function openCameraFlow(pType: "CHECK_IN" | "CHECK_OUT" = "CHECK_IN") {
    setTargetPunchType(pType);
    setLastResultBanner(null);
    if (!coords) {
      setLastResultBanner({
        kind: "error",
        title: "Location needed",
        detail: `Turn on GPS, then try ${pType === "CHECK_OUT" ? "Check out" : "Check in"} again.`,
      });
      await refreshLocation();
      return;
    }

    if (!enrolledRef.current) {
      const emb = employee?.id ? await hydrateEnrollmentEmbedding(employee.id) : null;
      enrolledRef.current = emb;
      if (!emb) {
        Alert.alert(
          "Face not set up",
          "Take your enrollment photos once, then mark attendance with your face.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Set up face", onPress: () => router.push("/enrollment") },
          ]
        );
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
        `You look about ${Math.round(near.distanceM)}m from ${near.zone.name}. Punch may be flagged.`,
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
        `Outside ${near.zone.name} (${Math.round(near.distanceM)}m). You can still continue — office may review.`,
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
      mutation.mutate(targetPunchType);
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
    mutation.mutate(targetPunchType);
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
        title="Attendance & Duty"
        subtitle="Check in to start shift & get assigned jobs. Check out at day's end."
      />

      {!isOnline && (
        <InlineBanner
          title="You’re offline"
          detail={
            pendingCount > 0
              ? `${pendingCount} punch(es) waiting to sync.`
              : "Attendance punches save on this phone until you’re back online."
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
          title={`Try ${targetPunchType === "CHECK_OUT" ? "Check out" : "Check in"} again`}
          onPress={() => void openCameraFlow(targetPunchType)}
          style={{ marginBottom: space.lg }}
        />
      )}

      {/* Duty Status Hero Card */}
      <Card
        style={{
          marginBottom: space.lg,
          borderWidth: 1.5,
          borderColor: isCheckedIn ? "rgba(34, 197, 94, 0.4)" : "rgba(100, 116, 139, 0.3)",
          backgroundColor: isCheckedIn ? "rgba(34, 197, 94, 0.05)" : colors.surface,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: isCheckedIn ? "#22C55E" : latestTodayPunch ? "#F59E0B" : "#94A3B8",
                }}
              />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: isCheckedIn ? "#22C55E" : latestTodayPunch ? "#F59E0B" : colors.text,
                }}
              >
                {isCheckedIn
                  ? "Available & Ready (Checked In)"
                  : latestTodayPunch
                    ? "Checked Out"
                    : "Off Duty (Not Checked In)"}
              </Text>
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {isCheckedIn
                ? `Available for dispatcher job assignment on ERP.`
                : latestTodayPunch
                  ? `Shift ended. Clock in again if starting another shift.`
                  : `Check in with your face to mark presence and become available.`}
            </Text>
          </View>
        </View>

        {/* Punch Time & Duty Stats */}
        {latestTodayPunch && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              backgroundColor: colors.surfaceElevated,
              padding: space.md,
              borderRadius: 8,
              marginTop: space.md,
            }}
          >
            <View>
              <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "600", textTransform: "uppercase" }}>
                Latest Punch
              </Text>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", marginTop: 2 }}>
                {new Date(latestTodayPunch.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>

            {dutyHoursText && (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "600", textTransform: "uppercase" }}>
                  Hours on Duty
                </Text>
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700", marginTop: 2 }}>
                  {dutyHoursText}
                </Text>
              </View>
            )}
          </View>
        )}
      </Card>

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
            captureLabel={targetPunchType === "CHECK_OUT" ? "Verify & Check Out" : "Verify & Check In"}
            onCancel={() => setShowCamera(false)}
            onCaptured={({ uri, face }) => void onFaceCaptured(uri, face)}
          />
        </View>
      ) : showBackupVerification ? (
        <Card style={{ marginTop: space.lg }}>
          <Text style={{ color: colors.text, marginBottom: space.sm, ...type.body, fontWeight: "800" }}>
            Backup verification ({targetPunchType === "CHECK_OUT" ? "Check Out" : "Check In"})
          </Text>
          <Text style={{ color: colors.textMuted, marginBottom: space.md, ...type.subtitle }}>
            Enter your work password. The office may review this punch.
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
            title={targetPunchType === "CHECK_OUT" ? "Verify & Check Out" : "Verify & Check In"}
            loading={mutation.isPending}
            disabled={!isOnline}
            onPress={submitBackupVerification}
          />
        </Card>
      ) : (
        <View style={{ marginTop: space.lg, gap: space.md }}>
          {isCheckedIn ? (
            /* Checked In State: Primary action is Check Out, with secondary Re-Punch option */
            <>
              <Button
                title="Check Out (Clock Out)"
                loading={mutation.isPending && targetPunchType === "CHECK_OUT"}
                onPress={() => void openCameraFlow("CHECK_OUT")}
                style={{
                  minHeight: 60,
                  backgroundColor: "#DC2626",
                }}
              />
              <Button
                title="Re-Punch Check In (Update Location)"
                variant="secondary"
                loading={mutation.isPending && targetPunchType === "CHECK_IN"}
                onPress={() => void openCameraFlow("CHECK_IN")}
                style={{ minHeight: 48 }}
              />
            </>
          ) : (
            /* Checked Out / Off Duty State: Primary action is Check In */
            <>
              <Button
                title="Check In (Clock In)"
                loading={mutation.isPending && targetPunchType === "CHECK_IN"}
                onPress={() => void openCameraFlow("CHECK_IN")}
                style={{ minHeight: 64 }}
              />
              {latestTodayPunch && (
                <Button
                  title="Check Out Again"
                  variant="secondary"
                  loading={mutation.isPending && targetPunchType === "CHECK_OUT"}
                  onPress={() => void openCameraFlow("CHECK_OUT")}
                  style={{ minHeight: 48 }}
                />
              )}
            </>
          )}

          <Button
            title="Set up face photos"
            variant="ghost"
            onPress={() => router.push("/enrollment")}
          />
        </View>
      )}

      <Button
        title={showHistory ? "Hide today's logs" : "Show punch history"}
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
            Attendance Logs
          </Text>
          <PunchLogList logs={history.data ?? []} />
        </>
      ) : null}
    </ScrollView>
  );
}
