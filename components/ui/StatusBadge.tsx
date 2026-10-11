import { Text, View } from "react-native";
import { colors } from "@/constants/theme";

const MAP: Record<string, string> = {
  Assigned: colors.high,
  Accepted: colors.primary,
  InProgress: "#3B82F6",
  Paused: colors.textDim,
  AwaitingFeedback: colors.high,
  CompletedPendingVerification: colors.success,
  Finalized: colors.success,
  Verified: colors.success,
  TechnicianReassigned: colors.textDim,
  Cancelled: colors.textDim,
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

const FRIENDLY: Record<string, string> = {
  Assigned: "New job",
  Accepted: "Accepted",
  InProgress: "Working",
  Paused: "Paused",
  AwaitingFeedback: "Feedback next",
  CompletedPendingVerification: "Done",
  Finalized: "Done",
  Verified: "Done",
  TechnicianReassigned: "Reassigned",
  Cancelled: "Cancelled",
  Completed: "Done",
  pending: "Waiting",
  accepted: "Accepted",
  rejected: "Declined",
  acknowledged: "Seen",
};

export function StatusBadge({
  label,
  tone,
  friendly,
}: {
  label: string;
  tone?: string;
  friendly?: boolean;
}) {
  const raw = MAP[tone ?? label] ?? colors.surfaceElevated;
  const bg = typeof raw === "string" ? raw : colors.surfaceElevated;
  const text = friendly ? FRIENDLY[label] ?? String(label ?? "") : String(label ?? "");
  return (
    <View
      style={{
        backgroundColor: `${bg}33`,
        borderColor: bg,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: bg, fontSize: 11, fontWeight: "800" }}>{text || "—"}</Text>
    </View>
  );
}
