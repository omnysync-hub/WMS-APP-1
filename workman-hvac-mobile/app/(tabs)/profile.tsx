import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert } from "react-native";
import { User, Server } from "lucide-react-native";
import { useAuthStore } from "@/store/authStore";
import { ERP_BASE_URL, setStoredApiUrl } from "@/services/api";

export default function HvacProfileScreen() {
  const { techName, benchRig, setTech } = useAuthStore();
  const [nameInput, setNameInput] = useState(techName);
  const [rigInput, setRigInput] = useState(benchRig);
  const [urlInput, setUrlInput] = useState(ERP_BASE_URL);

  const handleSave = async () => {
    setTech("h1", nameInput, rigInput);
    if (urlInput.trim()) {
      await setStoredApiUrl(urlInput.trim());
    }
    Alert.alert("Saved", "HVAC technician profile and server settings updated.");
  };

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-4">
        <Text className="text-cyan-400 text-xs font-bold uppercase mb-1">Bench Technician Persona</Text>
        <Text className="text-white text-lg font-extrabold">{techName}</Text>
        <Text className="text-zinc-400 text-xs mt-0.5">{benchRig}</Text>
      </View>

      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl space-y-3">
        <Text className="text-white text-sm font-bold">Edit Profile & Bench Station</Text>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Technician Name</Text>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
          />
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Assigned Bench Rig</Text>
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
            className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
          />
        </View>

        <TouchableOpacity
          onPress={handleSave}
          className="bg-cyan-500 py-2.5 rounded-xl items-center mt-2"
        >
          <Text className="text-black font-bold text-xs">Save Profile Changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
