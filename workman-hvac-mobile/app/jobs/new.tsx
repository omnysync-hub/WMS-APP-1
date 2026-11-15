import React, { useEffect, useState } from "react";
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
import { useAuthStore } from "@/store/authStore";
import OptionPicker, { type PickerOption } from "@/components/OptionPicker";

export default function NewHvacIntakeScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);
  const [loading, setLoading] = useState(false);
  // No pre-filled unit defaults: a bench card must describe the unit that
  // actually arrived, not the last demo example.
  const [unitType, setUnitType] = useState("");
  const [brandModel, setBrandModel] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [refrigerant, setRefrigerant] = useState("");
  const [compressor, setCompressor] = useState("");
  const [site, setSite] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [complaint, setComplaint] = useState("");

  const [customerOptions, setCustomerOptions] = useState<PickerOption[]>([]);
  const [staffOptions, setStaffOptions] = useState<PickerOption[]>([]);
  const [customer, setCustomer] = useState<PickerOption | null>(null);
  const [technician, setTechnician] = useState<PickerOption | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await WorkshopHvacApi.getOptions();
        if (res.success && res.data) {
          setCustomerOptions(
            (res.data.customers || []).map((c: any) => ({
              id: c.id,
              label: c.name,
              sub: [c.phone, c.address].filter(Boolean).join(" • "),
              raw: c,
            }))
          );
          setStaffOptions(
            (res.data.staff || []).map((s: any) => ({
              id: s.id,
              label: s.name,
              sub: [s.designation || s.role, s.department].filter(Boolean).join(" • "),
            }))
          );
        }
      } catch {
        // Pickers are optional helpers — free-text intake still works offline-ish.
      }
    })();
  }, []);

  const pickCustomer = (opt: PickerOption | null) => {
    setCustomer(opt);
    if (opt) {
      const raw = (opt as any).raw;
      setCustomerName(opt.label);
      if (raw?.phone) setCustomerPhone(String(raw.phone));
      if (raw?.address && !site) setSite(String(raw.address));
    }
  };

  const handleSubmit = async () => {
    if (!unitType.trim() || !brandModel.trim() || !complaint.trim()) {
      Alert.alert("Required", "Unit Type, Brand/Model, and Complaint are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await WorkshopHvacApi.createJob({
        unitType: unitType.trim(),
        brandModel: brandModel.trim(),
        serialNumber: serialNo.trim() ? serialNo.trim().toUpperCase() : undefined,
        refrigerantType: refrigerant.trim() || undefined,
        compressorSpec: compressor.trim() || undefined,
        customerSite: site.trim() || undefined,
        customerId: customer?.id || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        complaint: complaint.trim(),
        supervisorName: employee?.name,
        supervisorId: employee?.id,
        // SOP Step 2 can happen right at intake when the supervisor already knows the assignee.
        assignedStaffId: technician?.id || undefined,
        assignedStaffName: technician?.label || undefined,
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
          {employee?.name ? ` Supervisor: ${employee.name}.` : ""}
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
              autoCapitalize="characters"
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

        <OptionPicker
          label="Existing Customer (optional — fills name/phone/site)"
          placeholder="Walk-in / type details below"
          options={customerOptions}
          value={customer}
          onChange={pickCustomer}
        />

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
          <Text className="text-zinc-400 text-xs mb-1">Site Location / Address</Text>
          <TextInput
            placeholder="e.g. Phase 5 DHA, Lahore"
            placeholderTextColor="#71717A"
            value={site}
            onChangeText={setSite}
            className="bg-[#121215] border border-[#27272A] text-white text-xs px-3 py-2.5 rounded-xl"
          />
        </View>

        <OptionPicker
          label="Assign Technician Now (Step 2 — optional)"
          placeholder="Leave unassigned (status stays Open)"
          options={staffOptions}
          value={technician}
          onChange={setTechnician}
        />

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
