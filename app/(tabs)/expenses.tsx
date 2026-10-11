import { useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Receipt } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { fetchJobs } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors, radius, space, tapMin, type } from "@/constants/theme";

function money(value: number) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

export default function ExpensesScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);
  const isTechnician = employee?.role === "technician";
  const query = useQuery({
    queryKey: ["jobs", employee?.id, "expenses"],
    enabled: !!employee?.id && isTechnician,
    queryFn: () => fetchJobs(employee!.id),
  });
  const data = useMemo(() => {
    const jobs = query.data ?? [];
    const claims = jobs.flatMap((job) => (job.expenseClaims ?? []).map((claim) => ({ ...claim, jobId: job.id, jobNumber: job.jobNumber })));
    const groups = new Map<string, {
      id: string;
      amount: number;
      note: string;
      category: string;
      createdAt?: string | null;
      jobNumbers: string[];
      pending: boolean;
    }>();
    for (const claim of claims) {
      const id = claim.allocationGroupId || claim.id;
      const existing = groups.get(id);
      const category = claim.category || claim.note?.match(/^\[([^\]]+)\]/)?.[1] || "Expense";
      const note = claim.category ? (claim.note || `${category} expense`) : (claim.note || "Field expense").replace(/^\[[^\]]+\]\s*/, "");
      if (existing) {
        existing.amount += Number(claim.amount || 0);
        existing.jobNumbers.push(claim.jobNumber);
        existing.pending ||= (claim.status ?? "pending").toLowerCase() !== "paid";
      } else {
        groups.set(id, {
          id,
          amount: Number(claim.amount || 0),
          note,
          category,
          createdAt: claim.createdAt,
          jobNumbers: [claim.jobNumber],
          pending: (claim.status ?? "pending").toLowerCase() !== "paid",
        });
      }
    }
    const expenses = [...groups.values()].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    return {
      expenses,
      total: expenses.reduce((sum, expense) => sum + expense.amount, 0),
      pending: expenses.filter((expense) => expense.pending).reduce((sum, expense) => sum + expense.amount, 0),
    };
  }, [query.data]);

  if (employee && !isTechnician) return <Redirect href="/(tabs)/attendance" />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.primary} />}
    >
      <ScreenHeader title="Expenses" subtitle="Record field costs separately from your jobs." />
      {query.isLoading ? <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} /> : query.isError ? (
        <View style={{ marginTop: space.lg }}>
          <InlineBanner
            title="Couldn't load expenses"
            detail="Your totals and expense history are temporarily unavailable."
            tone="error"
          />
          <Button title="Try again" onPress={() => void query.refetch()} />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <Card style={{ flex: 1 }}><Text style={{ color: colors.textDim, ...type.caption }}>Submitted</Text><Text style={{ color: colors.text, fontWeight: "900", fontSize: 19, marginTop: 6 }}>{money(data.total)}</Text></Card>
            <Card style={{ flex: 1 }}><Text style={{ color: colors.textDim, ...type.caption }}>Pending</Text><Text style={{ color: colors.high, fontWeight: "900", fontSize: 19, marginTop: 6 }}>{money(data.pending)}</Text></Card>
          </View>

          <Text style={{ color: colors.text, ...type.title, marginTop: space.xl, marginBottom: space.sm }}>Record an expense</Text>
          <Text style={{ color: colors.textMuted, ...type.subtitle, marginBottom: space.md }}>Enter it once. The app divides it equally across the jobs you handled that day.</Text>
          <Pressable onPress={() => router.push("/expenses/new")} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
            <View style={addButton}><Plus size={20} color="#fff" /><Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>Add expense</Text></View>
          </Pressable>

          <Text style={{ color: colors.text, ...type.title, marginTop: space.xl, marginBottom: space.md }}>Recent expenses</Text>
          {data.expenses.length === 0 ? <EmptyState title="No expenses yet" message="Your submitted field costs will appear here." /> : data.expenses.slice(0, 20).map((expense) => (
              <Card key={expense.id} style={{ marginBottom: space.sm, flexDirection: "row", alignItems: "center", gap: space.md }}>
                <View style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" }}><Receipt size={20} color={colors.primary} /></View>
                <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: "800" }}>{expense.category} · {expense.note}</Text><Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3 }}>{expense.jobNumbers.length} {expense.jobNumbers.length === 1 ? "job" : "jobs"} · {expense.pending ? "pending" : "paid"}</Text></View>
                <Text style={{ color: colors.text, fontWeight: "900" }}>{money(expense.amount)}</Text>
              </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const addButton = { minHeight: tapMin + 6, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 };
