import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
  Alert,
  Pressable,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Button } from "@/components/ui/Button";
import { loginWithPin } from "@/services/authService";
import { registerForPushNotifications } from "@/services/pushNotificationService";
import { startTelemetry } from "@/services/telemetryService";
import { hydrateEnrollmentEmbedding } from "@/services/face/enrollmentService";
import { useAuthStore } from "@/store/authStore";
import { SKIP_LOGIN } from "@/constants/dev";
import { colors } from "@/constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, employee, isHydrated } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (SKIP_LOGIN) return;
    void tryBiometric();
  }, []);

  async function tryBiometric() {
    const enabled = await SecureStore.getItemAsync("wms_bio_enabled");
    if (enabled !== "1") return;
    const hasHw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHw || !enrolled) return;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Workman Companion",
      fallbackLabel: "Use PIN",
    });
    if (result.success && useAuthStore.getState().isAuthenticated) {
      routeAfterLogin(useAuthStore.getState().employee?.role);
    }
  }

  function routeAfterLogin(role?: string | null) {
    if (role === "technician") router.replace("/(tabs)");
    else router.replace("/(tabs)/attendance");
  }

  async function onLogin() {
    if (!phone.trim() || pin.length < 4) {
      Alert.alert("Missing fields", "Enter phone and PIN.");
      return;
    }
    setLoading(true);
    try {
      const emp = await loginWithPin({ phone: phone.trim(), pin });
      await SecureStore.setItemAsync("wms_bio_enabled", "1");
      await registerForPushNotifications(emp.id);
      void hydrateEnrollmentEmbedding(emp.id).catch(() => {});
      if (emp.role === "technician") {
        await startTelemetry(emp.id);
      }
      routeAfterLogin(emp.role);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      Alert.alert("Login failed", msg);
    } finally {
      setLoading(false);
    }
  }

  if (SKIP_LOGIN || (isHydrated && isAuthenticated)) {
    return (
      <Redirect
        href={
          employee?.role === "technician" || (SKIP_LOGIN && !employee)
            ? "/(tabs)"
            : "/(tabs)/attendance"
        }
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center" }}
    >
      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700", letterSpacing: 1.2 }}>
        WORKMAN SERVICES
      </Text>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800", marginTop: 8 }}>
        Field Companion
      </Text>
      <Text style={{ color: colors.textMuted, marginTop: 8, marginBottom: 28 }}>
        Sign in with your employee phone and PIN.
      </Text>

      <Text style={{ color: colors.textDim, marginBottom: 6 }}>Phone</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+92…"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        style={inputStyle}
      />

      <Text style={{ color: colors.textDim, marginTop: 14, marginBottom: 6 }}>PIN</Text>
      <TextInput
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={8}
        placeholder="••••••"
        placeholderTextColor={colors.textDim}
        style={inputStyle}
      />

      <Button title="Sign In" loading={loading} onPress={onLogin} style={{ marginTop: 22 }} />

      <Pressable onPress={() => router.push("/(auth)/switch-tenant")} style={{ marginTop: 18 }}>
        <Text style={{ color: colors.textDim, textAlign: "center" }}>
          Switch server / environment
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  color: colors.text,
  paddingHorizontal: 14,
  paddingVertical: 14,
  fontSize: 16,
} as const;
