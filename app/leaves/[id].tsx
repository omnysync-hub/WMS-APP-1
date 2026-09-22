import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { fetchLeaves } from "@/services/leavesService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import type { LeaveRequest } from "@/types";

export default function LeaveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const employee = useAuthStore((s) => s.employee);

  const query = useQuery({
    queryKey: ["leaves", employee?.id],
    enabled: !!employee?.id,
    queryFn: () => fetchLeaves(employee!.id),
  });

  const request = (query.data?.requests as LeaveRequest[] | undefined)?.find(
    (r) => r.id === id
  );

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Text style={{ color: colors.textDim }}>Leave request not found.</Text>
      </View>
    );
  }

  const typeName =
    typeof request.leaveType === "string"
      ? request.leaveType
      : request.leaveType?.name ?? "Leave";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{typeName}</Text>
          <StatusBadge label={request.status} />
        </View>
        <Text style={{ color: colors.textMuted, marginTop: 12 }}>
          {request.startDate?.slice(0, 10)} → {request.endDate?.slice(0, 10)}
        </Text>
        {request.daysCount != null && (
          <Text style={{ color: colors.textDim, marginTop: 6 }}>{request.daysCount} day(s)</Text>
        )}
        <Text style={{ color: colors.text, marginTop: 14 }}>{request.reason}</Text>
        {!!request.approvedBy && (
          <Text style={{ color: colors.primary, marginTop: 14 }}>
            Decided by: {request.approvedBy}
          </Text>
        )}
        <Text style={{ color: colors.textDim, marginTop: 12, fontSize: 12 }}>
          Submitted {new Date(request.createdAt).toLocaleString()}
        </Text>
      </Card>
    </View>
  );
}
