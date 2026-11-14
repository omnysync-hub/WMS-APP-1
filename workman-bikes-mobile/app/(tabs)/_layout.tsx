import React from "react";
import { Tabs } from "expo-router";
import { Bike, Wrench, RotateCcw, User } from "lucide-react-native";

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
        tabBarActiveTintColor: "#F59E0B",
        tabBarInactiveTintColor: "#71717A",
        headerStyle: { backgroundColor: "#121215" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "My Jobs",
          tabBarLabel: "Jobs",
          tabBarIcon: ({ color, size }) => <Bike color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Workshop Tools",
          tabBarLabel: "Tools",
          tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scrap"
        options={{
          title: "Scrap & Parts",
          tabBarLabel: "Scrap",
          tabBarIcon: ({ color, size }) => <RotateCcw color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Mechanic Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
