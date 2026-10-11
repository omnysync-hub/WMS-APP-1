import { useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Briefcase, ChevronRight, Package, Receipt } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { fetchJobs } from "@/services/jobsService";
import { fetchRequests } from "@/services/requestsService";
import { useAuthStore } from "@/store/authStore";
import { colors, radius, space, tapMin, type } from "@/constants/theme";
import { isTechnicianDoneStatus, parseJobLine } from "@/lib/jobLineFormat";
import type { Job } from "@/types";

function sameDay(value: string | null | undefined, date: Date) {
  if (!value) return false;
  const d = new Date(value);
  return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
}

function money(value: number) {
  return `PKR ${Math.round(value).toLocaleString()}`;
}

function jobValue(job: Job) {
  return (job.items ?? []).reduce((sum, item) => {
    const qty = Number(item.quantityActual ?? item.quantityPlanned ?? 0);
    const rate = Number(item.unitRate ?? item.unitPrice ?? 0);
    return sum + (Number.isFinite(qty * rate) ? qty * rate : 0);
  }, 0);
}

function issuedInventoryValue(job: Job) {
  return (job.items ?? []).reduce((sum, item) => {
    const line = parseJobLine(item);
    if (line.isService) return sum;
    const qty = Number(item.quantityActual ?? item.quantityPlanned ?? 0);
    const rate = Number(item.unitRate ?? item.unitPrice ?? 0);
    return sum + (Number.isFinite(qty * rate) ? qty * rate : 0);
  }, 0);
}

export default function DashboardScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);
  const isTechnician = employee?.role === "technician";
  const jobsQuery = useQuery({
    queryKey: ["jobs", employee?.id, "dashboard"],
    enabled: !!employee?.id && isTechnician,
    queryFn: () => fetchJobs(employee!.id),
  });
  const requestsQuery = useQuery({
    queryKey: ["requests", employee?.id],
    enabled: !!employee?.id && isTechnician,
    queryFn: () => fetchRequests(employee!.id),
  });

  const summary = useMemo(() => {
    const jobs = (jobsQuery.data ?? []).filter((j) => j.status !== "TechnicianReassigned");
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const active = jobs.filter((j) => !isTechnicianDoneStatus(String(j.status)) && j.status !== "Cancelled");
    return {
      jobs,
      active,
      newJobs: jobs.filter((j) => j.status === "Assigned").length,
      accepted: jobs.filter((j) => j.status === "Accepted").length,
      today: jobs.filter((j) => sameDay(j.scheduledAt ?? j.createdAt, now)).length,
      week: jobs.filter((j) => {
        const value = j.scheduledAt ?? j.createdAt;
        if (!value) return false;
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date >= weekStart && date < weekEnd;
      }).length,
      inventoryValue: active.reduce((sum, j) => sum + issuedInventoryValue(j), 0),
      paymentTarget: active.reduce((sum, j) => sum + Math.max(0, jobValue(j) - Number(j.discountAmount ?? 0)), 0),
    };
  }, [jobsQuery.data]);

  if (employee && !isTechnician) return <Redirect href="/(tabs)/attendance" />;
  const firstName = employee?.name?.trim().split(/\s+/)[0] ?? "there";
  const unread = requestsQuery.data?.unreadCount ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={jobsQuery.isRefetching} onRefresh={() => jobsQuery.refetch()} tintColor={colors.primary} />}
    >
      <ScreenHeader
        title={`Good day, ${firstName}`}
        subtitle="Here is your field work at a glance."
        right={
          <Pressable onPress={() => router.push("/(tabs)/requests")} style={alertButton} accessibilityLabel={`${unread} unread requests`}>
            <Bell size={20} color="#fff" />
            {unread > 0 ? <Text style={{ color: "#fff", fontWeight: "900" }}>{unread}</Text> : null}
          </Pressable>
        }
      />

      {jobsQuery.isError ? <InlineBanner title="Dashboard unavailable" detail="Pull down to try again." tone="error" /> : null}
      {jobsQuery.isLoading ? <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 48 }} /> : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            {[
              ["New", summary.newJobs, colors.urgent],
              ["Accepted", summary.accepted, colors.primary],
              ["Today", summary.today, colors.high],
              ["This week", summary.week, colors.success],
            ].map(([label, value, tone]) => (
              <Card key={String(label)} style={{ width: "47%", minHeight: 104, borderTopWidth: 3, borderTopColor: String(tone) }}>
                <Text style={{ color: colors.textDim, ...type.label }}>{label}</Text>
                <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 8 }}>{value}</Text>
              </Card>
            ))}
          </View>

          <Text style={{ color: colors.text, ...type.title, marginTop: space.xl, marginBottom: space.md }}>{"Money & materials"}</Text>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Card style={{ minHeight: 122 }}>
                <Package size={22} color={colors.high} />
                <Text style={{ color: colors.textDim, ...type.caption, marginTop: 10 }}>Issued job value</Text>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 }}>{money(summary.inventoryValue)}</Text>
              </Card>
            </View>
            <View style={{ flex: 1 }}>
              <Card style={{ minHeight: 122 }}>
                <Receipt size={22} color={colors.success} />
                <Text style={{ color: colors.textDim, ...type.caption, marginTop: 10 }}>Payment target</Text>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 }}>{money(summary.paymentTarget)}</Text>
              </Card>
            </View>
          </View>
          <Text style={{ color: colors.textDim, fontSize: 11, lineHeight: 16, marginTop: 8 }}>Estimated amount to collect. The final amount appears when you finish the job.</Text>

          <Pressable onPress={() => router.push("/(tabs)")} style={primaryLink}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Briefcase size={22} color="#fff" />
              <View>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Open all jobs</Text>
                <Text style={{ color: "#D1FAE5", fontSize: 12, marginTop: 2 }}>{summary.active.length} active jobs</Text>
              </View>
            </View>
            <ChevronRight size={22} color="#fff" />
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const alertButton = { minWidth: tapMin, minHeight: tapMin, borderRadius: radius.md, backgroundColor: colors.urgent, flexDirection: "row" as const, gap: 6, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 12 };
const primaryLink = { marginTop: space.xl, minHeight: 76, borderRadius: radius.lg, backgroundColor: colors.primary, paddingHorizontal: space.lg, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const };
