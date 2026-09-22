import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react-native";
import { LeaveBalanceCard } from "@/components/leaves/LeaveBalanceCard";
import { LeaveRequestCard } from "@/components/leaves/LeaveRequestCard";
import { LeaveCalendar } from "@/components/leaves/LeaveCalendar";
import { fetchLeaves } from "@/services/leavesService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import type { LeaveRequest } from "@/types";

export default function LeavesScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);

  const query = useQuery({
    queryKey: ["leaves", employee?.id],
    enabled: !!employee?.id,
    queryFn: () => fetchLeaves(employee!.id),
  });

  const balances = query.data?.balances ?? {};
  const requests: LeaveRequest[] = query.data?.requests ?? [];
  const holidays = query.data?.holidays ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
          Leave Portal
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: 14 }}>
          Balances, applications & holidays
        </Text>

        {query.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <LeaveBalanceCard title="Annual" balance={balances.annual} />
              <LeaveBalanceCard title="Casual" balance={balances.casual} />
              <LeaveBalanceCard title="Sick" balance={balances.sick} />
              <LeaveBalanceCard
                title="Unpaid / LWP"
                balance={
                  balances.unpaid ?? {
                    leaveTypeId: "unpaid",
                    name: "Unpaid",
                    allocated: 0,
                    used: balances.unpaid?.used ?? 0,
                    remaining: 0,
                  }
                }
              />
            </View>

            <Text style={{ color: colors.text, fontWeight: "700", marginTop: 22, marginBottom: 10 }}>
              Requests
            </Text>
            {requests.length === 0 ? (
              <Text style={{ color: colors.textDim }}>No leave requests yet.</Text>
            ) : (
              requests.map((r) => (
                <LeaveRequestCard
                  key={r.id}
                  request={r}
                  onPress={() => router.push(`/leaves/${r.id}`)}
                />
              ))
            )}

            <View style={{ marginTop: 16 }}>
              <LeaveCalendar holidays={holidays} />
            </View>
          </>
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/leaves/apply")}
        style={{
          position: "absolute",
          right: 20,
          bottom: 28,
          backgroundColor: colors.primary,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          elevation: 4,
        }}
        accessibilityLabel="Apply for leave"
      >
        <Plus color={colors.text} size={26} />
      </Pressable>
    </View>
  );
}
