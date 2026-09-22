import { Alert, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { refreshProfile, ensureDevSession } from "@/services/authService";
import { stopTelemetry } from "@/services/telemetryService";
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";
import { colors } from "@/constants/theme";
import { SKIP_LOGIN } from "@/constants/dev";
import { ERP_BASE_URL } from "@/services/api";

export default function ProfileScreen() {
  const router = useRouter();
  const { employee, logout, isTechnician } = useAuthStore();
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const tech = isTechnician();

  const profile = useQuery({
    queryKey: ["profile", employee?.id],
    enabled: !!employee?.id,
    queryFn: () => refreshProfile(employee!.id),
  });

  const emp = profile.data?.employee ?? employee;
  const advances = profile.data?.technicianData?.pendingAdvances ?? [];

  async function onLogout() {
    stopTelemetry();
    await logout();
    if (SKIP_LOGIN) {
      await ensureDevSession();
      router.replace("/(tabs)");
      return;
    }
    router.replace("/(auth)/login");
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
        {tech ? "Profile" : "My Profile"}
      </Text>

      <Card style={{ marginTop: 14 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
          {emp?.name}
        </Text>
        <Text style={{ color: colors.primary, marginTop: 4, fontWeight: "600" }}>
          {emp?.role}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>
          {emp?.designation ?? "—"} · {emp?.department ?? "—"}
        </Text>
        <Text style={{ color: colors.textDim, marginTop: 6, fontSize: 12 }}>
          {emp?.phone ?? emp?.email ?? emp?.id}
        </Text>
        {!!emp?.reportingManager && (
          <Text style={{ color: colors.textMuted, marginTop: 10, fontSize: 13 }}>
            Manager: {emp.reportingManager.name}
          </Text>
        )}
      </Card>

      {tech && (
        <Card style={{ marginTop: 12 }}>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>
            Field Hisaab (Advances)
          </Text>
          {advances.length === 0 ? (
            <Text style={{ color: colors.textDim }}>No open advances.</Text>
          ) : (
            advances.map((a: { id: string; amount?: number; status?: string }) => (
              <Text key={a.id} style={{ color: colors.textMuted, marginBottom: 4 }}>
                PKR {a.amount ?? 0} · {a.status}
              </Text>
            ))
          )}
          <Text style={{ color: colors.textDim, marginTop: 10, fontSize: 12 }}>
            Assigned tools & payslips sync from ERP when available.
          </Text>
        </Card>
      )}

      {!tech && (
        <Card style={{ marginTop: 12 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Employment</Text>
          <Text style={{ color: colors.textMuted, marginTop: 8 }}>
            Type: {emp?.employmentType ?? "—"}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>
            Joined: {emp?.joinDate ? String(emp.joinDate).slice(0, 10) : "—"}
          </Text>
          <Text style={{ color: colors.textDim, marginTop: 10, fontSize: 12 }}>
            Payslips appear here once generated in ERP HR.
          </Text>
        </Card>
      )}

      <Card style={{ marginTop: 12 }}>
        <Text style={{ color: colors.textDim, fontSize: 12 }}>ERP</Text>
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>{ERP_BASE_URL}</Text>
        <Text style={{ color: colors.textDim, marginTop: 8, fontSize: 12 }}>
          Offline queue: {pendingCount}
        </Text>
      </Card>

      <View style={{ marginTop: 16, gap: 10 }}>
          <Button
            title="Face enrollment"
            variant="secondary"
            onPress={() => router.push("/enrollment")}
          />
        <Button
          title="Switch Server"
          variant="secondary"
          onPress={() => router.push("/(auth)/switch-tenant")}
        />
        <Button
          title="Sign Out"
          variant="danger"
          onPress={() =>
            Alert.alert("Sign out?", "You will need your PIN again.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign Out", style: "destructive", onPress: onLogout },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}
