import { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { transitionJob } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";

export default function DiscountModal() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const actor = useAuthStore((s) => s.employee?.name) ?? "Technician";
  const [itemId, setItemId] = useState("");
  const [discount, setDiscount] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      transitionJob(jobId!, {
        action: "request_item_discount",
        itemId,
        discountRequested: Number(discount) || 0,
        reason,
        actor,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      Alert.alert("Sent", "Discount request sent to accountant.");
      router.back();
    },
    onError: (e: Error) => Alert.alert("Failed", e.message),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Text style={{ color: colors.textDim, marginBottom: 6 }}>Item ID</Text>
      <TextInput
        value={itemId}
        onChangeText={setItemId}
        placeholder="UUID from job materials"
        placeholderTextColor={colors.textDim}
        style={field}
      />
      <Text style={{ color: colors.textDim, marginTop: 12, marginBottom: 6 }}>
        Discount amount (PKR)
      </Text>
      <TextInput
        value={discount}
        onChangeText={setDiscount}
        keyboardType="decimal-pad"
        placeholder="500"
        placeholderTextColor={colors.textDim}
        style={field}
      />
      <Text style={{ color: colors.textDim, marginTop: 12, marginBottom: 6 }}>Reason</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        multiline
        placeholder="Customer loyalty concession"
        placeholderTextColor={colors.textDim}
        style={[field, { minHeight: 90, textAlignVertical: "top" }]}
      />
      <Button
        title="Request Discount"
        loading={mutation.isPending}
        style={{ marginTop: 16 }}
        onPress={() => {
          if (!itemId || !discount) {
            Alert.alert("Item ID and amount required");
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
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  color: colors.text,
  padding: 12,
} as const;
