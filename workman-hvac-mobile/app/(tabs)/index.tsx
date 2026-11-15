import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Snowflake, Plus, Search } from "lucide-react-native";
import { WorkshopHvacApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { StatusChip } from "@/components/jobUi";

const STATUS_FILTERS = ["ALL", "Open", "Assigned", "Pending Approval", "Approved", "In Progress", "Completed", "Closed"] as const;

export default function HvacJobsScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);
  const benchRig = useAuthStore((s) => s.benchRig);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [unitFilter, setUnitFilter] = useState("ALL");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadJobs = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        setError(null);
        const res = await WorkshopHvacApi.getJobs({
          search: search.trim() || undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
        });
        if (res.success) {
          setJobs(res.data || []);
        } else {
          setError(res.error || "Failed to load job cards");
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load job cards");
      } finally {
        if (!opts?.silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [search, statusFilter]
  );

  // Reload whenever the tab regains focus (e.g. after creating/closing a job).
  useFocusEffect(
    useCallback(() => {
      loadJobs();
    }, [loadJobs])
  );

  const onSearchChange = (text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadJobs(), 400);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  const filteredJobs = jobs.filter((j) => {
    if (unitFilter !== "ALL") {
      return (j.unitType || "").toLowerCase().includes(unitFilter.toLowerCase());
    }
    return true;
  });

  return (
    <View className="flex-1 bg-[#09090B]">
      {/* Top Banner */}
      <View className="bg-[#121215] px-4 py-3 border-b border-[#27272A]">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-cyan-400 text-xs font-bold uppercase tracking-wider">
              Bench Testing • {benchRig}
            </Text>
            <Text className="text-white text-base font-extrabold" numberOfLines={1}>
              {employee?.name || "Technician"}
            </Text>
            {!!employee?.role && (
              <Text className="text-zinc-500 text-[10px] capitalize">
                {employee.role}
                {employee.designation ? ` • ${employee.designation}` : ""}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => router.push("/jobs/new")}
            className="flex-row items-center bg-[#0D7A5F] px-3 py-2 rounded-xl"
          >
            <Plus color="#FFFFFF" size={16} />
            <Text className="text-white text-xs font-bold ml-1">New Intake</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 mt-3">
          <Search color="#71717A" size={16} />
          <TextInput
            placeholder="Search Serial No, Brand, Model, Site..."
            placeholderTextColor="#71717A"
            value={search}
            onChangeText={onSearchChange}
            className="flex-1 text-white text-xs ml-2 py-0"
          />
        </View>

        {/* Status Filter Pills (SOP statuses, filtered server-side) */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS as unknown as string[]}
          keyExtractor={(f) => f}
          className="mt-3"
          renderItem={({ item: f }) => (
            <TouchableOpacity
              onPress={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg mr-2 ${
                statusFilter === f ? "bg-cyan-500" : "bg-[#27272A]"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  statusFilter === f ? "text-black" : "text-zinc-400"
                }`}
              >
                {f === "ALL" ? "All Statuses" : f}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Unit Filter Pills */}
        <View className="flex-row mt-2.5 gap-2">
          {["ALL", "Inverter", "Floor", "Chiller"].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setUnitFilter(f)}
              className={`px-3 py-1.5 rounded-lg ${
                unitFilter === f ? "bg-zinc-100" : "bg-[#27272A]"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  unitFilter === f ? "text-black" : "text-zinc-400"
                }`}
              >
                {f === "ALL" ? "All Units" : f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Units List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#06B6D4" size="large" />
          <Text className="text-zinc-500 text-xs mt-2">Loading HVAC bench cards...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-sm font-bold text-center">Could not load job cards</Text>
          <Text className="text-zinc-500 text-xs text-center mt-1">{error}</Text>
          <TouchableOpacity onPress={() => loadJobs()} className="bg-cyan-500 px-4 py-2 rounded-xl mt-4">
            <Text className="text-black text-xs font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06B6D4" />}
          ListEmptyComponent={
            <View className="py-12 items-center justify-center border border-dashed border-zinc-800 rounded-2xl">
              <Snowflake color="#71717A" size={32} />
              <Text className="text-zinc-500 text-xs mt-2">No HVAC units found</Text>
              <Text className="text-zinc-600 text-[10px] mt-1">Try another status filter or pull to refresh.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/jobs/${item.id}`)}
              className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-3 shadow-sm active:opacity-80"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-cyan-400 font-mono text-xs font-extrabold">{item.jobNumber}</Text>
                <StatusChip status={item.status} />
              </View>

              <View className="mt-2">
                <Text className="text-white text-base font-extrabold">❄️ {item.brandModel}</Text>
                <Text className="text-zinc-400 text-xs mt-0.5">
                  {item.unitType} • S/N: {item.serialNumber || "N/A"}
                </Text>
                {!!item.assignedStaffName && (
                  <Text className="text-zinc-500 text-[11px] mt-0.5">
                    Technician: {item.assignedStaffName}
                  </Text>
                )}
              </View>

              {/* Bench Testing Strip */}
              <View className="flex-row gap-2 mt-2.5">
                <View className="flex-1 bg-[#09090B] p-2 rounded-xl border border-zinc-800/80">
                  <Text className="text-zinc-500 text-[9px] uppercase font-bold">Nitrogen PSI</Text>
                  <Text className="text-cyan-400 font-mono font-bold text-xs">
                    {item.testingPressurePsi ? `${item.testingPressurePsi} PSI` : "Not tested"}
                  </Text>
                </View>
                <View className="flex-1 bg-[#09090B] p-2 rounded-xl border border-zinc-800/80">
                  <Text className="text-zinc-500 text-[9px] uppercase font-bold">Running Amps</Text>
                  <Text className="text-amber-400 font-mono font-bold text-xs">
                    {item.testingRunTestAmps ? `${item.testingRunTestAmps} A` : "Not tested"}
                  </Text>
                </View>
                <View className="flex-1 bg-[#09090B] p-2 rounded-xl border border-zinc-800/80">
                  <Text className="text-zinc-500 text-[9px] uppercase font-bold">Refrigerant</Text>
                  <Text className="text-emerald-400 font-mono font-bold text-xs">
                    {item.refrigerantType || "—"}
                  </Text>
                </View>
              </View>

              <View className="bg-[#09090B] p-2.5 rounded-xl border border-zinc-800/80 mt-2.5">
                <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-0.5">Complaint:</Text>
                <Text className="text-zinc-300 text-xs" numberOfLines={2}>
                  {item.complaint}
                </Text>
              </View>

              <View className="mt-3 pt-2 border-t border-zinc-800/60 flex-row items-center justify-between">
                <Text className="text-zinc-400 text-xs">{item.customerSite || item.customerName || "Bench Rig"}</Text>
                <Text className="text-emerald-400 font-mono font-bold text-xs">
                  PKR {(item.totalJobCost || 0).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
