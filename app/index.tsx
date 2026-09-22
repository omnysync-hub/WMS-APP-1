import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { SKIP_LOGIN } from "@/constants/dev";
import { colors } from "@/constants/theme";

export default function Index() {
  const { isAuthenticated, isHydrated, employee } = useAuthStore();

  if (!isHydrated || (SKIP_LOGIN && !isAuthenticated)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    if (SKIP_LOGIN) return <Redirect href="/(tabs)" />;
    return <Redirect href="/(auth)/login" />;
  }

  if (employee?.role === "technician") return <Redirect href="/(tabs)" />;
  return <Redirect href="/(tabs)/attendance" />;
}
