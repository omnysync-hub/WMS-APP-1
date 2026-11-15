import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { Bike, Plus, Search, AlertCircle } from "lucide-react-native";
import { WorkshopBikesApi, apiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { StatusChip } from "@/components/StatusChip";
import { WORKSHOP_ROLE_LABELS, canDo, formatMoney } from "@/lib/workshop";

export default function BikeJobsScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);
  const workshopRole = useAuthStore((s) => s.workshopRole);
  const bayNumber = useAuthStore((s) => s.bayNumber);

  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"active" | "all">("active");
  // Mechanics land on "Mine" (jobs assigned to them); other roles see the floor.
  const [scope, setScope] = useState<"mine" | "all">(workshopRole === "mechanic" ? "mine" : "all");
  const firstLoad = useRef(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadJobs = useCallback(async () => {
    try {
      setError(null);
      const res = await WorkshopBikesApi.getJobs({
        search: debouncedSearch || undefined,
        assignedStaffId: scope === "mine" ? employee?.id : undefined,
      });
      if (res.success) {
        setJobs(res.data || []);
      } else {
        setError(res.error || "Failed to load job cards.");
      }
    } catch (e: any) {
      setError(apiErrorMessage(e, "Failed to load job cards."));
    } finally {
      setLoading(false);
      setRefreshing(false);
      firstLoad.current = false;
    }
  }, [debouncedSearch, scope, employee?.id]);

  useEffect(() => {
    setLoading(true);
    loadJobs();
  }, [loadJobs]);

  useFocusEffect(
    useCallback(() => {
      if (!firstLoad.current) loadJobs();
    }, [loadJobs])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  const filteredJobs = jobs.filter((j) => {
    if (statusTab === "active") {
      return !["Closed", "Rejected"].includes(j.status);
    }
    return true;
  });

  const activeCount = jobs.filter((j) => !["Closed", "Rejected"].includes(j.status)).length;

  return (
    <View className="flex-1 bg-[#09090B]">
      {/* Top Strip */}
      <View className="bg-[#121215] px-4 py-3 border-b border-[#27272A]">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-amber-400 text-xs font-bold uppercase tracking-wider">
              {WORKSHOP_ROLE_LABELS[workshopRole]} • {bayNumber}
            </Text>
            <Text className="text-white text-base font-extrabold" numberOfLines={1}>
              {employee?.name || "Workshop User"}
            </Text>
          </View>
          {canDo(workshopRole, "create") && (
            <TouchableOpacity
              onPress={() => router.push("/jobs/new")}
              className="flex-row items-center bg-[#0D7A5F] px-3 py-2 rounded-xl"
            >
              <Plus color="#FFFFFF" size={16} />
              <Text className="text-white text-xs font-bold ml-1">New Intake</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 mt-3">
          <Search color="#71717A" size={16} />
          <TextInput
            placeholder="Search Reg No, Chassis, Customer..."
            placeholderTextColor="#71717A"
            value={search}
            onChangeText={setSearch}
            className="flex-1 text-white text-xs ml-2 py-0"
          />
        </View>

        {/* Scope + Status Filter Pills */}
        <View className="flex-row mt-3 gap-2 flex-wrap">
          <TouchableOpacity
            onPress={() => setScope("mine")}
            className={`px-3 py-1.5 rounded-lg ${scope === "mine" ? "bg-amber-500" : "bg-[#27272A]"}`}
          >
            <Text className={`text-xs font-bold ${scope === "mine" ? "text-black" : "text-zinc-400"}`}>
              My Jobs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setScope("all")}
            className={`px-3 py-1.5 rounded-lg ${scope === "all" ? "bg-amber-500" : "bg-[#27272A]"}`}
          >
            <Text className={`text-xs font-bold ${scope === "all" ? "text-black" : "text-zinc-400"}`}>
              Whole Workshop
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStatusTab("active")}
            className={`px-3 py-1.5 rounded-lg ${statusTab === "active" ? "bg-zinc-100" : "bg-[#27272A]"}`}
          >
            <Text className={`text-xs font-bold ${statusTab === "active" ? "text-black" : "text-zinc-400"}`}>
              Active ({activeCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStatusTab("all")}
            className={`px-3 py-1.5 rounded-lg ${statusTab === "all" ? "bg-zinc-100" : "bg-[#27272A]"}`}
          >
            <Text className={`text-xs font-bold ${statusTab === "all" ? "text-black" : "text-zinc-400"}`}>
              All ({jobs.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Jobs List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F59E0B" size="large" />
          <Text className="text-zinc-500 text-xs mt-2">Loading bike job cards...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <AlertCircle color="#F87171" size={32} />
          <Text className="text-red-300 text-sm font-bold mt-3 text-center">Could not load job cards</Text>
          <Text className="text-zinc-500 text-xs mt-1 text-center">{error}</Text>
          <TouchableOpacity onPress={loadJobs} className="bg-amber-500 px-4 py-2 rounded-xl mt-4">
            <Text className="text-black text-xs font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />}
          ListEmptyComponent={
            <View className="py-12 items-center justify-center border border-dashed border-zinc-800 rounded-2xl">
              <Bike color="#71717A" size={32} />
              <Text className="text-zinc-500 text-xs mt-2">
                {scope === "mine" ? "No job cards assigned to you" : "No bike job cards found"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: item.id } })}
              className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-3 shadow-sm active:opacity-80"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-amber-400 font-mono text-xs font-extrabold">{item.jobNumber}</Text>
                <StatusChip status={item.status} />
              </View>

              <View className="mt-2">
                <Text className="text-white text-base font-extrabold">🏍️ {item.bikeRegNo || "—"}</Text>
                <Text className="text-zinc-400 text-xs mt-0.5">
                  {item.bikeMakeModel || "Motorbike"} • {item.currentKm ? `${item.currentKm} km` : "Km N/A"}
                </Text>
              </View>

              <View className="bg-[#09090B] p-2.5 rounded-xl border border-zinc-800/80 mt-2.5">
                <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-0.5">Reported Complaint:</Text>
                <Text className="text-zinc-300 text-xs" numberOfLines={2}>
                  {item.complaint}
                </Text>
              </View>

              <View className="mt-3 pt-2 border-t border-zinc-800/60 flex-row items-center justify-between">
                <Text className="text-zinc-400 text-xs">
                  {item.customerName || "Walk-In"}
                  {item.assignedStaffName ? ` • 🔧 ${item.assignedStaffName}` : " • Unassigned"}
                </Text>
                <Text className="text-emerald-400 font-mono font-bold text-xs">
                  {formatMoney(item.totalJobCost)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
