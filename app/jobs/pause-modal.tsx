import { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { transitionJob } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";

export default function PauseModal() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const actor = useAuthStore((s) => s.employee?.name) ?? "Technician";
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      transitionJob(jobId!, { action: "pause", note, actor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      router.back();
    },
    onError: (e: Error) => Alert.alert("Failed", e.message),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
        Partial completion note (units done vs remaining)
      </Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="Fitted 3 ACs; 2 remaining for tomorrow"
        placeholderTextColor={colors.textDim}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 12,
          color: colors.text,
          minHeight: 120,
          padding: 12,
          textAlignVertical: "top",
        }}
      />
      <Button
        title="Pause Job"
        loading={mutation.isPending}
        style={{ marginTop: 16 }}
        onPress={() => mutation.mutate()}
      />
    </View>
  );
}
