import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react-native";
import { JobCard } from "@/components/job/JobCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { batchAcceptJobs, fetchJobs, transitionJob } from "@/services/jobsService";
import { isTechnicianDoneStatus } from "@/lib/jobLineFormat";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRequests } from "@/services/requestsService";
import { useAuthStore } from "@/store/authStore";
import { colors, radius, space, tapMin, type } from "@/constants/theme";
import { haptic } from "@/lib/haptics";
import type { Job } from "@/types";

const FILTERS = [
  { id: "All", label: "All" },
  { id: "Assigned", label: "New" },
  { id: "InProgress", label: "Working" },
  { id: "Paused", label: "Paused" },
  { id: "InvPending", label: "Parts pending" },
  { id: "InvIssued", label: "Parts issued" },
  { id: "Completed", label: "Done" },
] as const;

export default function JobsScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("All");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const queryClient = useQueryClient();
  const isTechnician = employee?.role === "technician";
  const firstName = employee?.name?.trim().split(/\s+/)[0] ?? "there";

  const jobsQuery = useQuery({
    queryKey: ["jobs", employee?.id, filter],
    enabled: !!employee?.id && isTechnician,
    queryFn: () =>
      fetchJobs(
        employee!.id,
        filter === "All" ||
          filter === "Completed" ||
          filter === "InvPending" ||
          filter === "InvIssued"
          ? undefined
          : filter
      ),
  });

  const requestsQuery = useQuery({
    queryKey: ["requests", employee?.id],
    enabled: !!employee?.id && isTechnician,
    queryFn: () => fetchRequests(employee!.id),
  });

  const unread = requestsQuery.data?.unreadCount ?? 0;

  const jobs: Job[] = useMemo(() => {
    const list = (jobsQuery.data ?? []).filter((j) => j.status !== "TechnicianReassigned");
    if (filter === "All") return list;
    if (filter === "Completed") {
      // AwaitingFeedback / CompletedPendingVerification / Finalized / Verified are all done for the tech
      return list.filter((j) => isTechnicianDoneStatus(String(j.status)));
    }
    if (filter === "InvPending") {
      return list.filter((j) =>
        Array.isArray(j.inventoryRequests) &&
        j.inventoryRequests.some((r) => (r.status || "pending").toLowerCase() === "pending")
      );
    }
    if (filter === "InvIssued") {
      return list.filter(
        (j) =>
          (Array.isArray(j.inventoryRequests) &&
            j.inventoryRequests.some((r) => (r.status || "").toLowerCase() === "issued")) ||
          (Array.isArray(j.items) &&
            j.items.some((it) =>
              (it.description ?? it.name ?? "").includes("[Issued by Storekeeper]")
            ))
      );
    }
    return list.filter((j) => j.status === filter);
  }, [jobsQuery.data, filter]);

  const assignedJobs = useMemo(
    () => jobs.filter((j) => j.status === "Assigned"),
    [jobs]
  );

  const acceptOneMutation = useMutation({
    mutationFn: async (jobId: string) => {
      setAcceptingId(jobId);
      await transitionJob(jobId, {
        action: "accept",
        actor: employee!.name ?? "Technician",
        technicianId: employee!.id,
      });
    },
    onSettled: () => setAcceptingId(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const batchMutation = useMutation({
    mutationFn: () => batchAcceptJobs(selectedIds, employee!.id),
    onSuccess: async () => {
      setSelectedIds([]);
      setSelectMode(false);
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (employee && !isTechnician) {
    return <Redirect href="/(tabs)/attendance" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: space.lg }}>
      <ScreenHeader
        title={`Hi, ${firstName}`}
        subtitle="Your assigned jobs — tap one to open it"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Requests, ${unread} unread`}
            onPress={() => {
              void haptic.tap();
              router.push("/(tabs)/requests");
            }}
            style={{
              backgroundColor: unread > 0 ? colors.urgent : colors.surface,
              borderWidth: 1,
              borderColor: unread > 0 ? colors.urgent : colors.border,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              minHeight: tapMin,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Bell size={18} color={unread > 0 ? "#fff" : colors.primary} />
            <Text
              style={{
                color: unread > 0 ? "#fff" : colors.text,
                fontWeight: "800",
                fontSize: 14,
              }}
            >
              {unread}
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: space.sm,
          paddingVertical: 2,
          alignItems: "center",
          paddingRight: space.lg,
        }}
        style={{ flexGrow: 0, maxHeight: 56, marginBottom: space.lg }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                void haptic.select();
                setFilter(f.id);
              }}
              style={{
                paddingHorizontal: space.lg,
                minHeight: tapMin,
                justifyContent: "center",
                borderRadius: radius.full,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: colors.text, ...type.label }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {jobsQuery.isError ? (
        <InlineBanner
          title="Couldn’t load jobs"
          detail="Pull down to try again, or check your connection."
          tone="error"
        />
      ) : null}

      {assignedJobs.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: space.md,
            gap: space.sm,
          }}
        >
          <Pressable
            onPress={() => {
              void haptic.select();
              setSelectMode((v) => !v);
              setSelectedIds([]);
            }}
            style={{
              paddingHorizontal: space.md,
              minHeight: tapMin,
              justifyContent: "center",
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: selectMode ? colors.primary : colors.surface,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>
              {selectMode ? "Cancel select" : "Select jobs"}
            </Text>
          </Pressable>
          {selectMode ? (
            <Pressable
              disabled={selectedIds.length === 0 || batchMutation.isPending}
              onPress={() => {
                void haptic.tap();
                batchMutation.mutate();
              }}
              style={{
                paddingHorizontal: space.lg,
                minHeight: tapMin,
                justifyContent: "center",
                borderRadius: radius.full,
                backgroundColor: selectedIds.length === 0 ? colors.surface : colors.primary,
                opacity: selectedIds.length === 0 ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
                {batchMutation.isPending
                  ? "Accepting..."
                  : "Accept " + selectedIds.length}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: colors.textDim, fontSize: 12 }}>
              {assignedJobs.length} waiting to accept
            </Text>
          )}
        </View>
      ) : null}

      {jobsQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
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
            <EmptyState
              title="No jobs right now"
              message="Pull down to refresh, or try another filter."
            />
          }
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {selectMode && item.status === "Assigned" ? (
                <Pressable
                  onPress={() => toggleSelect(item.id)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedIds.includes(item.id) ? colors.primary : colors.border,
                    backgroundColor: selectedIds.includes(item.id) ? colors.primary : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>
                    {selectedIds.includes(item.id) ? "OK" : ""}
                  </Text>
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }}>
                <JobCard
                  job={item}
                  accepting={acceptingId === item.id}
                  onAccept={(jobId) => acceptOneMutation.mutate(jobId)}
                />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
