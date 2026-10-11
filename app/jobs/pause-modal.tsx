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
  const [doneToday, setDoneToday] = useState("");
  const [remaining, setRemaining] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const note = `Work paused for today: Fitted ${doneToday || "?"} units; ${
        remaining || "?"
      } units remaining for tomorrow. Reason: ${reason.trim()}`;
      return transitionJob(jobId!, { action: "pause", note, actor });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      router.back();
    },
    onError: (e: Error) => Alert.alert("Failed", e.message),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Text style={{ color: colors.textDim, marginBottom: 6 }}>Units fitted today</Text>
      <TextInput
        value={doneToday}
        onChangeText={setDoneToday}
        keyboardType="number-pad"
        placeholder="e.g. 3"
        placeholderTextColor={colors.textDim}
        style={field}
      />

      <Text style={{ color: colors.textDim, marginTop: 12, marginBottom: 6 }}>
        Units remaining tomorrow
      </Text>
      <TextInput
        value={remaining}
        onChangeText={setRemaining}
        keyboardType="number-pad"
        placeholder="e.g. 2"
        placeholderTextColor={colors.textDim}
        style={field}
      />

      <Text style={{ color: colors.textDim, marginTop: 12, marginBottom: 6 }}>
        Reason & scheduled resume
      </Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        multiline
        placeholder="Daylight ended; resume 8am tomorrow"
        placeholderTextColor={colors.textDim}
        style={[field, { minHeight: 100, textAlignVertical: "top" }]}
      />

      <Text style={{ color: colors.textDim, marginTop: 14, fontSize: 12, lineHeight: 18 }}>
        Optional tips (not required to resume later): stock usually stays with you on site.
        Returning parts to the storekeeper is rare. You may visit the accountant for partial
        hisaab if useful — Resume will still work without it.
      </Text>

      <Button
        title="Pause Job"
        loading={mutation.isPending}
        style={{ marginTop: 16 }}
        onPress={() => {
          if (!reason.trim()) {
            Alert.alert("Reason required");
            return;
          }
          mutation.mutate();
        }}
      />
    </View>
  );
}

const field = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: 12,
  color: colors.text,
  padding: 12,
  minHeight: 48,
} as const;
