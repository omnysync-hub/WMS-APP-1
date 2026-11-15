import React, { useState, useEffect } from "react";
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
import { WorkshopBikesApi, apiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { SearchPicker, type PickerItem } from "@/components/SearchPicker";

/**
 * SOP Step 1 - Unit Received & Job Card Created (Workshop Supervisor).
 * Bike fields per SOP: Reg No, Chassis / Engine No, Km, complaint.
 * The customer can be picked from the ERP customer list (avoids duplicate
 * walk-in records) and a mechanic can be assigned right at intake.
 */
export default function NewBikeIntakeScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);
  const [loading, setLoading] = useState(false);
  const [regNo, setRegNo] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [chassis, setChassis] = useState("");
  const [engine, setEngine] = useState("");
  const [km, setKm] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [complaint, setComplaint] = useState("");

  const [customers, setCustomers] = useState<PickerItem[]>([]);
  const [staff, setStaff] = useState<PickerItem[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await WorkshopBikesApi.getOptions();
        if (res.success) {
          setCustomers(
            (res.data.customers || []).map((c: any) => ({
              id: c.id,
              label: c.name,
              sub: c.phone || undefined,
            }))
          );
          setStaff(
            (res.data.staff || []).map((s: any) => ({
              id: s.id,
              label: s.name,
              sub: s.designation || s.role || undefined,
            }))
          );
        }
      } catch (e) {
        // Pickers are optional aids; free-text intake still works offline-ish.
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!regNo.trim() || !complaint.trim()) {
      Alert.alert("Required", "Bike Registration Number and Complaint are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await WorkshopBikesApi.createJob({
        bikeRegNo: regNo.trim().toUpperCase(),
        bikeMakeModel: makeModel.trim() || undefined,
        chassisNumber: chassis.trim() ? chassis.trim().toUpperCase() : undefined,
        engineNumber: engine.trim() ? engine.trim().toUpperCase() : undefined,
        currentKm: km ? Number(km) : undefined,
        customerId: customerId || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        complaint: complaint.trim(),
        supervisorName: employee?.name,
        supervisorId: employee?.id,
        assignedStaffId: staffId || undefined,
        assignedStaffName: staffName || undefined,
      });

      if (res.success) {
        Alert.alert("Job Card Created", `Job Card #${res.data.jobNumber} opened successfully!`, [
          {
            text: "Open Card",
            onPress: () =>
              router.replace({ pathname: "/jobs/[id]", params: { id: res.data.id } }),
          },
        ]);
      } else {
        Alert.alert("Error", res.error || "Failed to create job card");
      }
    } catch (e: any) {
      Alert.alert("Error", apiErrorMessage(e, "Failed to create job card"));
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

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Customer (pick from ERP, or type below)</Text>
          <SearchPicker
            placeholder="Select existing customer..."
            items={customers}
            selectedId={customerId}
            emptyText="No customer found - type the name below instead"
            onSelect={(item) => {
              setCustomerId(item.id);
              setCustomerName(item.label);
              if (item.sub) setCustomerPhone(item.sub);
            }}
          />
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-zinc-400 text-xs mb-1">Customer Name</Text>
            <TextInput
              placeholder="Client Name"
              placeholderTextColor="#71717A"
              value={customerName}
              onChangeText={(t) => {
                setCustomerName(t);
                setCustomerId(null);
              }}
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

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Assign Mechanic Now (Step 2, optional)</Text>
          <SearchPicker
            placeholder="Leave unassigned..."
            items={staff}
            selectedId={staffId}
            emptyText="No active staff found"
            onSelect={(item) => {
              setStaffId(item.id);
              setStaffName(item.label);
            }}
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
