import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Briefcase, Bell, Clock, Calendar, User } from "lucide-react-native";
import { useAuthStore } from "@/store/authStore";
import { SKIP_LOGIN } from "@/constants/dev";
import { colors } from "@/constants/theme";

export default function TabLayout() {
  const { employee, isAuthenticated, isHydrated } = useAuthStore();

  if (!isHydrated || (SKIP_LOGIN && !isAuthenticated)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isHydrated && !isAuthenticated && !SKIP_LOGIN) {
    return <Redirect href="/(auth)/login" />;
  }

  const isTechnician = employee?.role === "technician";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceElevated,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
          href: isTechnician ? "/" : null,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
          href: isTechnician ? "/requests" : null,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="leaves"
        options={{
          title: isTechnician ? "Leaves" : "Leave Portal",
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: isTechnician ? "Profile" : "My Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
