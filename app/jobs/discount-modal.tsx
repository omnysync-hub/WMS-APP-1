import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { fetchJob, transitionJob } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";

export default function DiscountModal() {
  const { jobId } = useLocalSearchParams<{
    jobId: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const actor = useAuthStore((s) => s.employee?.name) ?? "Technician";

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    enabled: Boolean(jobId),
    queryFn: () => fetchJob(jobId!),
  });
  const items = jobQuery.data?.items ?? [];
  const [itemId, setItemId] = useState("");
  const [discount, setDiscount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!itemId && items[0]?.id) setItemId(items[0].id);
  }, [itemId, items]);

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
      toast("Discount request sent", "success");
      router.back();
    },
    onError: (e: Error) => {
      toast(e.message, "error");
      Alert.alert("Couldn't send", e.message);
    },
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>Ask for discount</Text>
      <Text style={{ color: colors.textMuted, marginTop: 6, marginBottom: 16, lineHeight: 20 }}>
        Pick the line item and how much off. Accounts will approve.
      </Text>

      {jobQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : jobQuery.isError ? (
        <View>
          <InlineBanner
            title="Couldn't load job items"
            detail="Refresh the job and try again."
            tone="error"
          />
          <Button title="Try again" variant="secondary" onPress={() => void jobQuery.refetch()} />
        </View>
      ) : items.length > 0 ? (
        <View style={{ gap: 8, marginBottom: 14 }}>
          {items.map((it) => {
            const active = itemId === it.id;
            return (
              <Pressable
                key={it.id}
                onPress={() => {
                  void haptic.select();
                  setItemId(it.id);
                }}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {it.name ?? it.description ?? "Item"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <InlineBanner
          title="Nothing available for discount"
          detail="This job does not have any materials or services yet."
          tone="info"
        />
      )}

      <Text style={{ color: colors.textDim, marginBottom: 6 }}>Discount (PKR)</Text>
      <TextInput
        value={discount}
        onChangeText={setDiscount}
        keyboardType="decimal-pad"
        placeholder="500"
        placeholderTextColor={colors.textDim}
        style={field}
      />

      <Text style={{ color: colors.textDim, marginTop: 12, marginBottom: 6 }}>Why?</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        multiline
        placeholder="Customer asked for a small concession"
        placeholderTextColor={colors.textDim}
        style={[field, { minHeight: 90, textAlignVertical: "top" }]}
      />

      <Button
        title="Send request"
        loading={mutation.isPending}
        style={{ marginTop: 18 }}
        onPress={() => {
          const amount = Number(discount);
          if (!itemId || !Number.isFinite(amount) || amount <= 0) {
            Alert.alert("Pick an item and amount");
            return;
          }
          if (!reason.trim()) {
            Alert.alert("Reason required", "Briefly explain why the discount is needed.");
            return;
          }
          mutation.mutate();
        }}
        disabled={jobQuery.isLoading || jobQuery.isError || items.length === 0}
      />
    </ScrollView>
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
