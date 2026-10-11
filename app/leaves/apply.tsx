import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { applyLeave, fetchLeaves } from "@/services/leavesService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";

const TYPES = [
  { key: "annual", label: "Annual" },
  { key: "casual", label: "Casual" },
  { key: "sick", label: "Sick" },
  { key: "unpaid", label: "Unpaid" },
] as const;

const CHIPS = ["Medical appointment", "Family event", "Personal rest"];

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export default function ApplyLeaveScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const [leaveType, setLeaveType] = useState<string>("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const leaves = useQuery({
    queryKey: ["leaves", employee?.id],
    enabled: !!employee?.id,
    queryFn: () => fetchLeaves(employee!.id),
  });

  const leaveTypeId = useMemo(() => {
    const bal = leaves.data?.balances?.[leaveType];
    return bal?.leaveTypeId as string | undefined;
  }, [leaves.data, leaveType]);

  const dateRange = useMemo(() => {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (!start || !end || end < start) return null;
    return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }, [startDate, endDate]);

  const mutation = useMutation({
    mutationFn: () =>
      applyLeave({
        employeeId: employee!.id,
        leaveTypeId,
        leaveType,
        startDate,
        endDate,
        reason: reason || "Personal leave",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      Alert.alert("Submitted", "Leave request sent for manager approval.");
      router.back();
    },
    onError: (e: Error) => Alert.alert("Failed", e.message),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Text style={{ color: colors.textDim, marginBottom: 8 }}>Leave type</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {TYPES.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setLeaveType(t.key)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: leaveType === t.key ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: leaveType === t.key ? colors.primary : colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ color: colors.textDim, marginBottom: 6 }}>Start date (YYYY-MM-DD)</Text>
      <TextInput
        value={startDate}
        onChangeText={(value) => setStartDate(value.replace(/[^0-9-]/g, "").slice(0, 10))}
        keyboardType="numbers-and-punctuation"
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textDim}
        style={field}
      />

      <Text style={{ color: colors.textDim, marginTop: 12, marginBottom: 6 }}>
        End date (YYYY-MM-DD)
      </Text>
      <TextInput
        value={endDate}
        onChangeText={(value) => setEndDate(value.replace(/[^0-9-]/g, "").slice(0, 10))}
        keyboardType="numbers-and-punctuation"
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textDim}
        style={field}
      />

      {dateRange ? (
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>
          {dateRange} day{dateRange === 1 ? "" : "s"} of leave
        </Text>
      ) : null}

      <Text style={{ color: colors.textDim, marginTop: 12, marginBottom: 6 }}>Reason</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        multiline
        placeholder="Why do you need leave?"
        placeholderTextColor={colors.textDim}
        style={[field, { minHeight: 90, textAlignVertical: "top" }]}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {CHIPS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setReason(c)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: colors.surfaceElevated,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Button
        title="Submit Leave Request"
        loading={mutation.isPending}
        style={{ marginTop: 20 }}
        onPress={() => {
          if (!startDate || !endDate) {
            Alert.alert("Dates required");
            return;
          }
          const start = parseIsoDate(startDate);
          const end = parseIsoDate(endDate);
          if (!start || !end) {
            Alert.alert("Check the dates", "Use a real date in YYYY-MM-DD format.");
            return;
          }
          if (start < todayUtc()) {
            Alert.alert("Start date has passed", "Choose today or a future date.");
            return;
          }
          if (end < start) {
            Alert.alert("Check the date range", "The end date cannot be before the start date.");
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
  paddingHorizontal: 12,
  paddingVertical: 12,
} as const;
