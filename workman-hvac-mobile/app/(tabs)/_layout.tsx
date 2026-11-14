import React from "react";
import { Tabs } from "expo-router";
import { Snowflake, Gauge, Wrench, RotateCcw, User } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#121215",
          borderTopColor: "#27272A",
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#06B6D4",
        tabBarInactiveTintColor: "#71717A",
        headerStyle: { backgroundColor: "#121215" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "HVAC Units",
          tabBarLabel: "Units",
          tabBarIcon: ({ color, size }) => <Snowflake color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="testing"
        options={{
          title: "Bench Test Station",
          tabBarLabel: "Testing",
          tabBarIcon: ({ color, size }) => <Gauge color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "HVAC Equipment",
          tabBarLabel: "Tools",
          tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scrap"
        options={{
          title: "Compressors & Scrap",
          tabBarLabel: "Scrap",
          tabBarIcon: ({ color, size }) => <RotateCcw color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Bench Tech",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
