import { Text, View } from "react-native";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSyncStore } from "@/store/syncStore";
import { colors } from "@/constants/theme";

export function OfflineNotice() {
  const { isOnline } = useNetworkStatus();
  const pendingCount = useSyncStore((s) => s.pendingCount);

  if (isOnline && pendingCount === 0) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 52,
        left: 16,
        right: 16,
        zIndex: 50,
        backgroundColor: isOnline ? colors.primaryMuted : colors.urgent,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13, textAlign: "center" }}>
        {isOnline
          ? `Syncing ${pendingCount} offline change${pendingCount === 1 ? "" : "s"}…`
          : "You're offline — changes will sync when reconnected"}
      </Text>
    </View>
  );
}
