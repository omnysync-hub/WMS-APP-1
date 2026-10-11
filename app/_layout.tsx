import "@/services/telemetryBackgroundTask";
import "../global.css";
import { useEffect, type ReactNode } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "@/store/authStore";
import { initDatabase } from "@/db/database";
import { OfflineNotice } from "@/components/ui/OfflineNotice";
import { ToastHost } from "@/components/ui/ToastHost";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  attachPushListeners,
  registerForPushNotifications,
} from "@/services/pushNotificationService";
import { startJobDispatchWatcher } from "@/services/jobDispatchWatcher";
import { bootstrapFaceModels } from "@/services/face/modelBootstrap";
import { ensureDevSession } from "@/services/authService";
import { resumeTechnicianLocationOnLaunch } from "@/services/technicianLocationGate";
import { SKIP_LOGIN } from "@/constants/dev";
import { colors } from "@/constants/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
  },
});

function Bootstrap({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const employee = useAuthStore((s) => s.employee);
  const router = useRouter();
  useNetworkStatus();

  useEffect(() => {
    void initDatabase();
    void (async () => {
      await hydrate();
      if (SKIP_LOGIN) await ensureDevSession();
      const { employee: emp, isAuthenticated: ok } = useAuthStore.getState();
      if (ok && emp?.role === "technician" && emp.id) {
        // OS permission dialogs only — never show the old policy screen.
        await resumeTechnicianLocationOnLaunch(emp.id);
      }
    })();
    void bootstrapFaceModels();
  }, [hydrate, router]);

  useEffect(() => {
    const detach = attachPushListeners();
    if (isAuthenticated && employee?.id) {
      void registerForPushNotifications(employee.id);
    }
    return detach;
  }, [isAuthenticated, employee?.id]);

  useEffect(() => {
    if (!isAuthenticated || !employee?.id || employee.role !== "technician") return;
    return startJobDispatchWatcher(employee.id, () => {
      queryClient.invalidateQueries({ queryKey: ["requests", employee.id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    });
  }, [isAuthenticated, employee?.id, employee?.role]);

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
            <Stack.Screen name="jobs/[id]" options={{ title: "Job details" }} />
            <Stack.Screen
              name="jobs/inventory-request"
              options={{ title: "Need parts", presentation: "modal" }}
            />
            <Stack.Screen name="jobs/pause-modal" options={{ title: "Pause for today", presentation: "modal" }} />
            <Stack.Screen name="jobs/complete-modal" options={{ title: "Finish & payment", presentation: "modal" }} />
            <Stack.Screen name="jobs/discount-modal" options={{ title: "Ask discount", presentation: "modal" }} />
            <Stack.Screen name="jobs/add-services" options={{ title: "Add services", presentation: "modal" }} />
            <Stack.Screen name="enrollment/index" options={{ title: "Face Enrollment" }} />
            <Stack.Screen name="expenses/new" options={{ title: "Log expense", presentation: "modal" }} />
          </Stack>
          <OfflineNotice />
          <ToastHost />
        </Bootstrap>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
