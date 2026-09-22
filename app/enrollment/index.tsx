import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FaceCaptureCamera } from "@/components/face/FaceCaptureCamera";
import { buildEnrollmentEmbedding, warmFaceModels } from "@/services/face/pipeline";
import {
  enrollFaceEmbedding,
  fetchEnrollmentStatus,
} from "@/services/face/enrollmentService";
import { FACE_THRESHOLDS } from "@/services/face/thresholds";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import type { DetectedFace } from "@/services/face/pipeline";

type Shot = { uri: string; face: DetectedFace };

export default function EnrollmentScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const [shots, setShots] = useState<Shot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);

  const status = useQuery({
    queryKey: ["enrollment", employee?.id],
    enabled: !!employee?.id,
    queryFn: () => fetchEnrollmentStatus(employee!.id),
  });

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
      Alert.alert("Enrolled", "Face embedding saved. Raw photos were not uploaded.");
      router.back();
    },
    onError: (e: Error) => Alert.alert("Enrollment failed", e.message),
  });

  async function onShot(uri: string, face: DetectedFace) {
    const next = [...shots, { uri, face }];
    setShots(next);
    setCapturing(false);
    if (next.length >= FACE_THRESHOLDS.enrollmentShots) {
      setBusy(true);
      try {
        await warmFaceModels();
        const embedding = await buildEnrollmentEmbedding(next);
        await submit.mutateAsync(embedding);
      } catch (e: unknown) {
        Alert.alert("Failed", e instanceof Error ? e.message : "Could not build embedding");
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
        Face enrollment
      </Text>
      <Text style={{ color: colors.textMuted, marginTop: 6, marginBottom: 14 }}>
        Capture {FACE_THRESHOLDS.enrollmentShots} clear face shots. Only a 512-d embedding is
        uploaded — not photos.
      </Text>

      <Card style={{ marginBottom: 14 }}>
        <Text style={{ color: colors.text }}>
          Status:{" "}
          {status.data?.faceEnrolled
            ? `Enrolled (${status.data.enrollmentCount ?? "?"}×)`
            : "Not enrolled"}
        </Text>
        <Text style={{ color: colors.textDim, marginTop: 6, fontSize: 12 }}>
          Progress: {shots.length} / {FACE_THRESHOLDS.enrollmentShots}
        </Text>
      </Card>

      {capturing ? (
        <FaceCaptureCamera
          mode="enroll"
          busy={busy || submit.isPending}
          captureLabel={`Capture ${shots.length + 1}/${FACE_THRESHOLDS.enrollmentShots}`}
          onCancel={() => setCapturing(false)}
          onCaptured={({ uri, face }) => void onShot(uri, face)}
        />
      ) : (
        <View style={{ gap: 10 }}>
          <Button
            title={
              shots.length >= FACE_THRESHOLDS.enrollmentShots
                ? "Processing…"
                : `Start capture (${shots.length}/${FACE_THRESHOLDS.enrollmentShots})`
            }
            loading={busy || submit.isPending}
            disabled={busy || submit.isPending}
            onPress={() => setCapturing(true)}
          />
          {shots.length > 0 && (
            <Button title="Reset shots" variant="secondary" onPress={() => setShots([])} />
          )}
        </View>
      )}
    </ScrollView>
  );
}
