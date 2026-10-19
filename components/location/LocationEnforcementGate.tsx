import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { MapPin, RefreshCw, Settings, ShieldAlert, CheckCircle2, AlertTriangle, LogOut } from "lucide-react-native";
import { useAuthStore } from "@/store/authStore";
import {
  checkLocationEnforcement,
  enableDeviceLocationProvider,
  openAppLocationSettings,
  requestTechnicianLocationPermissions,
  type LocationEnforcementState,
} from "@/services/locationPermissions";
import { resumeTelemetryIfPossible } from "@/services/telemetryService";
import { colors, radius, space, tapMin } from "@/constants/theme";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/Button";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function LocationEnforcementGate() {
  const insets = useSafeAreaInsets();
  const { employee, isAuthenticated, logout } = useAuthStore();
  const [state, setState] = useState<LocationEnforcementState>({
    servicesEnabled: true,
    foregroundGranted: true,
    backgroundGranted: true,
    permissionGranted: true,
    canAskAgain: true,
    isReady: true,
  });
  const [checking, setChecking] = useState(false);
  const [initialChecked, setInitialChecked] = useState(false);

  const verify = useCallback(async () => {
    if (!isAuthenticated || !employee?.id) {
      setState((prev) => ({ ...prev, isReady: true }));
      return;
    }
    setChecking(true);
    try {
      const res = await checkLocationEnforcement();
      setState(res);
      if (res.isReady) {
        void resumeTelemetryIfPossible(employee.id);
      }
    } finally {
      setChecking(false);
      setInitialChecked(true);
    }
  }, [isAuthenticated, employee?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;

    void verify();

    // Re-check whenever user returns from Settings, notification shade, or other apps
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void verify();
      }
    });

    // Continuous heartbeat verification: immediately catches when GPS is switched OFF from quick settings
    const timer = setInterval(() => {
      void verify();
    }, 2500);

    // Prevent hardware back button from closing gate when location is off
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!state.isReady) {
        return true; // absorb back button
      }
      return false;
    });

    return () => {
      sub.remove();
      clearInterval(timer);
      backSub.remove();
    };
  }, [isAuthenticated, state.isReady, verify]);

  if (!isAuthenticated || !employee || !initialChecked || state.isReady) {
    return null;
  }

  const handleEnableGps = async () => {
    void haptic.press();
    await enableDeviceLocationProvider();
    // Fast verification sequence as soon as OS location starts up
    setTimeout(() => void verify(), 400);
    setTimeout(() => void verify(), 1200);
    setTimeout(() => void verify(), 2500);
  };

  const handleGrantPermission = async () => {
    void haptic.press();
    if (state.canAskAgain) {
      await requestTechnicianLocationPermissions();
      void verify();
    } else {
      openAppLocationSettings();
    }
  };

  return (
    <Modal
      visible={!state.isReady}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => {
        // Enforce gate: cannot be dismissed via back button or gesture
      }}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: space.xl,
            paddingTop: Math.max(insets.top, 36),
            paddingBottom: Math.max(insets.bottom, 36),
          }}
        >
          {/* Top Warning Shield & Company Branding */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
                padding: 6,
                marginBottom: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <Image
                source={require("@/assets/workman-logo.png")}
                style={{ width: "100%", height: "100%", resizeMode: "contain" }}
              />
            </View>

            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: "rgba(225, 29, 72, 0.15)",
                borderWidth: 2,
                borderColor: colors.danger,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <MapPin size={38} color={colors.danger} />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(225, 29, 72, 0.2)",
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 20,
                marginBottom: 12,
              }}
            >
              <ShieldAlert size={14} color={colors.danger} />
              <Text
                style={{
                  color: colors.danger,
                  fontWeight: "900",
                  fontSize: 11,
                  letterSpacing: 0.8,
                }}
              >
                COMPANY POLICY ENFORCED
              </Text>
            </View>

            <Text
              style={{
                color: colors.text,
                fontSize: 24,
                fontWeight: "900",
                textAlign: "center",
                lineHeight: 30,
              }}
            >
              Location Must Be Turned ON
            </Text>

            <Text
              style={{
                color: colors.textDim,
                fontSize: 14,
                textAlign: "center",
                lineHeight: 21,
                marginTop: 10,
              }}
            >
              Workman Mobile requires real-time device location (GPS) to be active at all times. In
              accordance with company policy, job orders, attendance, and dispatch functions are
              locked until location is enabled.
            </Text>
          </View>

          {/* Status Cards */}
          <View style={{ gap: 10, marginBottom: 24 }}>
            {/* GPS Hardware Status */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: space.md,
                borderWidth: 1.5,
                borderColor: state.servicesEnabled ? colors.success : colors.danger,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                  Device GPS / Location
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                  {state.servicesEnabled
                    ? "Turned on in phone settings"
                    : "Turned OFF on device — GPS is required"}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: state.servicesEnabled
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(225, 29, 72, 0.15)",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: radius.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {state.servicesEnabled ? (
                  <>
                    <CheckCircle2 size={14} color={colors.success} />
                    <Text style={{ color: colors.success, fontWeight: "800", fontSize: 12 }}>
                      ON
                    </Text>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontWeight: "800", fontSize: 12 }}>
                      OFF
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Permission Status */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: space.md,
                borderWidth: 1.5,
                borderColor: state.permissionGranted ? colors.success : colors.danger,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                  Location Permission
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                  {state.permissionGranted
                    ? "Allowed all the time (Background + Locked)"
                    : state.foregroundGranted && !state.backgroundGranted
                    ? "Requires 'Allow all the time' for background & locked tracking"
                    : "Permission not granted to the app"}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: state.permissionGranted
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(225, 29, 72, 0.15)",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: radius.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {state.permissionGranted ? (
                  <>
                    <CheckCircle2 size={14} color={colors.success} />
                    <Text style={{ color: colors.success, fontWeight: "800", fontSize: 12 }}>
                      ALL TIME
                    </Text>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontWeight: "800", fontSize: 12 }}>
                      {state.foregroundGranted && !state.backgroundGranted ? "NEEDS 'ALL TIME'" : "DENIED"}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: 12 }}>
            {!state.servicesEnabled && (
              <Button
                title="Turn on device location (GPS)"
                size="lg"
                onPress={handleEnableGps}
                style={{ backgroundColor: colors.danger }}
                icon={<Settings size={20} color="#fff" />}
              />
            )}

            {!state.permissionGranted && (
              <Button
                title={
                  !state.foregroundGranted
                    ? "Grant location permission"
                    : state.canAskAgain
                    ? "Allow location 'All the time'"
                    : "Open settings & choose 'Allow all the time'"
                }
                size="lg"
                onPress={handleGrantPermission}
                style={{ backgroundColor: colors.primary }}
                icon={<MapPin size={20} color="#fff" />}
              />
            )}

            <Button
              title={checking ? "Verifying location…" : "Check status again"}
              variant="secondary"
              size="lg"
              loading={checking}
              onPress={() => {
                void haptic.press();
                void verify();
              }}
              icon={<RefreshCw size={18} color={colors.text} />}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out of account"
              onPress={() => {
                void haptic.warn();
                void logout();
              }}
              style={{
                alignItems: "center",
                paddingVertical: 14,
                marginTop: 8,
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <LogOut size={16} color={colors.textDim} />
              <Text style={{ color: colors.textDim, fontWeight: "600", fontSize: 14 }}>
                Sign out of {employee.name}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
