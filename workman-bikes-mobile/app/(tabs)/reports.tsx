import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { BarChart3, Search, AlertCircle } from "lucide-react-native";
import { WorkshopBikesApi, apiErrorMessage } from "@/services/api";
import { StatusChip } from "@/components/StatusChip";
import { formatDateTime, formatMoney } from "@/lib/workshop";

/**
 * Workshop reports from GET /api/workshops/reports (ERP WorkshopService):
 * bike history, mechanic productivity, job costing, material flow,
 * pending jobs, tools and scrap registers.
 */
const REPORT_TYPES = [
  { key: "pending_jobs", label: "Pending Jobs" },
  { key: "bike_history", label: "Bike History" },
  { key: "job_costing", label: "Job Costing" },
  { key: "mechanic_productivity", label: "Mechanics" },
  { key: "material_flow", label: "Material Flow" },
  { key: "tools_report", label: "Tools" },
  { key: "scrap_report", label: "Scrap" },
] as const;

export default function BikeReportsScreen() {
  const router = useRouter();
  const [reportType, setReportType] = useState<string>("pending_jobs");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await WorkshopBikesApi.getReports(reportType, {
        search: reportType === "bike_history" ? debouncedSearch || undefined : undefined,
      });
      if (res.success) setRows(res.data || []);
      else setError(res.error || "Failed to load this report.");
    } catch (e: any) {
      setError(apiErrorMessage(e, "Failed to load this report."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [reportType, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const renderRow = ({ item }: { item: any }) => {
    switch (reportType) {
      case "mechanic_productivity":
        return (
          <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-2.5">
            <Text className="text-white text-sm font-bold">🔧 {item.staffName}</Text>
            <Text className="text-zinc-400 text-xs mt-1">
              Jobs: {item.totalJobs} • Completed: {item.completedJobs} • In hand: {item.inProgressJobs}
              {"\n"}Est. hours: {item.totalEstHours} • Material: {formatMoney(item.totalMaterialCost)}
            </Text>
          </View>
        );
      case "job_costing":
        return (
          <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-amber-400 font-mono text-xs font-bold">{item.jobNumber}</Text>
              <StatusChip status={item.status} />
            </View>
            <Text className="text-white text-sm font-bold mt-1">
              🏍️ {item.bikeRegNo || "—"} • {item.customerName || "Walk-In"}
            </Text>
            <Text className="text-zinc-400 text-xs mt-0.5">
              Material {formatMoney(item.totalMaterialCost)} • Labour {formatMoney(item.totalLabourCost)} •{" "}
              <Text className="text-emerald-400 font-bold">Total {formatMoney(item.totalJobCost)}</Text>
            </Text>
          </View>
        );
      case "material_flow":
        return (
          <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-amber-400 font-mono text-xs font-bold">{item.jobCard?.jobNumber || "-"}</Text>
              <Text className="text-emerald-400 text-[10px] font-bold">{item.status}</Text>
            </View>
            <Text className="text-white text-sm font-bold mt-1">{item.description}</Text>
            <Text className="text-zinc-400 text-xs mt-0.5">
              Req {item.requestedQty} • Issued {item.issuedQty || 0} • Returned {item.returnedQty || 0} {item.unit} •
              Line {formatMoney(item.totalCost)} • {formatDateTime(item.createdAt)}
            </Text>
          </View>
        );
      case "tools_report":
        return (
          <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-amber-400 font-mono text-xs font-bold">{item.toolCode}</Text>
              <Text className={`text-[10px] font-bold ${item.condition === "Operational" ? "text-emerald-400" : "text-red-400"}`}>
                {item.condition}
              </Text>
            </View>
            <Text className="text-white text-sm font-bold mt-1">{item.name}</Text>
            <Text className="text-zinc-400 text-xs mt-0.5">
              Available {item.availableQuantity}/{item.totalQuantity} • Out on {item.issues?.length || 0} issue(s)
            </Text>
          </View>
        );
      case "scrap_report":
        return (
          <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-amber-400 font-mono text-xs font-bold">{item.jobCard?.jobNumber || "-"}</Text>
              <Text className="text-zinc-300 text-[10px] font-bold">
                {item.customerKept ? "Customer Kept" : item.status}
              </Text>
            </View>
            <Text className="text-white text-sm font-bold mt-1">{item.itemDescription}</Text>
            <Text className="text-zinc-400 text-xs mt-0.5">
              Qty {item.quantity} {item.unit}
              {item.status === "sold" ? ` • Sold ${formatMoney(item.disposalValue)}` : ""} • {formatDateTime(item.createdAt)}
            </Text>
          </View>
        );
      default: // pending_jobs + bike_history: job card rows
        return (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: item.id } })}
            className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-2.5 active:opacity-80"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-amber-400 font-mono text-xs font-bold">{item.jobNumber}</Text>
              <StatusChip status={item.status} />
            </View>
            <Text className="text-white text-sm font-bold mt-1">
              🏍️ {item.bikeRegNo || "—"} • {item.bikeMakeModel || "Motorbike"}
            </Text>
            <Text className="text-zinc-400 text-xs mt-0.5" numberOfLines={1}>
              {item.complaint}
            </Text>
            <Text className="text-zinc-500 text-[11px] mt-0.5">
              {item.customerName || "Walk-In"} • {item.assignedStaffName || "Unassigned"} • Opened{" "}
              {formatDateTime(item.createdAt)} • {formatMoney(item.totalJobCost)}
            </Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      <View className="flex-row flex-wrap gap-2 mb-3">
        {REPORT_TYPES.map((r) => (
          <TouchableOpacity
            key={r.key}
            onPress={() => setReportType(r.key)}
            className={`px-3 py-1.5 rounded-lg ${reportType === r.key ? "bg-amber-500" : "bg-[#27272A]"}`}
          >
            <Text className={`text-xs font-bold ${reportType === r.key ? "text-black" : "text-zinc-400"}`}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {reportType === "bike_history" && (
        <View className="flex-row items-center bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 mb-3">
          <Search color="#71717A" size={16} />
          <TextInput
            placeholder="Search by Reg No, Chassis or Customer..."
            placeholderTextColor="#71717A"
            value={search}
            onChangeText={setSearch}
            className="flex-1 text-white text-xs ml-2 py-0"
          />
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F59E0B" size="large" />
          <Text className="text-zinc-500 text-xs mt-2">Loading report...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <AlertCircle color="#F87171" size={32} />
          <Text className="text-red-300 text-sm font-bold mt-3 text-center">Could not load this report</Text>
          <Text className="text-zinc-500 text-xs mt-1 text-center">{error}</Text>
          <TouchableOpacity onPress={load} className="bg-amber-500 px-4 py-2 rounded-xl mt-4">
            <Text className="text-black text-xs font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, idx) => item.id || `${reportType}-${idx}`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#F59E0B" />
          }
          ListEmptyComponent={
            <View className="py-12 items-center justify-center border border-dashed border-zinc-800 rounded-2xl">
              <BarChart3 color="#71717A" size={32} />
              <Text className="text-zinc-500 text-xs mt-2">Nothing in this report yet</Text>
            </View>
          }
          renderItem={renderRow}
        />
      )}
    </View>
  );
}
