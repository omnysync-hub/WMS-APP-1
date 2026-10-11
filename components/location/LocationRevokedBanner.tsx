import { useEffect, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { useAuthStore } from "@/store/authStore";
import {
  getLocationPermState,
  openAppLocationSettings,
  wasLocationFlowCompleted,
} from "@/services/locationPermissions";
import { resumeTelemetryIfPossible, stopTelemetry } from "@/services/telemetryService";
import { colors } from "@/constants/theme";

/**
 * Shows when a technician previously finished permission flow but OS revoked location.
 */
export function LocationRevokedBanner() {
  const { employee, isAuthenticated, isTechnician } = useAuthStore();
  const [revoked, setRevoked] = useState(false);

  async function check() {
    if (!isAuthenticated || !isTechnician() || !employee?.id) {
      setRevoked(false);
      return;
    }
    const flowDone = await wasLocationFlowCompleted(employee.id);
    const perms = await getLocationPermState();
    if (flowDone && !perms.trackingReady) {
      setRevoked(true);
      stopTelemetry();
      return;
    }
    setRevoked(false);
    if (perms.trackingReady) void resumeTelemetryIfPossible(employee.id);
  }

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => sub.remove();
  }, [isAuthenticated, employee?.id]);

  if (!revoked) return null;

  return (
    <View
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 88,
        zIndex: 50,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.warning,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <Text style={{ color: colors.warning, fontWeight: "800", fontSize: 13 }}>
        Location tracking off
      </Text>
      <Text style={{ color: colors.textMuted, marginTop: 6, lineHeight: 19, fontSize: 13 }}>
        Attendance geofencing and live dispatch need background location. Re-enable “Allow all the
        time” in Settings.
      </Text>
      <Pressable
        onPress={openAppLocationSettings}
        style={{
          marginTop: 12,
          alignSelf: "flex-start",
          backgroundColor: colors.primary,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Open Settings</Text>
      </Pressable>
    </View>
  );
}
