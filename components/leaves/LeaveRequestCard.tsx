import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors } from "@/constants/theme";
import type { LeaveRequest } from "@/types";

function typeName(req: LeaveRequest) {
  if (typeof req.leaveType === "string") return req.leaveType;
  return req.leaveType?.name ?? "Leave";
}

export function LeaveRequestCard({
  request,
  onPress,
}: {
  request: LeaveRequest;
  onPress?: () => void;
}) {
  const start = request.startDate?.slice(0, 10);
  const end = request.endDate?.slice(0, 10);
  return (
    <Pressable onPress={onPress}>
      <Card style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>
            {typeName(request)}
          </Text>
          <StatusBadge label={request.status} />
        </View>
        <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
          {start} → {end}
          {request.daysCount != null ? ` · ${request.daysCount}d` : ""}
        </Text>
        {!!request.reason && (
          <Text style={{ color: colors.textDim, marginTop: 6, fontSize: 12 }} numberOfLines={2}>
            {request.reason}
          </Text>
        )}
      </Card>
    </Pressable>
  );
}
