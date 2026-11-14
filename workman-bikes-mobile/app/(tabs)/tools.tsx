import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Wrench, Check, RotateCcw, AlertCircle } from "lucide-react-native";
import { WorkshopBikesApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

export default function BikeToolsScreen() {
  const { mechanicName } = useAuthStore();
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTools = async () => {
    try {
      const res = await WorkshopBikesApi.getTools();
      if (res.success) {
        setTools(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, []);

  const handleIssue = async (tool: any) => {
    if (tool.availableQuantity <= 0) {
      Alert.alert("Unavailable", "No tools remaining in register.");
      return;
    }
    try {
      const res = await WorkshopBikesApi.issueTool(tool.id, mechanicName, 1);
      if (res.success) {
        Alert.alert("Success", `${tool.name} checked out to ${mechanicName}`);
        loadTools();
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleReturn = async (issueId: string) => {
    try {
      const res = await WorkshopBikesApi.returnTool(issueId, "Operational");
      if (res.success) {
        Alert.alert("Checked In", "Tool returned to Workshop Register.");
        loadTools();
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      <Text className="text-white text-base font-extrabold mb-1">Bike Workshop Tool Register</Text>
      <Text className="text-zinc-400 text-xs mb-3">
        Check out hand tools, torque wrenches, and testers directly from your phone.
      </Text>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F59E0B" size="large" />
        </View>
      ) : (
        <FlatList
          data={tools}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-amber-400 font-mono text-xs font-bold">{item.toolCode}</Text>
                <Text className="text-emerald-400 text-xs font-bold">{item.condition}</Text>
              </View>

              <Text className="text-white text-sm font-bold mt-1">{item.name}</Text>
              <Text className="text-zinc-500 text-xs">{item.category} • Location: {item.location || "Bay 2"}</Text>

              <View className="flex-row justify-between bg-[#18181B] p-2 rounded-xl mt-3">
                <Text className="text-zinc-400 text-xs">Total: {item.totalQuantity}</Text>
                <Text className="text-emerald-400 text-xs font-bold">Available: {item.availableQuantity}</Text>
              </View>

              {/* Active issues */}
              {item.issues && item.issues.length > 0 && (
                <View className="mt-2.5 pt-2 border-t border-zinc-800">
                  <Text className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Active Check-Outs:</Text>
                  {item.issues.map((iss: any) => (
                    <View key={iss.id} className="flex-row items-center justify-between bg-zinc-950 p-2 rounded-lg mb-1">
                      <Text className="text-white text-xs">{iss.staffName} (Qty: {iss.quantity})</Text>
                      <TouchableOpacity
                        onPress={() => handleReturn(iss.id)}
                        className="bg-zinc-800 px-2.5 py-1 rounded-lg"
                      >
                        <Text className="text-zinc-300 text-[10px] font-bold">Return</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                onPress={() => handleIssue(item)}
                disabled={item.availableQuantity <= 0}
                className={`mt-3 py-2 rounded-xl items-center ${
                  item.availableQuantity > 0 ? "bg-amber-500" : "bg-zinc-800 opacity-40"
                }`}
              >
                <Text className="text-black font-bold text-xs">Check Out Tool</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}
