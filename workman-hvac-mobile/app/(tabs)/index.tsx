import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Snowflake, Plus, Search, Gauge } from "lucide-react-native";
import { WorkshopHvacApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

export default function HvacJobsScreen() {
  const router = useRouter();
  const { techName, benchRig } = useAuthStore();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("ALL");

  const loadJobs = async () => {
    try {
      const res = await WorkshopHvacApi.getJobs({ search: search.trim() || undefined });
      if (res.success) {
        setJobs(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [search]);

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
          <View>
            <Text className="text-cyan-400 text-xs font-bold uppercase tracking-wider">
              Bench Testing • {benchRig}
            </Text>
            <Text className="text-white text-base font-extrabold">{techName}</Text>
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
            onChangeText={setSearch}
            className="flex-1 text-white text-xs ml-2 py-0"
          />
        </View>

        {/* Filter Pills */}
        <View className="flex-row mt-3 gap-2">
          {["ALL", "Inverter", "Floor", "Chiller"].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setUnitFilter(f)}
              className={`px-3 py-1.5 rounded-lg ${
                unitFilter === f ? "bg-cyan-500" : "bg-[#27272A]"
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
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/jobs/${item.id}`)}
              className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-3 shadow-sm active:opacity-80"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-cyan-400 font-mono text-xs font-extrabold">{item.jobNumber}</Text>
                <View
                  className={`px-2 py-0.5 rounded-full ${
                    item.status === "Closed"
                      ? "bg-zinc-800"
                      : item.status === "Completed"
                      ? "bg-emerald-950/80 border border-emerald-800"
                      : item.status === "Pending Approval"
                      ? "bg-amber-950/80 border border-amber-800"
                      : "bg-cyan-950/80 border border-cyan-800"
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      item.status === "Closed"
                        ? "text-zinc-400"
                        : item.status === "Completed"
                        ? "text-emerald-300"
                        : item.status === "Pending Approval"
                        ? "text-amber-300"
                        : "text-cyan-300"
                    }`}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              <View className="mt-2">
                <Text className="text-white text-base font-extrabold">❄️ {item.brandModel}</Text>
                <Text className="text-zinc-400 text-xs mt-0.5">
                  {item.unitType} • S/N: {item.serialNumber || "N/A"}
                </Text>
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
                    {item.refrigerantType || "R410A"}
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
