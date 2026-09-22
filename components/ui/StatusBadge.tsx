import { Text, View } from "react-native";
import { colors } from "@/constants/theme";

const MAP: Record<string, string> = {
  Assigned: colors.high,
  Accepted: colors.primary,
  InProgress: "#3B82F6",
  Paused: colors.textDim,
  CompletedPendingVerification: colors.success,
  Completed: colors.success,
  Pending: colors.high,
  Approved: colors.success,
  Rejected: colors.danger,
  urgent: colors.urgent,
  high: colors.high,
  normal: colors.primary,
  low: colors.textDim,
  pending: colors.high,
  accepted: colors.success,
  rejected: colors.danger,
  acknowledged: colors.primary,
};

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone?: string;
}) {
  const bg = MAP[tone ?? label] ?? colors.surfaceElevated;
  return (
    <View
      style={{
        backgroundColor: bg + "33",
        borderColor: bg,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: bg, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
