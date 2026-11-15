import React, { useEffect } from "react";
import { Platform, View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "../global.css";
import { useAuthStore } from "@/store/authStore";

// Safeguard for NativeWind on web
if (Platform.OS === "web") {
  try {
    const { StyleSheet } = require("react-native-css-interop");
    if (StyleSheet && typeof StyleSheet.setFlag === "function") {
      StyleSheet.setFlag("darkMode", "class dark");
    }
  } catch (e) {
    // ignore
  }
}

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Wait for the stored session to be restored before choosing a route,
  // otherwise a signed-in user would bounce through the login screen.
  if (!isHydrated) {
    return (
      <View className="flex-1 bg-[#09090B] items-center justify-center">
        <StatusBar style="light" />
        <ActivityIndicator color="#06B6D4" size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#121215" },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: { fontWeight: "bold" },
          contentStyle: { backgroundColor: "#09090B" },
        }}
      >
        {/* Signed-in area — inaccessible (incl. via deep link) while signed out. */}
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="jobs/[id]"
            options={{
              title: "HVAC Bench Card",
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="jobs/new"
            options={{
              title: "New HVAC Intake",
              presentation: "modal",
            }}
          />
        </Stack.Protected>

        {/* Sign-in — only reachable while signed out. */}
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
