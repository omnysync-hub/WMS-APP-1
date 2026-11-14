import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert } from "react-native";
import { User, Server, ShieldCheck, LogOut } from "lucide-react-native";
import { useAuthStore } from "@/store/authStore";
import { ERP_BASE_URL, setStoredApiUrl } from "@/services/api";

export default function BikeProfileScreen() {
  const { mechanicName, bayNumber, setMechanic } = useAuthStore();
  const [nameInput, setNameInput] = useState(mechanicName);
  const [bayInput, setBayInput] = useState(bayNumber);
  const [urlInput, setUrlInput] = useState(ERP_BASE_URL);

  const handleSave = async () => {
    setMechanic("m1", nameInput, bayInput);
    if (urlInput.trim()) {
      await setStoredApiUrl(urlInput.trim());
    }
    Alert.alert("Saved", "Mechanic profile and server settings updated.");
  };

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-4">
        <Text className="text-amber-400 text-xs font-bold uppercase mb-1">Floor Technician Persona</Text>
        <Text className="text-white text-lg font-extrabold">{mechanicName}</Text>
        <Text className="text-zinc-400 text-xs mt-0.5">{bayNumber}</Text>
      </View>

      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl space-y-3">
        <Text className="text-white text-sm font-bold">Edit Profile & Work Station</Text>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Mechanic Name</Text>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl"
          />
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Assigned Bay</Text>
          <TextInput
            value={bayInput}
            onChangeText={setBayInput}
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
          className="bg-amber-500 py-2.5 rounded-xl items-center mt-2"
        >
          <Text className="text-black font-bold text-xs">Save Profile Changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
