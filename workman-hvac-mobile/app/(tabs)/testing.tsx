import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { Gauge } from "lucide-react-native";
import { WorkshopHvacApi } from "@/services/api";
import { StatusChip } from "@/components/jobUi";

export default function HvacTestingScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  // Measured values only — the form starts empty (or with the job's previously
  // recorded values). Pre-filled demo readings caused fake test data in the ERP.
  const [psi, setPsi] = useState("");
  const [amps, setAmps] = useState("");
  const [leakResult, setLeakResult] = useState<"Pass" | "Fail">("Pass");
  const [leakDetail, setLeakDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      setError(null);
      const [inProgress, approved] = await Promise.all([
        WorkshopHvacApi.getJobs({ status: "In Progress" }),
        WorkshopHvacApi.getJobs({ status: "Approved" }),
      ]);
      const merged = [...(inProgress.data || []), ...(approved.data || [])];
      setJobs(merged);
    } catch (e: any) {
      setError(e?.message || "Could not load bench units");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadJobs();
    }, [loadJobs])
  );

  const selectJob = (job: any) => {
    setSelectedJob(job);
    setPsi(job.testingPressurePsi != null ? String(job.testingPressurePsi) : "");
    setAmps(job.testingRunTestAmps != null ? String(job.testingRunTestAmps) : "");
    setLeakResult((job.testingLeakTest || "Pass").toLowerCase().startsWith("fail") ? "Fail" : "Pass");
    setLeakDetail("");
    setNotes(job.testingNotes || "");
  };

  const handleSaveTest = async () => {
    if (!selectedJob) {
      Alert.alert("Select Unit", "Please select an active HVAC unit on the bench.");
      return;
    }
    if (!psi && !amps && !notes.trim()) {
      Alert.alert("Required", "Enter at least one measured value (PSI, amps, or notes) — do not log unmeasured readings.");
      return;
    }
    setSaving(true);
    try {
      const leak = leakDetail.trim() ? `${leakResult} — ${leakDetail.trim()}` : leakResult;
      const res = await WorkshopHvacApi.saveBenchTest(selectedJob.id, {
        testingPressurePsi: psi ? Number(psi) : undefined,
        testingLeakTest: leak,
        testingRunTestAmps: amps ? Number(amps) : undefined,
        testingNotes: notes.trim() || undefined,
      });
      if (res.success) {
        Alert.alert("Saved", `Bench test results logged for ${selectedJob.brandModel}`);
        setSelectedJob(null);
        loadJobs();
      } else {
        Alert.alert("Blocked", res.error || "Could not save test results");
      }
    } catch (e: any) {
      Alert.alert("Blocked", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-[#09090B] p-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs(); }} tintColor="#06B6D4" />}
    >
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-4">
        <View className="flex-row items-center mb-1">
          <Gauge color="#06B6D4" size={20} />
          <Text className="text-white text-base font-extrabold ml-2">HVAC Bench Test Station</Text>
        </View>
        <Text className="text-zinc-400 text-xs">
          Step 7: Log the Nitrogen pressure test (PSI), leak test result, vacuum level, and running
          amps under load — measured values only. Approved and In Progress units appear here.
        </Text>
      </View>

      <Text className="text-zinc-400 text-xs font-bold uppercase mb-2">Select Unit on Bench Rig:</Text>
      {loading ? (
        <ActivityIndicator color="#06B6D4" size="small" />
      ) : error ? (
        <View className="mb-4">
          <Text className="text-red-400 text-xs">{error}</Text>
          <TouchableOpacity onPress={loadJobs} className="bg-cyan-500 px-3 py-1.5 rounded-lg self-start mt-2">
            <Text className="text-black text-xs font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={jobs}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          className="max-h-28 mb-4"
          ListEmptyComponent={
            <Text className="text-zinc-500 text-xs py-4">No Approved / In Progress units on the bench</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => selectJob(item)}
              className={`p-3 rounded-2xl mr-2.5 border ${
                selectedJob?.id === item.id
                  ? "bg-cyan-950/80 border-cyan-500"
                  : "bg-[#121215] border-[#27272A]"
              }`}
            >
              <Text className="text-cyan-400 font-mono text-xs font-bold">{item.jobNumber}</Text>
              <Text className="text-white text-xs font-bold mt-1">{item.brandModel}</Text>
              <View className="flex-row items-center gap-2 mt-1">
                <Text className="text-zinc-400 text-[10px]">{item.refrigerantType || "—"}</Text>
                <StatusChip status={item.status} />
              </View>
              {!!item.testingPressurePsi && (
                <Text className="text-zinc-500 text-[10px] mt-1">Last: {item.testingPressurePsi} PSI</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Test Log Form */}
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl space-y-3 mb-8">
        <Text className="text-white text-sm font-bold">
          {selectedJob ? `Log Tests: ${selectedJob.brandModel} (${selectedJob.jobNumber})` : "Bench Test Controls"}
        </Text>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Nitrogen PSI (measured)</Text>
            <TextInput
              placeholder="e.g. 400"
              placeholderTextColor="#71717A"
              value={psi}
              onChangeText={setPsi}
              keyboardType="numeric"
              className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl font-mono"
            />
          </View>
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Running Amps (measured)</Text>
            <TextInput
              placeholder="e.g. 6.2"
              placeholderTextColor="#71717A"
              value={amps}
              onChangeText={setAmps}
              keyboardType="numeric"
              className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl font-mono"
            />
          </View>
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Leak Test Result</Text>
          <View className="flex-row items-center gap-2">
            {(["Pass", "Fail"] as const).map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setLeakResult(r)}
                className={`px-4 py-2 rounded-lg ${leakResult === r ? (r === "Pass" ? "bg-emerald-600" : "bg-red-600") : "bg-zinc-800"}`}
              >
                <Text className="text-white text-xs font-bold">{r}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              placeholder="Detail (e.g. held 24h, vacuum 250 microns)"
              placeholderTextColor="#71717A"
              value={leakDetail}
              onChangeText={setLeakDetail}
              className="flex-1 bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
            />
          </View>
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Bench Notes & Observations</Text>
          <TextInput
            placeholder="Cooling delta-T, vibration, electrical readings..."
            placeholderTextColor="#71717A"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            className="bg-[#18181B] border border-[#27272A] text-white text-xs p-2.5 rounded-xl"
          />
        </View>

        <TouchableOpacity
          onPress={handleSaveTest}
          disabled={saving || !selectedJob}
          className={`py-3 rounded-xl items-center mt-2 ${
            selectedJob ? "bg-cyan-500" : "bg-zinc-800 opacity-40"
          }`}
        >
          {saving ? (
            <ActivityIndicator color="#000000" size="small" />
          ) : (
            <Text className="text-black font-bold text-xs">Save Bench Test Station Log</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
