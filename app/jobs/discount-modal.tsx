import { useEffect, useMemo, useState } from "react";
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

import { calculateJobBilling, formatMoney, parseJobLine } from "@/lib/jobLineFormat";
import type { JobDiscountRequest, JobItem } from "@/types";

type DiscountType = "percent" | "amount";

/** Statuses where the server accepts a technician discount request (job not finalized). */
const REQUESTABLE = new Set(["Accepted", "InProgress", "Paused"]);

function lineGross(it: JobItem) {
  const line = parseJobLine(it);
  const rate = Number(line.unitRate ?? it.unitRate ?? it.unitPrice ?? 0);
  const qty = Number(it.quantityActual ?? it.quantityPlanned ?? 1);
  return Math.max(0, rate * (qty > 0 ? qty : 1));
}

export default function DiscountModal() {
  const { jobId, itemId: preselectedItemId } = useLocalSearchParams<{
    jobId: string;
    itemId?: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const actor = useAuthStore((s) => s.employee?.name) ?? "Technician";

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    enabled: Boolean(jobId),
    queryFn: () => fetchJob(jobId!),
  });
  const job = jobQuery.data;
  const rawItems = job?.items ?? [];
  const items = rawItems.filter((it) => !parseJobLine(it).isEquipment && lineGross(it) > 0);
  const requests: JobDiscountRequest[] = job?.discountRequests ?? [];
  const pending = requests.find((r) => r.status === "pending");

  // "" = whole job, otherwise a specific line
  const [scopeItemId, setScopeItemId] = useState<string>(preselectedItemId || "");
  const [discountType, setDiscountType] = useState<DiscountType>("amount");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (scopeItemId && rawItems.length > 0 && !items.some((it) => it.id === scopeItemId)) {
      setScopeItemId("");
    }
  }, [scopeItemId, rawItems.length, items]);

  const billing = useMemo(() => calculateJobBilling(job ?? {}), [job]);
  // Server totals win when present (same math as ERP finalize)
  const gross = job?.billingSummary?.gross ?? billing.grossTotal;
  const amountDue = job?.billingSummary?.net ?? billing.netTotal;
  const selectedItem = items.find((it) => it.id === scopeItemId);
  const base = selectedItem ? lineGross(selectedItem) : gross;

  const numericValue = Number(value);
  const computed =
    Number.isFinite(numericValue) && numericValue > 0
      ? Math.round((discountType === "percent" ? (base * numericValue) / 100 : numericValue) * 100) / 100
      : 0;
  let limitError = "";
  if (discountType === "percent" && numericValue > 100) limitError = "Percentage must be between 0 and 100.";
  else if (discountType === "amount" && numericValue > base) limitError = `Cannot exceed ${formatMoney(base)}.`;
  else if (computed > amountDue) limitError = `Cannot exceed the amount due (${formatMoney(amountDue)}).`;

  const mutation = useMutation({
    mutationFn: () =>
      transitionJob(jobId!, {
        action: "request_discount",
        discountType,
        discountValue: numericValue,
        itemId: scopeItemId || undefined,
        reason: reason.trim(),
        actor,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      toast("Discount request sent to office", "success");
      router.back();
    },
    onError: (e: Error) => {
      toast(e.message, "error");
      Alert.alert("Couldn't send", e.message);
    },
  });

  const canRequest = job && REQUESTABLE.has(String(job.status)) && !job.isFoc && !pending;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>Ask for discount</Text>
      <Text style={{ color: colors.textMuted, marginTop: 6, marginBottom: 16, lineHeight: 20 }}>
        Request a percentage or fixed discount with a reason. The office approves it before the bill is closed.
      </Text>

      {jobQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : jobQuery.isError || !job ? (
        <View>
          <InlineBanner title="Couldn't load job" detail="Refresh the job and try again." tone="error" />
          <Button title="Try again" variant="secondary" onPress={() => void jobQuery.refetch()} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {/* Amount due + request history */}
          <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textMuted }}>Job total</Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{formatMoney(gross)}</Text>
            </View>
            {(job.discountAmount ?? 0) > 0 ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#FBBF24" }}>Approved discount</Text>
                <Text style={{ color: "#FBBF24", fontWeight: "700" }}>- {formatMoney(Number(job.discountAmount))}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>Amount due</Text>
              <Text style={{ color: colors.text, fontWeight: "900" }}>{formatMoney(amountDue)}</Text>
            </View>
          </View>

          {requests.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.textDim, fontWeight: "700" }}>Your requests</Text>
              {requests.map((r) => (
                <View
                  key={r.id}
                  style={{ padding: 12, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {r.discountType === "percent" ? `${r.discountValue}%` : formatMoney(r.discountValue)} ·{" "}
                      {formatMoney(r.approvedAmount ?? r.requestedAmount)}
                    </Text>
                    <Text
                      style={{
                        fontWeight: "800",
                        color: r.status === "approved" ? colors.success : r.status === "rejected" ? colors.danger : "#FBBF24",
                      }}
                    >
                      {r.status === "pending" ? "Waiting for office" : r.status === "approved" ? "Approved" : r.status === "rejected" ? "Declined" : r.status}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{r.reason}</Text>
                  {r.decisionNote ? (
                    <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>Office: {r.decisionNote}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {job.isFoc ? (
            <InlineBanner title="FOC job" detail="There is nothing to discount on an FOC job." tone="info" />
          ) : !REQUESTABLE.has(String(job.status)) ? (
            <InlineBanner
              title="Discount not available"
              detail="Discounts can be requested after accepting the job and before it is completed/finalized."
              tone="warn"
            />
          ) : pending ? (
            <InlineBanner title="Request pending" detail="Wait for the office decision before sending another request." tone="info" />
          ) : null}

          {canRequest ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.textDim, fontWeight: "700" }}>Apply to</Text>
              <View style={{ gap: 8 }}>
                {[{ id: "", label: "Whole job", total: gross }, ...items.map((it) => ({ id: it.id, label: parseJobLine(it).title, total: lineGross(it) }))].map(
                  (opt) => {
                    const active = scopeItemId === opt.id;
                    return (
                      <Pressable
                        key={opt.id || "job"}
                        onPress={() => {
                          void haptic.select();
                          setScopeItemId(opt.id);
                        }}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: active ? colors.primaryMuted : colors.surface,
                          borderWidth: 1.5,
                          borderColor: active ? colors.primary : colors.border,
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>{opt.label}</Text>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{formatMoney(opt.total)}</Text>
                      </Pressable>
                    );
                  }
                )}
              </View>

              <Text style={{ color: colors.textDim, fontWeight: "700" }}>Discount type</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["amount", "percent"] as DiscountType[]).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => {
                      void haptic.select();
                      setDiscountType(t);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: discountType === t ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: discountType === t ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ color: discountType === t ? "#fff" : colors.text, fontWeight: "700" }}>
                      {t === "amount" ? "Fixed (PKR)" : "Percent (%)"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 500"}
                placeholderTextColor={colors.textDim}
                style={[field, limitError ? { borderColor: colors.danger, borderWidth: 1.5 } : null]}
              />
              {limitError ? (
                <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "700" }}>⚠️ {limitError}</Text>
              ) : computed > 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  Discount {formatMoney(computed)} · amount due would be {formatMoney(Math.max(0, amountDue - computed))}
                </Text>
              ) : null}

              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Reason (required) — e.g. customer loyalty, minor delay"
                placeholderTextColor={colors.textDim}
                multiline
                style={[field, { minHeight: 70, textAlignVertical: "top" }]}
              />

              <Button
                title="Send request"
                loading={mutation.isPending}
                style={{ marginTop: 8 }}
                onPress={() => {
                  if (!Number.isFinite(numericValue) || numericValue <= 0) {
                    Alert.alert("Enter a value", "Please enter a valid discount.");
                    return;
                  }
                  if (limitError) {
                    void haptic.error();
                    Alert.alert("Discount limit exceeded", limitError);
                    return;
                  }
                  if (reason.trim().length < 3) {
                    Alert.alert("Reason required", "Please say why the customer is getting a discount.");
                    return;
                  }
                  mutation.mutate();
                }}
                disabled={Boolean(limitError) || !value.trim() || reason.trim().length < 3}
              />
            </View>
          ) : (
            <Button title="Go back" variant="secondary" onPress={() => router.back()} />
          )}
        </View>
      )}
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
