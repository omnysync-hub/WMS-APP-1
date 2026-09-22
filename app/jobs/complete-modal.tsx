import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { transitionJob } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import type { JobItem } from "@/types";

const PAYMENTS = ["cash", "online", "cheque", "unmarked"] as const;

export default function CompleteModal() {
  const { jobId, itemsJson } = useLocalSearchParams<{
    jobId: string;
    itemsJson?: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const actor = useAuthStore((s) => s.employee?.name) ?? "Technician";

  const items = useMemo(() => {
    try {
      return JSON.parse(itemsJson || "[]") as JobItem[];
    } catch {
      return [] as JobItem[];
    }
  }, [itemsJson]);

  const [remarks, setRemarks] = useState("");
  const [paymentMeans, setPaymentMeans] =
    useState<(typeof PAYMENTS)[number]>("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [unusedReason, setUnusedReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      transitionJob(jobId!, {
        action: "complete",
        actualItems: items.map((it) => ({
          id: it.id,
          quantityActual: it.quantityActual ?? it.quantityPlanned ?? 0,
        })),
        completionDetails: {
          workingRemarks: remarks,
          paymentMeans,
          paymentAmount: Number(paymentAmount) || 0,
          paymentNotes: "",
          unusedReason,
        },
        actor,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      Alert.alert("Completed", "Job marked complete (pending verification).");
      router.back();
    },
    onError: (e: Error) => Alert.alert("Failed", e.message),
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ color: colors.textDim, marginBottom: 6 }}>Working remarks</Text>
      <TextInput
        value={remarks}
        onChangeText={setRemarks}
        multiline
        style={field}
        placeholderTextColor={colors.textDim}
        placeholder="What was done on site?"
      />

      <Text style={{ color: colors.textDim, marginTop: 14, marginBottom: 8 }}>Payment</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PAYMENTS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPaymentMeans(p)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: paymentMeans === p ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: paymentMeans === p ? colors.primary : colors.border,
            }}
          >
            <Text style={{ color: colors.text, textTransform: "capitalize" }}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={paymentAmount}
        onChangeText={setPaymentAmount}
        keyboardType="decimal-pad"
        placeholder="Amount collected"
        placeholderTextColor={colors.textDim}
        style={[field, { marginTop: 12 }]}
      />

      <Text style={{ color: colors.textDim, marginTop: 14, marginBottom: 6 }}>
        Unused material reason
      </Text>
      <TextInput
        value={unusedReason}
        onChangeText={setUnusedReason}
        placeholder="Returned excess parts…"
        placeholderTextColor={colors.textDim}
        style={field}
      />

      <Button
        title="Submit Completion"
        loading={mutation.isPending}
        style={{ marginTop: 20 }}
        onPress={() => {
          if (!remarks.trim()) {
            Alert.alert("Remarks required");
            return;
          }
          mutation.mutate();
        }}
      />
    </ScrollView>
  );
}

const field = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  color: colors.text,
  padding: 12,
  minHeight: 48,
} as const;
