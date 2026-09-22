import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { JobCard } from "@/components/job/JobCard";
import { fetchJobs } from "@/services/jobsService";
import { fetchRequests } from "@/services/requestsService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import type { Job } from "@/types";

const FILTERS = ["All", "Assigned", "InProgress", "Paused", "Completed"] as const;

export default function JobsScreen() {
  const employee = useAuthStore((s) => s.employee);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const isTechnician = employee?.role === "technician";

  const jobsQuery = useQuery({
    queryKey: ["jobs", employee?.id, filter],
    enabled: !!employee?.id && isTechnician,
    queryFn: () =>
      fetchJobs(
        employee!.id,
        filter === "All" ? undefined : filter === "Completed" ? "Completed" : filter
      ),
  });

  const requestsQuery = useQuery({
    queryKey: ["requests", employee?.id],
    enabled: !!employee?.id && isTechnician,
    queryFn: () => fetchRequests(employee!.id),
  });

  const jobs: Job[] = useMemo(() => {
    const list = jobsQuery.data ?? [];
    if (filter === "All") return list;
    if (filter === "Completed") {
      return list.filter((j) =>
        String(j.status).toLowerCase().includes("completed")
      );
    }
    return list.filter((j) => j.status === filter);
  }, [jobsQuery.data, filter]);

  if (employee && !isTechnician) {
    return <Redirect href="/(tabs)/attendance" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>My Jobs</Text>
        <Text style={{ color: colors.primary, fontWeight: "700" }}>
          {requestsQuery.data?.unreadCount ?? 0} alerts
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: filter === f ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: filter === f ? colors.primary : colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
              {f === "InProgress" ? "In Progress" : f}
            </Text>
          </Pressable>
        ))}
      </View>

      {jobsQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={jobsQuery.isRefetching}
              onRefresh={() => jobsQuery.refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={{ color: colors.textDim, textAlign: "center", marginTop: 40 }}>
              No jobs in this filter.
            </Text>
          }
          renderItem={({ item }) => <JobCard job={item} />}
        />
      )}
    </View>
  );
}
