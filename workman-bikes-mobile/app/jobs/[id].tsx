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
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Bike,
  Wrench,
  Package,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  Check,
  Clock,
} from "lucide-react-native";
import { WorkshopBikesApi } from "@/services/api";

export default function BikeJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Quick Action Modal States
  const [showDiagnose, setShowDiagnose] = useState(false);
  const [findings, setFindings] = useState("");
  const [workReq, setWorkReq] = useState("");
  const [estHours, setEstHours] = useState("2");
  const [estCost, setEstCost] = useState("2000");

  const [showParts, setShowParts] = useState(false);
  const [partDesc, setPartDesc] = useState("");
  const [partQty, setPartQty] = useState("1");

  const [showTest, setShowTest] = useState(false);
  const [testResult, setTestResult] = useState("Pass - Road test successful");

  const [showFinish, setShowFinish] = useState(false);
  const [workDone, setWorkDone] = useState("");
  const [scrapPart, setScrapPart] = useState("");
  const [customerKept, setCustomerKept] = useState(false);

  const loadJob = async () => {
    try {
      const res = await WorkshopBikesApi.getJob(id!);
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
      const res = await WorkshopBikesApi.saveDiagnosis(job.id, {
        inspectionFindings: findings,
        workRequired: workReq,
        estimatedHours: Number(estHours) || 1,
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

  const handleRequestParts = async () => {
    if (!partDesc.trim()) {
      Alert.alert("Required", "Please enter part description.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await WorkshopBikesApi.requestParts(job.id, [
        { description: partDesc, requestedQty: Number(partQty) || 1, unit: "pcs" },
      ]);
      if (res.success) {
        setShowParts(false);
        setPartDesc("");
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
      const res = await WorkshopBikesApi.saveTestRun(job.id, {
        testingLeakTest: "Pass",
        testingNotes: testResult,
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
      if (scrapPart.trim()) {
        await WorkshopBikesApi.recordScrap(job.id, {
          itemDescription: scrapPart,
          quantity: 1,
          customerKept,
        });
      }
      const res = await WorkshopBikesApi.completeJob(job.id, workDone);
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
        <ActivityIndicator color="#F59E0B" size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#09090B] p-4">
      {/* Header Banner */}
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-amber-400 font-mono text-xs font-extrabold">{job.jobNumber}</Text>
          <Text className="text-emerald-400 font-mono font-bold text-xs">
            PKR {(job.totalJobCost || 0).toLocaleString()}
          </Text>
        </View>

        <Text className="text-white text-lg font-extrabold mt-1">🏍️ {job.bikeRegNo}</Text>
        <Text className="text-zinc-400 text-xs">
          {job.bikeMakeModel || "Motorbike"} • Chassis: {job.chassisNumber || "N/A"} • {job.currentKm ? `${job.currentKm} km` : "Km N/A"}
        </Text>
      </View>

      {/* Step 1: Intake & Complaint */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-zinc-400 text-[10px] uppercase font-bold mb-1">Step 1: Customer Complaint</Text>
        <Text className="text-white text-xs">{job.complaint}</Text>
        <Text className="text-zinc-500 text-[10px] mt-1">Customer: {job.customerName || "Walk-In"} ({job.customerPhone || "-"})</Text>
      </View>

      {/* Step 3: Diagnosis & Manager Approval */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-amber-400 text-[10px] uppercase font-bold">Step 3 & 4: Diagnosis & Manager Gate</Text>
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

      {/* Step 5: Store Requisition */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-emerald-400 text-[10px] uppercase font-bold">Step 5: Store Requisition</Text>
          <TouchableOpacity
            onPress={() => {
              if (!["Approved", "In Progress"].includes(job.status)) {
                Alert.alert("Control Block", "Manager approval required before requesting store parts.");
                return;
              }
              setShowParts(!showParts);
            }}
          >
            <Text className="text-emerald-400 text-xs font-bold">+ Request</Text>
          </TouchableOpacity>
        </View>

        {job.requisitions && job.requisitions.length > 0 ? (
          job.requisitions.map((req: any) => (
            <View key={req.id} className="flex-row items-center justify-between bg-zinc-950 p-2 rounded-lg mt-1.5">
              <Text className="text-white text-xs">{req.description} (x{req.requestedQty})</Text>
              <Text className="text-emerald-400 text-[10px] font-bold">{req.status}</Text>
            </View>
          ))
        ) : (
          <Text className="text-zinc-500 text-xs italic">No parts requisitioned yet.</Text>
        )}

        {showParts && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
            <TextInput
              placeholder="Part Name (e.g. Engine Oil 20W50 / Clutch Plates)"
              placeholderTextColor="#71717A"
              value={partDesc}
              onChangeText={setPartDesc}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TextInput
              placeholder="Quantity"
              placeholderTextColor="#71717A"
              value={partQty}
              onChangeText={setPartQty}
              keyboardType="numeric"
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TouchableOpacity
              onPress={handleRequestParts}
              disabled={actionLoading}
              className="bg-[#0D7A5F] py-2 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-xs">Send Request to Store</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Step 8: Road Test */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-sky-400 text-[10px] uppercase font-bold mb-1">Step 8: Bike Road Test</Text>
        <Text className="text-white text-xs">{job.testingNotes || "Road test not logged yet."}</Text>

        <TouchableOpacity
          onPress={() => setShowTest(!showTest)}
          className="mt-2.5 bg-zinc-800 py-2 rounded-xl items-center"
        >
          <Text className="text-zinc-200 text-xs font-bold">Log Road Test Results</Text>
        </TouchableOpacity>

        {showTest && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
            <TextInput
              placeholder="Test observation (e.g. Smooth road test, brakes sharp)"
              placeholderTextColor="#71717A"
              value={testResult}
              onChangeText={setTestResult}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TouchableOpacity
              onPress={handleSaveTest}
              disabled={actionLoading}
              className="bg-sky-600 py-2 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-xs">Save Test Results</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Step 9: Complete & Scrap */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-8">
        <Text className="text-emerald-400 text-[10px] uppercase font-bold mb-1">Step 9: Complete Work & Scrap</Text>
        <Text className="text-white text-xs">{job.workDoneSummary || "Job still in progress."}</Text>

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
              placeholder="Old Replaced Part for Scrap (Optional)"
              placeholderTextColor="#71717A"
              value={scrapPart}
              onChangeText={setScrapPart}
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
