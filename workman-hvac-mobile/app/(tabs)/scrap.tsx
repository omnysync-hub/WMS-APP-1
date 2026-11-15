import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { RotateCcw } from "lucide-react-native";
import { WorkshopHvacApi } from "@/services/api";
import { formatDateTime } from "@/components/jobUi";

export default function HvacScrapScreen() {
  const [scrapItems, setScrapItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Dispose/sell panel state
  const [openId, setOpenId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"sold" | "disposed">("sold");
  const [saleAmount, setSaleAmount] = useState("");
  const [disposalNotes, setDisposalNotes] = useState("");

  const loadScrap = useCallback(async () => {
    try {
      setError(null);
      const res = await WorkshopHvacApi.getScrap();
      if (res.success) {
        setScrapItems(res.data || []);
      } else {
        setError(res.error || "Could not load the scrap register");
      }
    } catch (e: any) {
      setError(e?.message || "Could not load the scrap register");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadScrap();
    }, [loadScrap])
  );

  const run = async (fn: () => Promise<any>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res && res.success === false) {
        Alert.alert("Blocked", res.error || "Action rejected by the server.");
        return false;
      }
      Alert.alert("Done", successMsg);
      await loadScrap();
      return true;
    } catch (e: any) {
      Alert.alert("Blocked", e?.message || "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleReturnToStore = (item: any) =>
    run(
      () => WorkshopHvacApi.returnScrapToStore(item.id),
      `${item.itemDescription} received at Store and entered in the Scrap Register.`
    );

  const handleDisposeOrSell = async (item: any) => {
    if (actionType === "sold" && (!saleAmount || Number(saleAmount) <= 0)) {
      Alert.alert("Required", "Enter the sale amount — it is posted as scrap income in the ERP accounts.");
      return;
    }
    const ok = await run(
      () =>
        WorkshopHvacApi.disposeOrSellScrap(item.id, {
          actionType,
          saleAmount: actionType === "sold" ? Number(saleAmount) : 0,
          disposalNotes: disposalNotes.trim() || undefined,
        }),
      actionType === "sold"
        ? `Scrap sold for PKR ${Number(saleAmount).toLocaleString()} with Manager approval.`
        : "Scrap disposed with Manager approval."
    );
    if (ok) {
      setOpenId(null);
      setSaleAmount("");
      setDisposalNotes("");
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#09090B] items-center justify-center">
        <ActivityIndicator color="#06B6D4" size="large" />
        <Text className="text-zinc-500 text-xs mt-2">Loading scrap register…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      <Text className="text-white text-base font-extrabold mb-1">HVAC Scrap & Salvage Register</Text>
      <Text className="text-zinc-400 text-xs mb-3">
        Burnt compressors, copper offcuts, empty cylinders. Hand scrap to the Store, then the
        Manager approves disposal or sale — sale money becomes scrap income in the ERP.
      </Text>

      {error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-400 text-xs text-center">{error}</Text>
          <TouchableOpacity onPress={loadScrap} className="bg-cyan-500 px-4 py-2 rounded-xl mt-3">
            <Text className="text-black text-xs font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={scrapItems}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadScrap(); }} tintColor="#06B6D4" />}
          ListEmptyComponent={
            <View className="py-12 items-center justify-center border border-dashed border-zinc-800 rounded-2xl">
              <RotateCcw color="#71717A" size={32} />
              <Text className="text-zinc-500 text-xs mt-2">No HVAC scrap recorded yet</Text>
              <Text className="text-zinc-600 text-[10px] mt-1">Record replaced parts from a job card.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-2.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-cyan-400 font-mono text-xs font-bold">
                  {item.jobCard?.jobNumber || "HVAC Scrap"}
                </Text>
                <View
                  className={`px-2 py-0.5 rounded-full ${
                    item.customerKept ? "bg-amber-950/80 border border-amber-800" : "bg-zinc-800"
                  }`}
                >
                  <Text className={`text-[10px] font-bold ${item.customerKept ? "text-amber-300" : "text-zinc-400"}`}>
                    {item.customerKept ? "Customer Retained" : item.status}
                  </Text>
                </View>
              </View>

              <Text className="text-white text-sm font-bold mt-1.5">{item.itemDescription}</Text>
              <Text className="text-zinc-400 text-xs mt-0.5">
                Quantity: {item.quantity} {item.unit} • {formatDateTime(item.createdAt)}
              </Text>
              {item.returnedToStore && (
                <Text className="text-zinc-500 text-[11px]">
                  At Store since {formatDateTime(item.returnedToStoreAt)}
                  {item.storeKeeperName ? ` • received by ${item.storeKeeperName}` : ""}
                </Text>
              )}
              {(item.status === "sold" || item.status === "disposed") && (
                <Text className="text-zinc-500 text-[11px]">
                  {item.status === "sold" ? `Sold for PKR ${Number(item.disposalValue || 0).toLocaleString()}` : "Disposed"}
                  {item.approvedBy ? ` • approved by ${item.approvedBy}` : ""}
                  {item.disposalNotes ? ` • ${item.disposalNotes}` : ""}
                </Text>
              )}

              {/* Actions by lifecycle stage */}
              {!item.customerKept && item.status === "recorded" && (
                <TouchableOpacity
                  onPress={() => handleReturnToStore(item)}
                  disabled={busy}
                  className="mt-2.5 bg-cyan-600 py-2 rounded-xl items-center"
                >
                  <Text className="text-white text-xs font-bold">Hand Over to Store (Scrap Register)</Text>
                </TouchableOpacity>
              )}

              {!item.customerKept && item.status === "in_store" && (
                <>
                  <TouchableOpacity
                    onPress={() => { setOpenId(openId === item.id ? null : item.id); setActionType("sold"); }}
                    className="mt-2.5 bg-zinc-800 py-2 rounded-xl items-center"
                  >
                    <Text className="text-zinc-200 text-xs font-bold">Sell / Dispose (Manager Approval)</Text>
                  </TouchableOpacity>
                  {openId === item.id && (
                    <View className="mt-2.5 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
                      <View className="flex-row gap-2">
                        {(
                          [
                            { v: "sold", label: "Sell" },
                            { v: "disposed", label: "Dispose" },
                          ] as const
                        ).map((o) => (
                          <TouchableOpacity
                            key={o.v}
                            onPress={() => setActionType(o.v)}
                            className={`flex-1 py-2 rounded-lg items-center ${actionType === o.v ? "bg-amber-600" : "bg-zinc-800"}`}
                          >
                            <Text className="text-white text-xs font-bold">{o.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {actionType === "sold" && (
                        <TextInput
                          placeholder="Sale amount (PKR) *"
                          placeholderTextColor="#71717A"
                          value={saleAmount}
                          onChangeText={setSaleAmount}
                          keyboardType="numeric"
                          className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
                        />
                      )}
                      <TextInput
                        placeholder="Notes (buyer / disposal method)"
                        placeholderTextColor="#71717A"
                        value={disposalNotes}
                        onChangeText={setDisposalNotes}
                        className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
                      />
                      <TouchableOpacity
                        onPress={() => handleDisposeOrSell(item)}
                        disabled={busy}
                        className="bg-amber-600 py-2 rounded-lg items-center"
                      >
                        <Text className="text-white font-bold text-xs">
                          {actionType === "sold" ? "Approve Sale" : "Approve Disposal"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}
