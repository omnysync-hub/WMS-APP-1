import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { LayoutDashboard, Briefcase, Receipt, Clock, CalendarDays, User } from "lucide-react-native";
import { useAuthStore } from "@/store/authStore";
import { SKIP_LOGIN } from "@/constants/dev";
import { colors } from "@/constants/theme";
import { useLiveRequestsStream } from "@/hooks/useLiveRequestsStream";

export default function TabLayout() {
  const { employee, isAuthenticated, isHydrated } = useAuthStore();
  const isTechnician = employee?.role === "technician";

  useLiveRequestsStream(employee?.id, isAuthenticated && !!isTechnician);

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
  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceElevated,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "800" },
        tabBarIconStyle: { marginBottom: -2 },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={25} />,
          href: isTechnician ? ("/dashboard" as never) : null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color }) => <Briefcase color={color} size={26} />,
          href: isTechnician ? "/" : null,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color }) => <Receipt color={color} size={25} />,
          href: isTechnician ? ("/expenses" as never) : null,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          href: null,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color }) => <Clock color={color} size={26} />,
        }}
      />
      <Tabs.Screen
        name="leaves"
        options={{
          title: "Leaves",
          tabBarIcon: ({ color }) => <CalendarDays color={color} size={25} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User color={color} size={26} />,
        }}
      />
    </Tabs>
  );
}
