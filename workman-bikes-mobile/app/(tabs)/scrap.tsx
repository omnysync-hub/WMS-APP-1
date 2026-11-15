import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { RotateCcw, AlertCircle } from "lucide-react-native";
import { WorkshopBikesApi, apiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { canDo, formatDateTime, formatMoney } from "@/lib/workshop";

/**
 * Scrap Register (SOP): replaced parts and used oil recorded against a job
 * card are handed to the Store, and can only be disposed of or sold with
 * Manager approval (a sale posts scrap income in the ERP).
 */
export default function BikeScrapScreen() {
  const role = useAuthStore((s) => s.workshopRole);
  const [scrapItems, setScrapItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saleAmount, setSaleAmount] = useState<Record<string, string>>({});
  const [sellOpen, setSellOpen] = useState<Record<string, boolean>>({});

  const loadScrap = useCallback(async () => {
    try {
      setError(null);
      const res = await WorkshopBikesApi.getScrap();
      if (res.success) setScrapItems(res.data || []);
      else setError(res.error || "Failed to load scrap items.");
    } catch (e: any) {
      setError(apiErrorMessage(e, "Failed to load scrap items."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadScrap();
  }, [loadScrap]);

  useFocusEffect(
    useCallback(() => {
      loadScrap();
    }, [loadScrap])
  );

  const runAction = async (key: string, fn: () => Promise<any>, msg: string) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res.success) {
        Alert.alert("Done", msg);
        loadScrap();
      } else {
        Alert.alert("Server Message", res.error || "Action failed.");
      }
    } catch (e: any) {
      Alert.alert("Server Message", apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      <Text className="text-white text-base font-extrabold mb-1">Bike Scrap & Replaced Parts</Text>
      <Text className="text-zinc-400 text-xs mb-3">
        Replaced clutch plates, used engine oil and other scrap. Record items on the job card, hand
        them to Store here; sale / disposal needs Manager approval.
      </Text>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F59E0B" size="large" />
          <Text className="text-zinc-500 text-xs mt-2">Loading scrap register...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <AlertCircle color="#F87171" size={32} />
          <Text className="text-red-300 text-sm font-bold mt-3 text-center">Could not load scrap</Text>
          <Text className="text-zinc-500 text-xs mt-1 text-center">{error}</Text>
          <TouchableOpacity onPress={loadScrap} className="bg-amber-500 px-4 py-2 rounded-xl mt-4">
            <Text className="text-black text-xs font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={scrapItems}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadScrap(); }} tintColor="#F59E0B" />
          }
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
                  <Text className={`text-[10px] font-bold ${item.customerKept ? "text-amber-300" : "text-zinc-300"}`}>
                    {item.customerKept ? "Customer Kept" : item.status}
                  </Text>
                </View>
              </View>

              <Text className="text-white text-sm font-bold mt-1.5">{item.itemDescription}</Text>
              <Text className="text-zinc-400 text-xs mt-0.5">
                Quantity: {item.quantity} {item.unit} • Recorded {formatDateTime(item.createdAt)}
                {item.jobCard?.bikeRegNo ? ` • Bike ${item.jobCard.bikeRegNo}` : ""}
              </Text>
              {item.returnedToStore && (
                <Text className="text-zinc-500 text-[11px] mt-0.5">
                  At Store since {formatDateTime(item.returnedToStoreAt)} • Keeper: {item.storeKeeperName || "-"}
                </Text>
              )}
              {item.status === "sold" && (
                <Text className="text-emerald-400 text-[11px] mt-0.5">
                  Sold for {formatMoney(item.disposalValue)} • Approved by {item.approvedBy || "-"}
                </Text>
              )}
              {item.status === "disposed" && item.disposalNotes && (
                <Text className="text-zinc-500 text-[11px] mt-0.5">Disposal: {item.disposalNotes}</Text>
              )}

              {/* Actions */}
              {!item.customerKept && item.status === "recorded" && canDo(role, "scrap_store") && (
                <TouchableOpacity
                  disabled={busy === `store-${item.id}`}
                  onPress={() =>
                    runAction(
                      `store-${item.id}`,
                      () => WorkshopBikesApi.returnScrapToStore(item.id),
                      "Scrap received at Store and entered in the Scrap Register."
                    )
                  }
                  className="bg-[#0D7A5F] py-2 rounded-xl items-center mt-2.5"
                >
                  <Text className="text-white font-bold text-xs">
                    {busy === `store-${item.id}` ? "Saving..." : "Hand Over to Store"}
                  </Text>
                </TouchableOpacity>
              )}

              {!item.customerKept && item.status === "in_store" && canDo(role, "scrap_dispose") && (
                <View className="mt-2.5">
                  {sellOpen[item.id] ? (
                    <View className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5">
                      <TextInput
                        placeholder="Sale amount (PKR)"
                        placeholderTextColor="#71717A"
                        value={saleAmount[item.id] || ""}
                        onChangeText={(t) => setSaleAmount((s) => ({ ...s, [item.id]: t }))}
                        keyboardType="numeric"
                        className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
                      />
                      <View className="flex-row gap-2 mt-2">
                        <TouchableOpacity
                          disabled={busy === `sell-${item.id}`}
                          onPress={() =>
                            runAction(
                              `sell-${item.id}`,
                              () =>
                                WorkshopBikesApi.disposeOrSellScrap(item.id, {
                                  actionType: "sold",
                                  saleAmount: Number(saleAmount[item.id]) || 0,
                                }),
                              "Scrap sold. The amount is posted as scrap income in the ERP."
                            )
                          }
                          className="flex-1 bg-emerald-600 py-2 rounded-lg items-center"
                        >
                          <Text className="text-white font-bold text-xs">Confirm Sale</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setSellOpen((s) => ({ ...s, [item.id]: false }))}
                          className="flex-1 bg-zinc-800 py-2 rounded-lg items-center"
                        >
                          <Text className="text-zinc-300 font-bold text-xs">Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => setSellOpen((s) => ({ ...s, [item.id]: true }))}
                        className="flex-1 bg-emerald-600 py-2 rounded-xl items-center"
                      >
                        <Text className="text-white font-bold text-xs">Sell Scrap</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={busy === `dispose-${item.id}`}
                        onPress={() =>
                          Alert.alert("Dispose Scrap", "Dispose of this scrap item with manager approval?", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Dispose",
                              style: "destructive",
                              onPress: () =>
                                runAction(
                                  `dispose-${item.id}`,
                                  () =>
                                    WorkshopBikesApi.disposeOrSellScrap(item.id, {
                                      actionType: "disposed",
                                      disposalNotes: "Disposed from Bikes workshop scrap register",
                                    }),
                                  "Scrap disposed with manager approval."
                                ),
                            },
                          ])
                        }
                        className="flex-1 bg-zinc-800 py-2 rounded-xl items-center"
                      >
                        <Text className="text-zinc-200 font-bold text-xs">Dispose</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {!item.customerKept && item.status === "in_store" && !canDo(role, "scrap_dispose") && (
                <Text className="text-zinc-500 text-[11px] mt-2">
                  In Store — sale / disposal requires the Workshop Manager.
                </Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}
