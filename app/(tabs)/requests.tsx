import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequestCard } from "@/components/requests/RequestCard";
import { fetchRequests, respondToRequest } from "@/services/requestsService";
import { useLiveRequestsStream } from "@/hooks/useLiveRequestsStream";
import { useAuthStore } from "@/store/authStore";
import { stopContinuousJobRing, markJobAsAccepted } from "@/services/jobAssignmentAlert";
import { colors } from "@/constants/theme";

export default function RequestsScreen() {
  const employee = useAuthStore((s) => s.employee);
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const isTechnician = employee?.role === "technician";

  useLiveRequestsStream(employee?.id, isTechnician);

  const query = useQuery({
    queryKey: ["requests", employee?.id],
    enabled: !!employee?.id && isTechnician,
    queryFn: () => fetchRequests(employee!.id),
    refetchInterval: 20_000,
  });

  const mutation = useMutation({
    mutationFn: async (args: {
      id: string;
      actionStatus: "accepted" | "rejected" | "acknowledged";
      notes?: string;
    }) => {
      if (args.actionStatus === "accepted") {
        await markJobAsAccepted(undefined, args.id, employee?.id);
      }
      const res = await respondToRequest(args.id, {
        employeeId: employee!.id,
        actionStatus: args.actionStatus,
        notes: args.notes,
        etaMinutes: args.actionStatus === "accepted" ? 15 : undefined,
      });
      if (args.actionStatus === "accepted") {
        await markJobAsAccepted(undefined, args.id, employee?.id);
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  if (employee && !isTechnician) {
    return <Redirect href="/(tabs)/attendance" />;
  }

  async function act(
    id: string,
    actionStatus: "accepted" | "rejected" | "acknowledged"
  ) {
    setBusyId(id);
    try {
      await mutation.mutateAsync({
        id,
        actionStatus,
        notes: actionStatus === "accepted" ? "En route" : undefined,
      });
    } catch (e: unknown) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Could not respond");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>
        Alerts
      </Text>
      <Text style={{ color: colors.textMuted, marginBottom: 14 }}>
        New jobs, parts ready, and discount updates
      </Text>

      {query.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={query.data?.requests ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={{ color: colors.textDim, textAlign: "center", marginTop: 40 }}>
              No pending requests.
            </Text>
          }
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              busy={busyId === item.id}
              onAccept={() => act(item.id, "accepted")}
              onDecline={() => act(item.id, "rejected")}
              onAck={() => act(item.id, "acknowledged")}
            />
          )}
        />
      )}
    </View>
  );
}
