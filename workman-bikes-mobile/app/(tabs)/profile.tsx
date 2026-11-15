import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView } from "react-native";
import { ShieldCheck, LogOut } from "lucide-react-native";
import { useAuthStore } from "@/store/authStore";
import { ERP_BASE_URL, getStoredApiUrl, setStoredApiUrl } from "@/services/api";
import { WORKSHOP_ROLE_LABELS } from "@/lib/workshop";

/**
 * Profile: the signed-in ERP employee (identity comes from the ERP login and
 * cannot be edited here), local workstation preferences, server URL, sign out.
 */
export default function BikeProfileScreen() {
  const employee = useAuthStore((s) => s.employee);
  const workshopRole = useAuthStore((s) => s.workshopRole);
  const bayNumber = useAuthStore((s) => s.bayNumber);
  const setBayNumber = useAuthStore((s) => s.setBayNumber);
  const shiftStatus = useAuthStore((s) => s.shiftStatus);
  const setShiftStatus = useAuthStore((s) => s.setShiftStatus);
  const logout = useAuthStore((s) => s.logout);

  const [bayInput, setBayInput] = useState(bayNumber);
  const [urlInput, setUrlInput] = useState(ERP_BASE_URL);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    getStoredApiUrl().then(setUrlInput).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      setBayNumber(bayInput.trim() || bayNumber);
      if (urlInput.trim() && urlInput.trim() !== ERP_BASE_URL) {
        await setStoredApiUrl(urlInput.trim());
      }
      Alert.alert("Saved", "Workstation preferences and server settings updated.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Sign out of the Bikes Workshop app on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          // Root layout redirects to /login when the session clears.
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-[#09090B] p-4">
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-4">
        <Text className="text-amber-400 text-xs font-bold uppercase mb-1">
          {WORKSHOP_ROLE_LABELS[workshopRole]}
        </Text>
        <Text className="text-white text-lg font-extrabold">{employee?.name || "Workshop User"}</Text>
        <Text className="text-zinc-400 text-xs mt-0.5">
          {employee?.designation || employee?.role || "-"}
          {employee?.department ? ` • ${employee.department}` : ""}
        </Text>
        <Text className="text-zinc-500 text-xs mt-0.5">
          {employee?.phone || ""}
          {employee?.email ? ` • ${employee.email}` : ""}
        </Text>
        <View className="flex-row items-center mt-2.5">
          <ShieldCheck color="#34D399" size={13} />
          <Text className="text-emerald-400 text-[11px] ml-1">
            Signed in with your ERP account — your name is recorded on every job action.
          </Text>
        </View>
      </View>

      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-4">
        <Text className="text-white text-sm font-bold mb-3">Workstation Preferences</Text>

        <Text className="text-zinc-400 text-xs mb-1">Assigned Bay (shown on the Jobs screen)</Text>
        <TextInput
          value={bayInput}
          onChangeText={setBayInput}
          className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
        />

        <Text className="text-zinc-400 text-xs mb-1 mt-3">Shift Status</Text>
        <View className="flex-row gap-2">
          {(
            [
              { v: "active", label: "Active" },
              { v: "break", label: "On Break" },
              { v: "off_duty", label: "Off Duty" },
            ] as const
          ).map((opt) => (
            <TouchableOpacity
              key={opt.v}
              onPress={() => setShiftStatus(opt.v)}
              className={`flex-1 py-2 rounded-lg items-center ${shiftStatus === opt.v ? "bg-amber-500" : "bg-zinc-800"}`}
            >
              <Text className={`font-bold text-[11px] ${shiftStatus === opt.v ? "text-black" : "text-zinc-300"}`}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-zinc-400 text-xs mb-1 mt-4">ERP Server URL</Text>
        <TextInput
          value={urlInput}
          onChangeText={setUrlInput}
          autoCapitalize="none"
          autoCorrect={false}
          className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
        />

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-amber-500 py-2.5 rounded-xl items-center mt-4"
        >
          <Text className="text-black font-bold text-xs">{saving ? "Saving..." : "Save Preferences"}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleLogout}
        className="flex-row items-center justify-center bg-red-950/60 border border-red-900 py-3 rounded-xl mb-8"
      >
        <LogOut color="#FCA5A5" size={16} />
        <Text className="text-red-300 font-bold text-xs ml-2">Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
