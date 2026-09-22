import "../global.css";
import { useEffect, type ReactNode } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "@/store/authStore";
import { initDatabase } from "@/db/database";
import { OfflineNotice } from "@/components/ui/OfflineNotice";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { bootstrapFaceModels } from "@/services/face/modelBootstrap";
import { ensureDevSession } from "@/services/authService";
import { SKIP_LOGIN } from "@/constants/dev";
import { colors } from "@/constants/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
  },
});

function Bootstrap({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  useNetworkStatus();

  useEffect(() => {
    void initDatabase();
    void (async () => {
      await hydrate();
      if (SKIP_LOGIN) await ensureDevSession();
    })();
    void bootstrapFaceModels();
  }, [hydrate]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <QueryClientProvider client={queryClient}>
        <Bootstrap>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/switch-tenant" options={{ title: "Server" }} />
            <Stack.Screen name="leaves/apply" options={{ title: "Apply Leave", presentation: "modal" }} />
            <Stack.Screen name="leaves/[id]" options={{ title: "Leave Detail" }} />
            <Stack.Screen name="jobs/[id]" options={{ title: "Job" }} />
            <Stack.Screen name="jobs/pause-modal" options={{ title: "Pause Job", presentation: "modal" }} />
            <Stack.Screen name="jobs/complete-modal" options={{ title: "Complete Job", presentation: "modal" }} />
            <Stack.Screen name="jobs/discount-modal" options={{ title: "Request Discount", presentation: "modal" }} />
            <Stack.Screen name="enrollment/index" options={{ title: "Face Enrollment" }} />
            <Stack.Screen name="expenses/new" options={{ title: "Claim Expense", presentation: "modal" }} />
          </Stack>
          <OfflineNotice />
        </Bootstrap>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
