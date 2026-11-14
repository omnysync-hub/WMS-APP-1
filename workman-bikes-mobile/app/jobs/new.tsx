import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Bike } from "lucide-react-native";
import { WorkshopBikesApi } from "@/services/api";

export default function NewBikeIntakeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [regNo, setRegNo] = useState("");
  const [makeModel, setMakeModel] = useState("Honda CD 70");
  const [chassis, setChassis] = useState("");
  const [engine, setEngine] = useState("");
  const [km, setKm] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [complaint, setComplaint] = useState("");

  const handleSubmit = async () => {
    if (!regNo.trim() || !complaint.trim()) {
      Alert.alert("Required", "Bike Registration Number and Complaint are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await WorkshopBikesApi.createJob({
        bikeRegNo: regNo.toUpperCase(),
        bikeMakeModel: makeModel,
        chassisNumber: chassis ? chassis.toUpperCase() : undefined,
        engineNumber: engine ? engine.toUpperCase() : undefined,
        currentKm: km ? Number(km) : undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        complaint: complaint.trim(),
      });

      if (res.success) {
        Alert.alert("Job Card Created", `Job Card #${res.data.jobNumber} opened successfully!`, [
          { text: "Open Card", onPress: () => router.replace(`/jobs/${res.data.id}`) },
        ]);
      } else {
        Alert.alert("Error", res.error || "Failed to create job card");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#09090B] p-4">
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-4">
        <View className="flex-row items-center mb-1">
          <Bike color="#F59E0B" size={20} />
          <Text className="text-white text-base font-extrabold ml-2">Bike Intake Form</Text>
        </View>
        <Text className="text-zinc-400 text-xs">
          Step 1: Record bike identification and client complaint at the workshop gate.
        </Text>
      </View>

      <View className="space-y-3">
        <View>
          <Text className="text-zinc-400 text-xs mb-1">Bike Registration Number *</Text>
          <TextInput
            placeholder="e.g. LE-20-4560"
            placeholderTextColor="#71717A"
            value={regNo}
            onChangeText={(t) => setRegNo(t.toUpperCase())}
            className="bg-[#121215] border border-[#27272A] text-white text-sm px-3 py-2.5 rounded-xl font-bold"
          />
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Make & Model</Text>
          <TextInput
            placeholder="e.g. Honda CD 70 / CG 125"
            placeholderTextColor="#71717A"
            value={makeModel}
            onChangeText={setMakeModel}
            className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2.5 rounded-xl"
          />
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Chassis No</Text>
            <TextInput
              placeholder="Chassis #"
              placeholderTextColor="#71717A"
              value={chassis}
              onChangeText={(t) => setChassis(t.toUpperCase())}
              className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
            />
          </View>
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Engine No</Text>
            <TextInput
              placeholder="Engine #"
              placeholderTextColor="#71717A"
              value={engine}
              onChangeText={(t) => setEngine(t.toUpperCase())}
              className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
            />
          </View>
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Current Odometer (Km)</Text>
          <TextInput
            placeholder="e.g. 18500"
            placeholderTextColor="#71717A"
            value={km}
            onChangeText={setKm}
            keyboardType="numeric"
            className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2.5 rounded-xl"
          />
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Customer Name</Text>
            <TextInput
              placeholder="Client Name"
              placeholderTextColor="#71717A"
              value={customerName}
              onChangeText={setCustomerName}
              className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
            />
          </View>
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Phone</Text>
            <TextInput
              placeholder="03001234567"
              placeholderTextColor="#71717A"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
              className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
            />
          </View>
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Client Complaint / Problem *</Text>
          <TextInput
            placeholder="e.g. Engine oil leak, clutch plates slipping, front brake noisy."
            placeholderTextColor="#71717A"
            value={complaint}
            onChangeText={setComplaint}
            multiline
            numberOfLines={3}
            className="bg-[#121215] border border-[#27272A] text-white text-xs p-3 rounded-xl"
          />
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          className="bg-[#0D7A5F] py-3.5 rounded-xl items-center mt-4 mb-8"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text className="text-white font-bold text-sm">Open Job Card (Step 1)</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
