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
import { Snowflake } from "lucide-react-native";
import { WorkshopHvacApi } from "@/services/api";

export default function NewHvacIntakeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [unitType, setUnitType] = useState("1.5 Ton Inverter AC");
  const [brandModel, setBrandModel] = useState("Gree Fairy Inverter");
  const [serialNo, setSerialNo] = useState("");
  const [refrigerant, setRefrigerant] = useState("R410A");
  const [compressor, setCompressor] = useState("Twin Rotary Inverter");
  const [site, setSite] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [complaint, setComplaint] = useState("");

  const handleSubmit = async () => {
    if (!unitType.trim() || !brandModel.trim() || !complaint.trim()) {
      Alert.alert("Required", "Unit Type, Brand/Model, and Complaint are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await WorkshopHvacApi.createJob({
        unitType,
        brandModel,
        serialNumber: serialNo ? serialNo.toUpperCase() : undefined,
        refrigerantType: refrigerant,
        compressorSpec: compressor,
        customerSite: site.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        complaint: complaint.trim(),
      });

      if (res.success) {
        Alert.alert("HVAC Bench Card Created", `Job Card #${res.data.jobNumber} opened successfully!`, [
          { text: "Open Card", onPress: () => router.replace(`/jobs/${res.data.id}`) },
        ]);
      } else {
        Alert.alert("Error", res.error || "Failed to create bench card");
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
          <Snowflake color="#06B6D4" size={20} />
          <Text className="text-white text-base font-extrabold ml-2">HVAC Unit Intake Form</Text>
        </View>
        <Text className="text-zinc-400 text-xs">
          Step 1: Record unit type, serial numbers, customer site, and reported fault.
        </Text>
      </View>

      <View className="space-y-3">
        <View>
          <Text className="text-zinc-400 text-xs mb-1">Unit Type *</Text>
          <TextInput
            placeholder="e.g. 1.5 Ton Inverter AC / Floor Standing 4T"
            placeholderTextColor="#71717A"
            value={unitType}
            onChangeText={setUnitType}
            className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2.5 rounded-xl font-bold"
          />
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Brand & Model *</Text>
          <TextInput
            placeholder="e.g. Gree Fairy / Haier Dawn"
            placeholderTextColor="#71717A"
            value={brandModel}
            onChangeText={setBrandModel}
            className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2.5 rounded-xl font-bold"
          />
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Serial Number</Text>
            <TextInput
              placeholder="Outdoor / Indoor S/N"
              placeholderTextColor="#71717A"
              value={serialNo}
              onChangeText={(t) => setSerialNo(t.toUpperCase())}
              className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl font-mono"
            />
          </View>
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Refrigerant</Text>
            <TextInput
              placeholder="R410A / R32 / R22"
              placeholderTextColor="#71717A"
              value={refrigerant}
              onChangeText={setRefrigerant}
              className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl font-mono"
            />
          </View>
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Compressor Spec</Text>
          <TextInput
            placeholder="e.g. Twin Rotary Inverter"
            placeholderTextColor="#71717A"
            value={compressor}
            onChangeText={setCompressor}
            className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2.5 rounded-xl"
          />
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Customer / Site</Text>
            <TextInput
              placeholder="Client / Site Name"
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
          <Text className="text-zinc-400 text-xs mb-1">Site Location / Address</Text>
          <TextInput
            placeholder="e.g. Phase 5 DHA, Lahore"
            placeholderTextColor="#71717A"
            value={site}
            onChangeText={setSite}
            className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2.5 rounded-xl"
          />
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Reported Problem / Fault *</Text>
          <TextInput
            placeholder="e.g. Gas leakage at condenser, compressor tripping on high amps, PCB communication error."
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
            <Text className="text-white font-bold text-sm">Open HVAC Bench Card (Step 1)</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
