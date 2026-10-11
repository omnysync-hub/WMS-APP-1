import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  View,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  PhoneCall,
  Receipt,
  Percent,
  BadgePercent,
  Wrench,
} from "lucide-react-native";
import { JobItemList } from "@/components/job/JobItemList";
import { JobOverviewCard } from "@/components/job/JobOverviewCard";
import {
  JobSectionPanel,
  JobSectionTabs,
  buildJobTabs,
  type JobSectionId,
} from "@/components/job/JobSectionTabs";
import { technicianJobStatus } from "@/lib/jobLineFormat";
import { JobActionToolbar } from "@/components/job/JobActionToolbar";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { fetchJob, transitionJob } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import { OFFICE, STOREKEEPER } from "@/constants/storekeeper";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";
import type { JobItem } from "@/types";

function callStorekeeper() {
  if (!STOREKEEPER.phone) {
    void haptic.warn();
    Alert.alert("No store number", "Ask admin to set the storekeeper phone in the app.");
    return;
  }
  void haptic.press();
  void Linking.openURL(`tel:${STOREKEEPER.phone}`);
}

function callOfficeForDiscount() {
  if (!OFFICE.phone) {
    void haptic.warn();
    Alert.alert(
      "No office number",
      "Ask admin to set the office phone, or use Ask for discount to send a request."
    );
    return;
  }
  void haptic.press();
  void Linking.openURL(`tel:${OFFICE.phone}`);
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const [items, setItems] = useState<JobItem[]>([]);
  const [section, setSection] = useState<JobSectionId>("details");

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
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      const action = String(vars.action ?? "");
      if (action === "accept") toast("Job accepted", "success");
      else if (action === "start") toast("Started on site", "success");
      else if (action === "resume") toast("Work resumed", "success");
    },
    onError: (e: Error) => {
      void haptic.error();
      Alert.alert("Couldn't do that", e.message);
    },
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

  const job = query.data;
  const tabs = useMemo(
    () => (job ? buildJobTabs(job, items) : []),
    [job, items]
  );

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Text style={{ color: colors.textDim }}>Job not found.</Text>
      </View>
    );
  }

  const showQuickActions =
    job.status === "Assigned" ||
    job.status === "Accepted" ||
    job.status === "InProgress" ||
    job.status === "Paused";

  const isReassigned = job.status === "TechnicianReassigned";
  const successor = (job.childJobs && job.childJobs[0]) || null;
  const statusView = technicianJobStatus(String(job.status));
  const showTeam = (job.assignments?.length || 0) > 1 && !isReassigned;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>
              {job.jobNumber}
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 13 }}>
              {statusView.label === "Done"
                ? "Finished on your side"
                : "Swipe sections below"}
            </Text>
          </View>
          {statusView.showBadge ? (
            <StatusBadge label={statusView.label} friendly />
          ) : statusView.label === "Done" ? (
            <Text style={{ color: colors.success, fontWeight: "800", fontSize: 14 }}>Done</Text>
          ) : null}
        </View>
      </View>

      <JobSectionTabs active={section} onChange={setSection} tabs={tabs} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 170 }}>
        {section === "details" ? (
          <>
            {isReassigned ? (
              <Card style={{ marginBottom: 14, borderRadius: 18, gap: 8, backgroundColor: colors.surfaceElevated }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                  This job was reassigned
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
                  Continue on the successor work order
                  {successor ? ` ${successor.jobNumber}` : ""}.
                </Text>
                {successor ? (
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: "/jobs/[id]", params: { id: successor.id } })
                    }
                  >
                    <Text style={{ color: colors.primary, fontWeight: "800" }}>
                      Open {successor.jobNumber}
                    </Text>
                  </Pressable>
                ) : null}
              </Card>
            ) : null}

            {showTeam ? (
              <Card style={{ marginBottom: 14, borderRadius: 18, gap: 6 }}>
                <Text
                  style={{
                    color: colors.textDim,
                    fontSize: 11,
                    fontWeight: "800",
                    letterSpacing: 0.6,
                  }}
                >
                  ASSIGNED TECHNICIANS
                </Text>
                {job.assignments!.map((a) => (
                  <Text key={a.id} style={{ color: colors.text, fontSize: 13 }}>
                    {(a.technician && a.technician.name) || a.technicianId}
                    {a.role === "primary" ? " · lead" : " · assistant"}
                    {a.status ? ` · ${a.status}` : ""}
                  </Text>
                ))}
              </Card>
            ) : null}

            <JobOverviewCard job={job} />

            {showQuickActions ? (
              <View style={{ gap: 10, marginTop: 8 }}>
                <Text
                  style={{
                    color: colors.textDim,
                    fontSize: 12,
                    fontWeight: "800",
                    letterSpacing: 0.8,
                    marginBottom: 2,
                  }}
                >
                  QUICK ACTIONS
                </Text>
                <Button
                  title={
                    STOREKEEPER.displayPhone
                      ? `Call store · ${STOREKEEPER.displayPhone}`
                      : "Call store"
                  }
                  size="lg"
                  icon={<PhoneCall size={20} color="#fff" />}
                  onPress={callStorekeeper}
                  style={{ backgroundColor: "#2563EB" }}
                />
                <Button
                  title={
                    OFFICE.displayPhone
                      ? `Call office · ${OFFICE.displayPhone}`
                      : "Call office"
                  }
                  size="lg"
                  icon={<BadgePercent size={20} color="#fff" />}
                  onPress={callOfficeForDiscount}
                  style={{ backgroundColor: "#BE123C" }}
                />
                <Button
                  title="Need parts"
                  size="lg"
                  icon={<Package size={20} color="#fff" />}
                  onPress={() =>
                    router.push({
                      pathname: "/jobs/inventory-request",
                      params: { jobId: id, jobNumber: job.jobNumber },
                    })
                  }
                />
                <Button
                  title="Add services"
                  size="lg"
                  icon={<Wrench size={20} color="#fff" />}
                  onPress={() =>
                    router.push({
                      pathname: "/jobs/add-services",
                      params: { jobId: id, jobNumber: job.jobNumber },
                    })
                  }
                  style={{ backgroundColor: "#2563EB" }}
                />
                <Button
                  title="Ask discount"
                  size="lg"
                  icon={<Percent size={20} color="#fff" />}
                  onPress={() =>
                    router.push({
                      pathname: "/jobs/discount-modal",
                      params: { jobId: id },
                    })
                  }
                  style={{ backgroundColor: "#BE123C" }}
                />
                <Button
                  title="Log expense"
                  size="lg"
                  icon={<Receipt size={20} color="#fff" />}
                  onPress={() =>
                    router.push({ pathname: "/expenses/new", params: { jobId: id } })
                  }
                  style={{ backgroundColor: "#D97706" }}
                />
              </View>
            ) : null}

            <Card style={{ marginTop: 18, borderRadius: 18 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16, marginBottom: 4 }}>
                Materials and services
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
                Materials: set how much you used. Prices in PKR.
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
          </>
        ) : (
          <JobSectionPanel section={section} job={job} items={items} />
        )}
      </ScrollView>

      {!isReassigned && (
        <JobActionToolbar
          status={job.status}
          loading={mutation.isPending}
          onAccept={() =>
            mutation.mutate({
              action: "accept",
              actor: employee?.name ?? "Technician",
              technicianId: employee?.id,
            })
          }
          onStart={() => void withGps("start")}
          onResume={() => void withGps("resume")}
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
              },
            })
          }
        />
      )}
    </View>
  );
}
