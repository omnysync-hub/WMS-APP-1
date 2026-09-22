import { Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors } from "@/constants/theme";
import type { DispatchRequest } from "@/types";

export function RequestCard({
  request,
  busy,
  onAccept,
  onDecline,
  onAck,
}: {
  request: DispatchRequest;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onAck: () => void;
}) {
  const pending = request.actionStatus === "pending";
  return (
    <Card
      style={{
        marginBottom: 12,
        borderColor:
          request.priority === "urgent"
            ? colors.urgent
            : request.priority === "high"
              ? colors.high
              : colors.border,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "800", flex: 1 }}>{request.title}</Text>
        <StatusBadge label={request.priority} tone={request.priority} />
      </View>
      <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13 }}>{request.body}</Text>
      <Text style={{ color: colors.textDim, marginTop: 8, fontSize: 11 }}>
        {request.senderName ?? "Dispatch"} · {new Date(request.createdAt).toLocaleString()}
      </Text>

      {pending && request.actionRequired && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {request.type === "JOB_DISPATCH" ? (
            <>
              <View style={{ flex: 1 }}>
                <Button title="Accept Job" loading={busy} onPress={onAccept} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Decline" variant="danger" loading={busy} onPress={onDecline} />
              </View>
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <Button title="Acknowledge" loading={busy} onPress={onAck} />
            </View>
          )}
        </View>
      )}

      {!pending && (
        <View style={{ marginTop: 10 }}>
          <StatusBadge label={request.actionStatus} />
        </View>
      )}
    </Card>
  );
}
