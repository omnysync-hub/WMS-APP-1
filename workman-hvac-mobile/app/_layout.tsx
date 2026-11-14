import React from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
      </Stack>
    </>
  );
}
