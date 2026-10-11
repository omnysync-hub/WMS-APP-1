import { Text, View } from "react-native";
import { Bell, Check, X } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors } from "@/constants/theme";
import { friendlyDispatchCopy, friendlyPriority } from "@/lib/friendlyDispatch";
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
  const urgent = request.priority === "urgent" || request.priority === "high";
  const copy = friendlyDispatchCopy(request.title, request.body);
  const sender =
    request.senderRole === "storekeeper"
      ? "Store"
      : request.senderRole === "accountant"
        ? "Accounts"
        : request.senderName ?? "Office";

  return (
    <Card
      style={{
        marginBottom: 12,
        borderRadius: 18,
        borderColor: urgent ? colors.urgent : colors.border,
        borderWidth: urgent ? 1.5 : 1,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: urgent ? colors.urgent : colors.surfaceElevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bell size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", flex: 1, fontSize: 15 }}>
              {copy.title}
            </Text>
            <StatusBadge label={friendlyPriority(request.priority)} tone={request.priority} />
          </View>
          <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13, lineHeight: 19 }}>
            {copy.body}
          </Text>
          <Text style={{ color: colors.textDim, marginTop: 8, fontSize: 11 }}>
            {sender} · {new Date(request.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>

      {pending && request.actionRequired && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {request.type === "JOB_DISPATCH" ? (
            <>
              <View style={{ flex: 1 }}>
                <Button
                  title="Accept"
                  loading={busy}
                  onPress={onAccept}
                  icon={<Check size={16} color="#fff" />}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Decline"
                  variant="danger"
                  loading={busy}
                  onPress={onDecline}
                  icon={<X size={16} color="#fff" />}
                />
              </View>
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <Button title="Got it" loading={busy} onPress={onAck} />
            </View>
          )}
        </View>
      )}

      {!pending && (
        <View style={{ marginTop: 12 }}>
          <StatusBadge label={request.actionStatus} friendly />
        </View>
      )}
    </Card>
  );
}
