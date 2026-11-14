import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { RotateCcw, AlertTriangle } from "lucide-react-native";
import { WorkshopBikesApi } from "@/services/api";

export default function BikeScrapScreen() {
  const [scrapItems, setScrapItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScrap = async () => {
    try {
      const res = await WorkshopBikesApi.getScrap();
      if (res.success) {
        setScrapItems(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScrap();
  }, []);

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      <Text className="text-white text-base font-extrabold mb-1">Bike Scrap & Replaced Parts</Text>
      <Text className="text-zinc-400 text-xs mb-3">
        Log replaced clutch plates, used engine oil, and customer-retained items.
      </Text>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F59E0B" size="large" />
        </View>
      ) : (
        <FlatList
          data={scrapItems}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="py-12 items-center justify-center border border-dashed border-zinc-800 rounded-2xl">
              <RotateCcw color="#71717A" size={32} />
              <Text className="text-zinc-500 text-xs mt-2">No scrap items recorded</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-2.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-amber-400 font-mono text-xs font-bold">
                  {item.jobCard?.jobNumber || "General Scrap"}
                </Text>
                <View
                  className={`px-2 py-0.5 rounded-full ${
                    item.customerKept ? "bg-amber-950/80 border border-amber-800" : "bg-zinc-800"
                  }`}
                >
                  <Text className={`text-[10px] font-bold ${item.customerKept ? "text-amber-300" : "text-zinc-400"}`}>
                    {item.customerKept ? "Customer Kept" : item.status}
                  </Text>
                </View>
              </View>

              <Text className="text-white text-sm font-bold mt-1.5">{item.itemDescription}</Text>
              <Text className="text-zinc-400 text-xs mt-0.5">Quantity: {item.quantity} {item.unit}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
