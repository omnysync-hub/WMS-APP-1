import { useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Button } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { loginWithPassword } from "@/services/authService";
import { registerForPushNotifications } from "@/services/pushNotificationService";
import { hydrateEnrollmentEmbedding } from "@/services/face/enrollmentService";
import { prepareTechnicianLocation } from "@/services/technicianLocationGate";
import { LoginError } from "@/services/loginErrors";
import { useAuthStore } from "@/store/authStore";
import { SKIP_LOGIN } from "@/constants/dev";
import { colors, radius, space, type } from "@/constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, employee, isHydrated } = useAuthStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [errorKind, setErrorKind] = useState<LoginError["kind"] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockRemainingSec, setLockRemainingSec] = useState<number | null>(null);

  useEffect(() => {
    if (SKIP_LOGIN) return;
    void (async () => {
      const enabled = await SecureStore.getItemAsync("wms_bio_enabled");
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBioAvailable(enabled === "1" && hasHw && enrolled);
      if (enabled === "1" && hasHw && enrolled) void tryBiometric();
    })();
  }, []);

  useEffect(() => {
    if (lockRemainingSec == null || lockRemainingSec <= 0) return;
    const id = setInterval(() => {
      setLockRemainingSec((s) => (s == null || s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [lockRemainingSec != null && lockRemainingSec > 0]);

  async function tryBiometric() {
    const enabled = await SecureStore.getItemAsync("wms_bio_enabled");
    if (enabled !== "1") return;
    const hasHw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHw || !enrolled) return;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Workman Companion",
      fallbackLabel: "Use password",
    });
    if (result.success && useAuthStore.getState().isAuthenticated) {
      routeAfterLogin(useAuthStore.getState().employee?.role);
    }
  }

  function routeAfterLogin(role?: string | null) {
    if (role === "technician") router.replace("/(tabs)/dashboard" as never);
    else router.replace("/(tabs)/attendance");
  }

  async function finishLogin(emp: { id: string; role: string }) {
    await SecureStore.setItemAsync("wms_bio_enabled", "1");
    await registerForPushNotifications(emp.id);
    void hydrateEnrollmentEmbedding(emp.id).catch(() => {});
    if (emp.role === "technician") {
      // Raw Android/iOS permission dialogs only — no policy screen.
      await prepareTechnicianLocation(emp.id);
    }
    routeAfterLogin(emp.role);
  }

  async function onLogin() {
    if (!identifier.trim() || !password.trim()) {
      setErrorKind("credentials");
      setErrorMessage("Enter your username (or phone/email) and password.");
      return;
    }
    setLoading(true);
    setErrorKind(null);
    setErrorMessage(null);
    setLockRemainingSec(null);
    try {
      const { employee: emp } = await loginWithPassword({
        identifier: identifier.trim(),
        password,
      });
      await finishLogin(emp);
    } catch (e: unknown) {
      if (e instanceof LoginError) {
        setErrorKind(e.kind);
        if (e.kind === "deactivated") {
          setErrorMessage(
            e.message || "Your mobile access has been disabled — contact your admin or HR."
          );
        } else if (e.kind === "locked") {
          const secs =
            e.remainingSeconds ??
            (e.remainingMinutes != null ? e.remainingMinutes * 60 : null) ??
            (e.lockedUntil
              ? Math.max(
                  0,
                  Math.ceil((new Date(e.lockedUntil).getTime() - Date.now()) / 1000)
                )
              : null);
          setLockRemainingSec(secs);
          setErrorMessage(
            secs != null && secs > 0
              ? `Account locked. Try again in ${formatCountdown(secs)}.`
              : e.message || "Account is temporarily locked. Try again later."
          );
        } else if (e.kind === "device") {
          setErrorMessage(
            "This account is active on another phone. Sign out on that phone, or ask admin/HR to reset the mobile session."
          );
        } else {
          setErrorMessage(e.message);
        }
      } else {
        setErrorKind("unknown");
        setErrorMessage(e instanceof Error ? e.message : "Could not sign in. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const lockBanner = useMemo(() => {
    if (errorKind !== "locked") return null;
    if (lockRemainingSec != null && lockRemainingSec > 0) {
      return `Locked — try again after ${formatCountdown(lockRemainingSec)}`;
    }
    return errorMessage;
  }, [errorKind, lockRemainingSec, errorMessage]);

  if (SKIP_LOGIN) {
    return (
      <Redirect
        href={
          employee?.role === "technician" || !employee
            ? ("/(tabs)/dashboard" as never)
            : "/(tabs)/attendance"
        }
      />
    );
  }

  if (isHydrated && isAuthenticated) {
    return (
      <Redirect
        href={employee?.role === "technician" ? ("/(tabs)/dashboard" as never) : "/(tabs)/attendance"}
      />
    );
  }

  const lockedOut = errorKind === "locked" && (lockRemainingSec ?? 0) > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: space.xl,
          paddingBottom: space.xxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: space.xl }}>
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 24,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
              marginBottom: space.lg,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 8,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.2)",
            }}
          >
            <Image
              source={require("@/assets/workman-logo.png")}
              style={{ width: "100%", height: "100%", resizeMode: "contain" }}
            />
          </View>
          <Text
            style={{
              color: colors.primary,
              fontSize: 13,
              fontWeight: "900",
              letterSpacing: 1.8,
              textAlign: "center",
            }}
          >
            WORKMAN SERVICES
          </Text>
          <Text style={{ color: colors.text, marginTop: 4, textAlign: "center", ...type.hero }}>
            Field Companion
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              marginTop: space.xs,
              textAlign: "center",
              ...type.subtitle,
            }}
          >
            Sign in with your work username and password from admin or HR.
          </Text>
        </View>

        {errorKind === "deactivated" && (
          <InlineBanner title="Access disabled" detail={errorMessage ?? undefined} tone="error" />
        )}
        {errorKind === "locked" && (
          <InlineBanner
            title="Account locked"
            detail={
              lockBanner
                ? `${lockBanner} This is not a wrong-password error — wait, then try again.`
                : undefined
            }
            tone="warn"
          />
        )}
        {errorKind === "device" && (
          <InlineBanner title="Already signed in elsewhere" detail={errorMessage ?? undefined} tone="warn" />
        )}
        {(errorKind === "credentials" || errorKind === "unknown") && errorMessage && (
          <InlineBanner title="Could not sign in" detail={errorMessage} tone="error" />
        )}

        <Text style={{ color: colors.textDim, marginBottom: space.xs, ...type.label }}>
          Username
        </Text>
        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="username, phone, or email"
          placeholderTextColor={colors.textDim}
          editable={!lockedOut}
          accessibilityLabel="Username"
          style={inputStyle}
        />

        <Text
          style={{
            color: colors.textDim,
            marginTop: space.lg,
            marginBottom: space.xs,
            ...type.label,
          }}
        >
          Password
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Password from admin or HR"
          placeholderTextColor={colors.textDim}
          editable={!lockedOut}
          accessibilityLabel="Password"
          style={inputStyle}
        />

        <Button
          title="Sign in"
          loading={loading}
          onPress={onLogin}
          disabled={lockedOut}
          size="lg"
          style={{ marginTop: space.xl }}
        />

        {bioAvailable && (
          <Button
            title="Unlock with fingerprint"
            variant="secondary"
            size="lg"
            onPress={() => void tryBiometric()}
            style={{ marginTop: space.md }}
          />
        )}

        {__DEV__ ? (
          <Pressable
            onPress={() => router.push("/(auth)/switch-tenant")}
            style={{ marginTop: space.xl, minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: colors.textDim, textAlign: "center", ...type.caption }}>
              Connection settings
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

const inputStyle = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  color: colors.text,
  paddingHorizontal: space.lg,
  paddingVertical: 16,
  fontSize: 17,
  minHeight: 52,
} as const;
