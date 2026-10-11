import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { FaceCaptureCamera } from "@/components/face/FaceCaptureCamera";
import { buildEnrollmentEmbedding, warmFaceModels } from "@/services/face/pipeline";
import {
  enrollFaceEmbedding,
  fetchEnrollmentStatus,
} from "@/services/face/enrollmentService";
import { FACE_THRESHOLDS } from "@/services/face/thresholds";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import { colors, space, type } from "@/constants/theme";
import type { DetectedFace } from "@/services/face/pipeline";

type Shot = { uri: string; face: DetectedFace };

export default function EnrollmentScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const [shots, setShots] = useState<Shot[]>([]);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Building your face code…");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justEnrolled, setJustEnrolled] = useState(false);

  const status = useQuery({
    queryKey: ["enrollment", employee?.id],
    enabled: !!employee?.id,
    queryFn: () => fetchEnrollmentStatus(employee!.id),
  });

  useEffect(() => {
    void warmFaceModels().catch(() => {});
  }, []);

  const submit = useMutation({
    mutationFn: async (embedding: number[]) =>
      enrollFaceEmbedding({
        employeeId: employee!.id,
        embedding,
        actorName: employee?.name ?? undefined,
        actorRole: employee?.role,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollment"] });
      setJustEnrolled(true);
      toast("You’re enrolled", "success");
    },
    onError: (e: Error) => {
      toast(e.message, "error");
      setSaveError(e.message);
    },
  });

  const finish = useCallback(
    async (all: Shot[]) => {
      setBusy(true);
      setActive(false);
      setSaveError(null);
      setBusyLabel("Loading face models…");
      try {
        await warmFaceModels();
        setBusyLabel("Building your face code…");
        const embedding = await buildEnrollmentEmbedding(all, setBusyLabel);
        setBusyLabel("Saving your face code…");
        await submit.mutateAsync(embedding);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not build face code";
        setSaveError(msg);
        toast(msg, "error");
        setShots([]);
        setActive(false);
      } finally {
        setBusy(false);
        setBusyLabel("Building your face code…");
      }
    },
    [submit]
  );

  const onShot = useCallback(
    (uri: string, face: DetectedFace) => {
      setShots((prev) => {
        if (prev.length >= FACE_THRESHOLDS.enrollmentShots) return prev;
        const next = [...prev, { uri, face }];
        if (
          next.length === FACE_THRESHOLDS.enrollmentShots ||
          next.length % 3 === 0
        ) {
          toast(`Photo ${next.length} of ${FACE_THRESHOLDS.enrollmentShots}`, "success");
        }
        if (next.length >= FACE_THRESHOLDS.enrollmentShots) {
          queueMicrotask(() => void finish(next));
        }
        return next;
      });
    },
    [finish]
  );

  const showCamera =
    active && !busy && shots.length < FACE_THRESHOLDS.enrollmentShots;
  const photoLabel = `Photo ${Math.min(shots.length + 1, FACE_THRESHOLDS.enrollmentShots)} of ${FACE_THRESHOLDS.enrollmentShots}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      scrollEnabled={!showCamera}
    >
      <ScreenHeader
        title="Face setup"
        subtitle="A few photos now — then you check in with a blink."
      />

      {justEnrolled ? (
        <InlineBanner
          title="You’re enrolled"
          detail="You can check in with your face. Photos stayed on this phone."
          tone="success"
        />
      ) : status.data?.faceEnrolled ? (
        <InlineBanner
          title="Already enrolled"
          detail="Starting again replaces your current face code."
          tone="info"
        />
      ) : (
        <InlineBanner
          title="Not enrolled yet"
          detail={`We’ll take ${FACE_THRESHOLDS.enrollmentShots} quick shots from different angles.`}
          tone="info"
        />
      )}

      {!!saveError && (
        <InlineBanner title="Couldn’t save" detail={saveError} tone="error" />
      )}

      {!justEnrolled && (
        <Card style={{ marginBottom: space.lg }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
            {busy ? busyLabel : showCamera ? photoLabel : "Ready when you are"}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: space.xs, ...type.subtitle }}>
            {busy
              ? "Hang tight — this only takes a moment."
              : showCamera
                ? "Follow the pose line on the camera."
                : `Progress: ${shots.length} / ${FACE_THRESHOLDS.enrollmentShots}`}
          </Text>
          <View style={styles.dots}>
            {Array.from({ length: FACE_THRESHOLDS.enrollmentShots }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i < shots.length ? styles.dotOn : styles.dotOff]}
              />
            ))}
          </View>
        </Card>
      )}

      {justEnrolled ? (
        <View style={{ gap: space.md }}>
          <Button title="Go to check-in" onPress={() => router.replace("/(tabs)/attendance")} />
          <Button title="Done" variant="secondary" onPress={() => router.back()} />
        </View>
      ) : showCamera ? (
        <FaceCaptureCamera
          mode="enroll"
          enableBlinkChallenge={false}
          shotIndex={shots.length}
          shotTotal={FACE_THRESHOLDS.enrollmentShots}
          busy={busy}
          onCancel={() => setActive(false)}
          onCaptured={({ uri, face }) => onShot(uri, face)}
        />
      ) : (
        <View style={{ gap: space.md }}>
          <Button
            title={busy ? busyLabel : status.data?.faceEnrolled ? "Replace face photos" : "Start photos"}
            loading={busy || submit.isPending}
            disabled={busy || submit.isPending}
            onPress={() => {
              setShots([]);
              setSaveError(null);
              setJustEnrolled(false);
              setActive(true);
            }}
          />
          {shots.length > 0 && !busy && (
            <Button title="Start over" variant="secondary" onPress={() => setShots([])} />
          )}
          <Button title="Cancel" variant="ghost" size="md" onPress={() => router.back()} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = {
  dots: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginTop: space.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOn: { backgroundColor: colors.primary },
  dotOff: { backgroundColor: colors.surfaceElevated },
};
