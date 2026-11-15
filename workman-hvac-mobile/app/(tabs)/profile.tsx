import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { ERP_BASE_URL, setStoredApiUrl } from "@/services/api";

export default function HvacProfileScreen() {
  const employee = useAuthStore((s) => s.employee);
  const benchRig = useAuthStore((s) => s.benchRig);
  const setBenchRig = useAuthStore((s) => s.setBenchRig);
  const logout = useAuthStore((s) => s.logout);
  const [rigInput, setRigInput] = useState(benchRig);
  const [urlInput, setUrlInput] = useState(ERP_BASE_URL);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setBenchRig(rigInput);
      if (urlInput.trim() && urlInput.trim() !== ERP_BASE_URL) {
        await setStoredApiUrl(urlInput.trim());
      }
      Alert.alert("Saved", "Bench station and server settings updated.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Sign out of the HVAC workshop app on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          // Root layout guard returns to the sign-in screen automatically.
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      {/* Real ERP identity — comes from the signed mobile session, not free text. */}
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-4">
        <Text className="text-cyan-400 text-xs font-bold uppercase mb-1">Signed In (ERP Account)</Text>
        <Text className="text-white text-lg font-extrabold">{employee?.name || "—"}</Text>
        <Text className="text-zinc-400 text-xs mt-0.5 capitalize">
          {employee?.role || ""}
          {employee?.designation ? ` • ${employee.designation}` : ""}
          {employee?.department ? ` • ${employee.department}` : ""}
        </Text>
        {!!employee?.phone && <Text className="text-zinc-500 text-xs mt-0.5">{employee.phone}</Text>}
        {!!employee?.email && <Text className="text-zinc-500 text-xs">{employee.email}</Text>}
        <Text className="text-zinc-500 text-xs mt-1">Bench Station: {benchRig}</Text>
      </View>

      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl space-y-3">
        <Text className="text-white text-sm font-bold">Device & Server Settings</Text>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Assigned Bench Rig (this device)</Text>
          <TextInput
            value={rigInput}
            onChangeText={setRigInput}
            className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
          />
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">ERP Server URL</Text>
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
            className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
          />
          <Text className="text-zinc-600 text-[10px] mt-1">
            Default: https://softwareworkmanservices.com.pk — only change this for a staging server.
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-cyan-500 py-2.5 rounded-xl items-center mt-2"
        >
          <Text className="text-black font-bold text-xs">Save Settings</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleLogout}
        className="bg-red-950/60 border border-red-900 py-3 rounded-xl items-center mt-4"
      >
        <Text className="text-red-300 font-bold text-xs">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
