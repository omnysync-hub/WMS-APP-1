import { ScrollView, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { refreshProfile } from "@/services/authService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";

function humanizeRole(role?: string | null) {
  if (!role) return "Team member";
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProfileScreen() {
  const employee = useAuthStore((s) => s.employee);

  const profile = useQuery({
    queryKey: ["profile", employee?.id],
    enabled: !!employee?.id,
    queryFn: () => refreshProfile(employee!.id),
  });

  const emp = profile.data?.employee ?? employee;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>Profile</Text>

      <Card style={{ marginTop: 14 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{emp?.name}</Text>
        <Text style={{ color: colors.primary, marginTop: 4, fontWeight: "600" }}>{humanizeRole(emp?.role)}</Text>
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>
          {emp?.designation ?? "—"} · {emp?.department ?? "—"}
        </Text>
        {emp?.phone || emp?.email ? (
          <Text style={{ color: colors.textDim, marginTop: 6, fontSize: 12 }}>
            {[emp.phone, emp.email].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {emp?.employmentType ? (
          <Text style={{ color: colors.textDim, marginTop: 6, fontSize: 12 }}>
            {humanizeRole(emp.employmentType)}
          </Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}
