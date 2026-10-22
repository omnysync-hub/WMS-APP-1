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

function isCheckOut(log: AttendanceLog) {
  return (
    log.notes?.includes("[CHECK_OUT]") ||
    log.type?.toLowerCase() === "check_out" ||
    log.notes?.toLowerCase().includes("check out") ||
    log.notes?.toLowerCase().includes("clock out")
  );
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
        const checkOut = isCheckOut(item);
        const displayNotes = item.notes
          ? item.notes.replace(/^\[(CHECK_IN|CHECK_OUT)\]\s*/i, "")
          : null;

        return (
          <Card style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: checkOut ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.15)",
                    borderWidth: 1,
                    borderColor: checkOut ? "rgba(245, 158, 11, 0.4)" : "rgba(34, 197, 94, 0.4)",
                  }}
                >
                  <Text
                    style={{
                      color: checkOut ? "#F59E0B" : "#22C55E",
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 0.5,
                    }}
                  >
                    {checkOut ? "CHECK OUT" : "CHECK IN"}
                  </Text>
                </View>
                <StatusBadge label={statusLabel(item)} tone={statusTone(item)} />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {when.toLocaleDateString()} · {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
            {!!displayNotes && !item.flagReason && (
              <Text style={{ color: colors.textDim, marginTop: 6, fontSize: 12 }} numberOfLines={2}>
                {displayNotes}
              </Text>
            )}
          </Card>
        );
      }}
    />
  );
}
