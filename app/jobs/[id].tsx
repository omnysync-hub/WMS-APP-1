import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { JobItemList } from "@/components/job/JobItemList";
import { JobActionToolbar } from "@/components/job/JobActionToolbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { fetchJob, transitionJob } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import type { JobItem } from "@/types";

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const [items, setItems] = useState<JobItem[]>([]);

  const query = useQuery({
    queryKey: ["job", id],
    enabled: !!id,
    queryFn: () => fetchJob(id!),
  });

  useEffect(() => {
    if (query.data?.items) setItems(query.data.items);
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => transitionJob(id!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => Alert.alert("Action failed", e.message),
  });

  async function withGps(action: string) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    let lat: number | undefined;
    let lng: number | undefined;
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
    }
    await mutation.mutateAsync({
      action,
      lat,
      lng,
      actor: employee?.name ?? "Technician",
    });
  }

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const job = query.data;
  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Text style={{ color: colors.textDim }}>Job not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", flex: 1 }}>
            {job.jobNumber}
          </Text>
          <StatusBadge label={job.status} />
        </View>
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>
          {job.customerName ?? job.customer?.name}
        </Text>
        <Text style={{ color: colors.textDim, marginTop: 4 }}>
          {job.address ?? job.customer?.address}
        </Text>

        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 10 }}>
            Materials & actual usage
          </Text>
          <JobItemList
            items={items}
            editable={job.status === "InProgress"}
            onChangeActual={(itemId, qty) =>
              setItems((prev) =>
                prev.map((it) => (it.id === itemId ? { ...it, quantityActual: qty } : it))
              )
            }
          />
        </Card>

        <View style={{ marginTop: 14, gap: 10 }}>
          <Pressable onPress={() => router.push({ pathname: "/jobs/discount-modal", params: { jobId: id } })}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Request item discount</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: "/expenses/new", params: { jobId: id } })}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Claim expense / scan receipt</Text>
          </Pressable>
        </View>
      </ScrollView>

      <JobActionToolbar
        status={job.status}
        loading={mutation.isPending}
        onAccept={() =>
          mutation.mutate({ action: "accept", actor: employee?.name ?? "Technician" })
        }
        onStart={() => void withGps("start")}
        onPause={() =>
          router.push({
            pathname: "/jobs/pause-modal",
            params: { jobId: id },
          })
        }
        onComplete={() =>
          router.push({
            pathname: "/jobs/complete-modal",
            params: {
              jobId: id,
              itemsJson: JSON.stringify(items),
            },
          })
        }
      />
    </View>
  );
}
