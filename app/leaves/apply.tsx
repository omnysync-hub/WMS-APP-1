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
        onChangeText={setStartDate}
        placeholder="2026-09-25"
        placeholderTextColor={colors.textDim}
        style={field}
      />

      <Text style={{ color: colors.textDim, marginTop: 12, marginBottom: 6 }}>
        End date (YYYY-MM-DD)
      </Text>
      <TextInput
        value={endDate}
        onChangeText={setEndDate}
        placeholder="2026-09-26"
        placeholderTextColor={colors.textDim}
        style={field}
      />

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
