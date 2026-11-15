import React, { useEffect } from "react";
import { Platform, View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/store/authStore";
import "../global.css";

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
  const router = useRouter();
  const segments = useSegments();
  const hydrate = useAuthStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    const onLoginScreen = segments[0] === "login";
    if (!isAuthenticated && !onLoginScreen) {
      router.replace("/login");
    } else if (isAuthenticated && onLoginScreen) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isHydrated, segments, router]);

  if (!isHydrated) {
    return (
      <View className="flex-1 bg-[#09090B] items-center justify-center">
        <ActivityIndicator color="#F59E0B" size="large" />
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
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="jobs/[id]"
          options={{
            title: "Bike Job Card",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="jobs/new"
          options={{
            title: "New Bike Intake",
            presentation: "modal",
          }}
        />
      </Stack>
    </>
  );
}
