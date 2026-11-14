import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { Gauge, Zap, Activity } from "lucide-react-native";
import { WorkshopHvacApi } from "@/services/api";

export default function HvacTestingScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [psi, setPsi] = useState("400");
  const [amps, setAmps] = useState("6.2");
  const [leakTest, setLeakTest] = useState("Pass - 400 PSI Held");
  const [notes, setNotes] = useState("Vacuum drawn to 250 microns. Amps stable at 6.2A on 220V.");
  const [saving, setSaving] = useState(false);

  const loadJobs = async () => {
    try {
      const res = await WorkshopHvacApi.getJobs({ status: "In Progress" });
      if (res.success) {
        setJobs(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleSaveTest = async () => {
    if (!selectedJob) {
      Alert.alert("Select Unit", "Please select an active HVAC unit on the bench.");
      return;
    }
    setSaving(true);
    try {
      const res = await WorkshopHvacApi.saveBenchTest(selectedJob.id, {
        testingPressurePsi: Number(psi) || 400,
        testingLeakTest: leakTest,
        testingRunTestAmps: Number(amps) || 6.0,
        testingNotes: notes,
      });
      if (res.success) {
        Alert.alert("Saved", `Bench test results logged for ${selectedJob.brandModel}`);
        setSelectedJob(null);
        loadJobs();
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-4">
        <View className="flex-row items-center mb-1">
          <Gauge color="#06B6D4" size={20} />
          <Text className="text-white text-base font-extrabold ml-2">HVAC Bench Test Station</Text>
        </View>
        <Text className="text-zinc-400 text-xs">
          Step 8: Log Nitrogen pressure holding test (PSI), vacuum micron level, and running amps under load.
        </Text>
      </View>

      {/* Select active bench unit */}
      <Text className="text-zinc-400 text-xs font-bold uppercase mb-2">Select Unit on Bench Rig:</Text>
      {loading ? (
        <ActivityIndicator color="#06B6D4" size="small" />
      ) : (
        <FlatList
          data={jobs}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          className="max-h-24 mb-4"
          ListEmptyComponent={
            <Text className="text-zinc-500 text-xs py-4">No units currently In Progress on bench</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedJob(item)}
              className={`p-3 rounded-2xl mr-2.5 border ${
                selectedJob?.id === item.id
                  ? "bg-cyan-950/80 border-cyan-500"
                  : "bg-[#121215] border-[#27272A]"
              }`}
            >
              <Text className="text-cyan-400 font-mono text-xs font-bold">{item.jobNumber}</Text>
              <Text className="text-white text-xs font-bold mt-1">{item.brandModel}</Text>
              <Text className="text-zinc-400 text-[10px]">{item.refrigerantType || "R410A"}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Test Log Form */}
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl space-y-3">
        <Text className="text-white text-sm font-bold">
          {selectedJob ? `Log Tests: ${selectedJob.brandModel}` : "Bench Test Controls"}
        </Text>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Nitrogen PSI</Text>
            <TextInput
              placeholder="400"
              placeholderTextColor="#71717A"
              value={psi}
              onChangeText={setPsi}
              keyboardType="numeric"
              className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl font-mono"
            />
          </View>
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Running Amps (220V)</Text>
            <TextInput
              placeholder="6.2"
              placeholderTextColor="#71717A"
              value={amps}
              onChangeText={setAmps}
              keyboardType="numeric"
              className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl font-mono"
            />
          </View>
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Vacuum & Leak Test</Text>
          <TextInput
            placeholder="e.g. Pass - 250 Microns Held 30 mins"
            placeholderTextColor="#71717A"
            value={leakTest}
            onChangeText={setLeakTest}
            className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
          />
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
    </View>
  );
}
