import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "../global.css";

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
