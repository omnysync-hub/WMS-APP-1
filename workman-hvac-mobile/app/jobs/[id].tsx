import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Snowflake, Gauge, Package, Check, ShieldCheck } from "lucide-react-native";
import { WorkshopHvacApi } from "@/services/api";

export default function HvacJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Sub-Modals
  const [showDiagnose, setShowDiagnose] = useState(false);
  const [findings, setFindings] = useState("");
  const [workReq, setWorkReq] = useState("");
  const [estHours, setEstHours] = useState("3");
  const [estCost, setEstCost] = useState("5000");

  const [showGas, setShowGas] = useState(false);
  const [gasDesc, setGasDesc] = useState("R410A Refrigerant Gas");
  const [gasQty, setGasQty] = useState("1.2");

  const [showTest, setShowTest] = useState(false);
  const [testPsi, setTestPsi] = useState("400");
  const [testAmps, setTestAmps] = useState("6.2");
  const [testNotes, setTestNotes] = useState("Nitrogen held 24h at 400 PSI. Vacuum 250 microns.");

  const [showFinish, setShowFinish] = useState(false);
  const [workDone, setWorkDone] = useState("");
  const [scrapItem, setScrapItem] = useState("Burnt Compressor (1.5 Ton Rotary)");
  const [customerKept, setCustomerKept] = useState(false);

  const loadJob = async () => {
    try {
      const res = await WorkshopHvacApi.getJob(id!);
      if (res.success) {
        setJob(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadJob();
  }, [id]);

  const handleSaveDiagnosis = async () => {
    if (!findings.trim() || !workReq.trim()) {
      Alert.alert("Required", "Please provide inspection findings and work required.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await WorkshopHvacApi.saveDiagnosis(job.id, {
        inspectionFindings: findings,
        workRequired: workReq,
        estimatedHours: Number(estHours) || 2,
        estimatedCost: Number(estCost) || 0,
      });
      if (res.success) {
        setShowDiagnose(false);
        loadJob();
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestGas = async () => {
    if (!gasDesc.trim()) {
      Alert.alert("Required", "Please enter material description.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await WorkshopHvacApi.requestGasAndParts(job.id, [
        { description: gasDesc, requestedQty: Number(gasQty) || 1, unit: "kg" },
      ]);
      if (res.success) {
        setShowGas(false);
        loadJob();
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveTest = async () => {
    setActionLoading(true);
    try {
      const res = await WorkshopHvacApi.saveBenchTest(job.id, {
        testingPressurePsi: Number(testPsi) || 400,
        testingLeakTest: "Pass",
        testingRunTestAmps: Number(testAmps) || 6.0,
        testingNotes: testNotes,
      });
      if (res.success) {
        setShowTest(false);
        loadJob();
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinishJob = async () => {
    if (!workDone.trim()) {
      Alert.alert("Required", "Work done summary is required.");
      return;
    }
    setActionLoading(true);
    try {
      if (scrapItem.trim()) {
        await WorkshopHvacApi.recordScrap(job.id, {
          itemDescription: scrapItem,
          quantity: 1,
          customerKept,
        });
      }
      const res = await WorkshopHvacApi.completeJob(job.id, workDone);
      if (res.success) {
        setShowFinish(false);
        loadJob();
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !job) {
    return (
      <View className="flex-1 bg-[#09090B] items-center justify-center">
        <ActivityIndicator color="#06B6D4" size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#09090B] p-4">
      {/* Header Banner */}
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-cyan-400 font-mono text-xs font-extrabold">{job.jobNumber}</Text>
          <Text className="text-emerald-400 font-mono font-bold text-xs">
            PKR {(job.totalJobCost || 0).toLocaleString()}
          </Text>
        </View>

        <Text className="text-white text-lg font-extrabold mt-1">❄️ {job.brandModel}</Text>
        <Text className="text-zinc-400 text-xs">
          {job.unitType} • S/N: {job.serialNumber || "N/A"} • Ref: {job.refrigerantType || "R410A"}
        </Text>
      </View>

      {/* Step 1: Intake */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-zinc-400 text-[10px] uppercase font-bold mb-1">Step 1: Problem & Site</Text>
        <Text className="text-white text-xs">{job.complaint}</Text>
        <Text className="text-zinc-500 text-[10px] mt-1">Site: {job.customerSite || job.customerName || "Bench Rig"}</Text>
      </View>

      {/* Step 3: Diagnosis & Manager Approval */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-cyan-400 text-[10px] uppercase font-bold">Step 3 & 4: Diagnosis & Manager Gate</Text>
          <Text
            className={`text-[10px] font-bold ${
              job.approvalStatus === "approved"
                ? "text-emerald-400"
                : job.approvalStatus === "rejected"
                ? "text-red-400"
                : "text-amber-400"
            }`}
          >
            {job.approvalStatus?.toUpperCase() || "PENDING"}
          </Text>
        </View>

        {job.inspectionFindings ? (
          <View className="mt-1">
            <Text className="text-zinc-300 text-xs font-semibold">Findings: {job.inspectionFindings}</Text>
            <Text className="text-zinc-400 text-xs mt-0.5">Work: {job.workRequired}</Text>
            <Text className="text-zinc-500 text-[10px] mt-1">Est: {job.estimatedHours} hrs • PKR {job.estimatedCost}</Text>
          </View>
        ) : (
          <Text className="text-zinc-500 text-xs italic">Diagnosis not submitted yet.</Text>
        )}

        <TouchableOpacity
          onPress={() => setShowDiagnose(!showDiagnose)}
          className="mt-2.5 bg-zinc-800 py-2 rounded-xl items-center"
        >
          <Text className="text-zinc-200 text-xs font-bold">
            {job.inspectionFindings ? "Update Diagnosis" : "Log Diagnosis"}
          </Text>
        </TouchableOpacity>

        {showDiagnose && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
            <TextInput
              placeholder="Inspection Findings *"
              placeholderTextColor="#71717A"
              value={findings}
              onChangeText={setFindings}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TextInput
              placeholder="Work Required *"
              placeholderTextColor="#71717A"
              value={workReq}
              onChangeText={setWorkReq}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <View className="flex-row gap-2">
              <TextInput
                placeholder="Est Hours"
                placeholderTextColor="#71717A"
                value={estHours}
                onChangeText={setEstHours}
                keyboardType="numeric"
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
              <TextInput
                placeholder="Est Cost"
                placeholderTextColor="#71717A"
                value={estCost}
                onChangeText={setEstCost}
                keyboardType="numeric"
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
            </View>
            <TouchableOpacity
              onPress={handleSaveDiagnosis}
              disabled={actionLoading}
              className="bg-amber-500 py-2 rounded-lg items-center mt-1"
            >
              <Text className="text-black font-bold text-xs">Submit to Manager</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Step 5: Gas & Parts Requisition */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-emerald-400 text-[10px] uppercase font-bold">Step 5: Gas & Parts Requisition</Text>
          <TouchableOpacity
            onPress={() => {
              if (!["Approved", "In Progress"].includes(job.status)) {
                Alert.alert("Control Block", "Manager approval required before requesting gas or parts.");
                return;
              }
              setShowGas(!showGas);
            }}
          >
            <Text className="text-emerald-400 text-xs font-bold">+ Request Gas</Text>
          </TouchableOpacity>
        </View>

        {job.requisitions && job.requisitions.length > 0 ? (
          job.requisitions.map((req: any) => (
            <View key={req.id} className="flex-row items-center justify-between bg-zinc-950 p-2 rounded-lg mt-1.5">
              <Text className="text-white text-xs">{req.description} ({req.requestedQty} {req.unit})</Text>
              <Text className="text-emerald-400 text-[10px] font-bold">{req.status}</Text>
            </View>
          ))
        ) : (
          <Text className="text-zinc-500 text-xs italic">No gas or materials requisitioned yet.</Text>
        )}

        {showGas && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
            <TextInput
              placeholder="Gas / Item (e.g. R410A Refrigerant)"
              placeholderTextColor="#71717A"
              value={gasDesc}
              onChangeText={setGasDesc}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TextInput
              placeholder="Quantity (kg)"
              placeholderTextColor="#71717A"
              value={gasQty}
              onChangeText={setGasQty}
              keyboardType="numeric"
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TouchableOpacity
              onPress={handleRequestGas}
              disabled={actionLoading}
              className="bg-[#0D7A5F] py-2 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-xs">Send Request to Store</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Step 8: Bench Testing */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-cyan-400 text-[10px] uppercase font-bold mb-1">Step 8: Bench Testing (PSI & Amps)</Text>
        <View className="flex-row gap-2 my-1">
          <Text className="text-white text-xs font-bold font-mono">
            PSI: {job.testingPressurePsi || "N/A"}
          </Text>
          <Text className="text-white text-xs font-bold font-mono">
            Amps: {job.testingRunTestAmps ? `${job.testingRunTestAmps}A` : "N/A"}
          </Text>
        </View>
        <Text className="text-zinc-400 text-xs">{job.testingNotes || "Bench test results not logged yet."}</Text>

        <TouchableOpacity
          onPress={() => setShowTest(!showTest)}
          className="mt-2.5 bg-zinc-800 py-2 rounded-xl items-center"
        >
          <Text className="text-zinc-200 text-xs font-bold">Log Bench Test Station</Text>
        </TouchableOpacity>

        {showTest && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
            <View className="flex-row gap-2">
              <TextInput
                placeholder="Nitrogen PSI"
                placeholderTextColor="#71717A"
                value={testPsi}
                onChangeText={setTestPsi}
                keyboardType="numeric"
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg font-mono"
              />
              <TextInput
                placeholder="Running Amps"
                placeholderTextColor="#71717A"
                value={testAmps}
                onChangeText={setTestAmps}
                keyboardType="numeric"
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg font-mono"
              />
            </View>
            <TextInput
              placeholder="Test observations..."
              placeholderTextColor="#71717A"
              value={testNotes}
              onChangeText={setTestNotes}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TouchableOpacity
              onPress={handleSaveTest}
              disabled={actionLoading}
              className="bg-cyan-600 py-2 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-xs">Save Test Results</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Step 9: Complete & Scrap */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-8">
        <Text className="text-emerald-400 text-[10px] uppercase font-bold mb-1">Step 9: Complete Work & Scrap</Text>
        <Text className="text-white text-xs">{job.workDoneSummary || "Bench repair still in progress."}</Text>

        <TouchableOpacity
          onPress={() => setShowFinish(!showFinish)}
          className="mt-2.5 bg-emerald-600 py-2.5 rounded-xl items-center"
        >
          <Text className="text-white text-xs font-bold">Mark Work Completed</Text>
        </TouchableOpacity>

        {showFinish && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
            <TextInput
              placeholder="Work Done Summary *"
              placeholderTextColor="#71717A"
              value={workDone}
              onChangeText={setWorkDone}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TextInput
              placeholder="Burnt Compressor / Scrap Item"
              placeholderTextColor="#71717A"
              value={scrapItem}
              onChangeText={setScrapItem}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TouchableOpacity
              onPress={() => setCustomerKept(!customerKept)}
              className="py-1"
            >
              <Text className="text-zinc-400 text-xs">
                {customerKept ? "✓ Customer kept old parts" : "☐ Customer kept old parts"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleFinishJob}
              disabled={actionLoading}
              className="bg-emerald-600 py-2 rounded-lg items-center mt-1"
            >
              <Text className="text-white font-bold text-xs">Confirm Job Completion</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
