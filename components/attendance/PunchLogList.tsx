import { FlatList, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors } from "@/constants/theme";
import type { AttendanceLog } from "@/types";

function statusLabel(log: AttendanceLog) {
  if (log.flaggedForReview || log.result === "flagged") return "Flagged";
  if (log.result === "pass" || log.withinGeofence) return "Accepted";
  if (log.result === "fail") return "Rejected";
  return log.result ?? "Recorded";
}

function statusTone(log: AttendanceLog) {
  const label = statusLabel(log);
  if (label === "Flagged") return "high";
  if (label === "Accepted") return "Accepted";
  if (label === "Rejected") return "Rejected";
  return "Paused";
}

export function PunchLogList({ logs }: { logs: AttendanceLog[] }) {
  if (!logs.length) {
    return (
      <Card>
        <Text style={{ color: colors.textDim }}>No punch history yet.</Text>
      </Card>
    );
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      renderItem={({ item }) => {
        const when = new Date(item.timestamp);
        const zoneName = item.geofenceZone?.name ?? "—";
        return (
          <Card style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <StatusBadge label={statusLabel(item)} tone={statusTone(item)} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {when.toLocaleDateString()} · {when.toLocaleTimeString()}
              </Text>
            </View>
            <Text style={{ color: colors.text, marginTop: 8, fontWeight: "600" }}>
              {zoneName}
            </Text>
            {!!item.flagReason && (
              <Text style={{ color: colors.high, marginTop: 6, fontSize: 12 }}>
                {item.flagReason}
              </Text>
            )}
            {!!item.notes && !item.flagReason && (
              <Text style={{ color: colors.textDim, marginTop: 6, fontSize: 12 }} numberOfLines={2}>
                {item.notes}
              </Text>
            )}
          </Card>
        );
      }}
    />
  );
}
