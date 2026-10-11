import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { fetchWarehouseProducts, requestJobInventory } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors, radius, space, tapMin, type } from "@/constants/theme";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";

type Line = {
  key: string;
  label: string;
  qty: string;
};

export default function InventoryRequestModal() {
  const { jobId, jobNumber } = useLocalSearchParams<{
    jobId: string;
    jobNumber?: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [customLines, setCustomLines] = useState<Line[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [search, setSearch] = useState("");

  const productsQuery = useQuery({
    queryKey: ["warehouse-products"],
    queryFn: fetchWarehouseProducts,
  });

  const products = productsQuery.data ?? [];

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      return name.includes(q) || sku.includes(q);
    });
  }, [products, search]);

  const lines = useMemo(() => {
    const fromCatalog: Line[] = products
      .filter((p) => selected[p.id] != null)
      .map((p) => ({
        key: p.id,
        label: `${p.name}${p.sku ? ` (${p.sku})` : ""}`,
        qty: selected[p.id] || "1",
      }));
    return [...fromCatalog, ...customLines];
  }, [products, selected, customLines]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id || !jobId) throw new Error("Sign in again");
      if (lines.length === 0) throw new Error("Pick at least one part");

      const results = [];
      for (const line of lines) {
        const qty = Math.max(1, Number(line.qty) || 1);
        const res = await requestJobInventory(jobId, {
          technicianId: employee.id,
          item: line.label,
          qtyRequested: qty,
        });
        results.push(res);
      }
      return results;
    },
    onSuccess: (results) => {
      const queued = results.some((r) => (r as { queued?: boolean })?.queued);
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      toast(
        queued
          ? `Saved ${results.length} offline — will send later`
          : `Sent ${results.length} part request${results.length === 1 ? "" : "s"}`,
        "success"
      );
      router.back();
    },
    onError: (e: Error) => {
      toast(e.message, "error");
      Alert.alert("Couldn't send", e.message);
    },
  });

  function toggleProduct(id: string) {
    void haptic.select();
    setSelected((prev) => {
      if (prev[id] != null) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: "1" };
    });
  }

  function addCustom() {
    const name = customDraft.trim();
    if (!name) {
      Alert.alert("Type a part name");
      return;
    }
    void haptic.press();
    setCustomLines((prev) => [
      ...prev,
      {
        key: `custom-${Date.now()}`,
        label: name,
        qty: String(Math.max(1, Number(customQty) || 1)),
      },
    ]);
    setCustomDraft("");
    setCustomQty("1");
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        title="Need parts"
        subtitle={`Job ${jobNumber || jobId} — select as many as you need`}
      />

      <Text style={{ color: colors.textDim, marginBottom: space.sm, ...type.label }}>
        Store list — search or tap to select
      </Text>

      {products.length > 0 ? (
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by part name or SKU…"
          placeholderTextColor={colors.textDim}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={[field, { marginBottom: space.md }]}
        />
      ) : null}

      {productsQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: space.lg }} />
      ) : products.length === 0 ? (
        <Text style={{ color: colors.textMuted, marginBottom: space.md, ...type.subtitle }}>
          Store list unavailable — type parts below.
        </Text>
      ) : filteredProducts.length === 0 ? (
        <Text style={{ color: colors.textMuted, marginBottom: space.md, ...type.subtitle }}>
          No parts match “{search.trim()}”. Try another name, or add a custom part below.
        </Text>
      ) : (
        filteredProducts.map((p) => {
          const on = selected[p.id] != null;
          return (
            <View
              key={p.id}
              style={{
                marginBottom: space.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.border,
                backgroundColor: on ? colors.primaryMuted : colors.surface,
                overflow: "hidden",
              }}
            >
              <Pressable
                onPress={() => toggleProduct(p.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  padding: space.md,
                  minHeight: tapMin,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: on ? colors.text : colors.border,
                    backgroundColor: on ? colors.primary : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {on ? <Check size={14} color={colors.text} strokeWidth={3} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{p.name}</Text>
                  {p.sku ? (
                    <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                      {p.sku}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              {on ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    paddingHorizontal: space.md,
                    paddingBottom: space.md,
                  }}
                >
                  <Text style={{ color: colors.textMuted, ...type.label }}>Qty</Text>
                  <TextInput
                    value={selected[p.id]}
                    onChangeText={(t) =>
                      setSelected((prev) => ({
                        ...prev,
                        [p.id]: t.replace(/[^\d]/g, ""),
                      }))
                    }
                    keyboardType="number-pad"
                    style={[field, { width: 72, minHeight: 44, paddingVertical: 10 }]}
                  />
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <Text
        style={{
          color: colors.textDim,
          marginTop: space.lg,
          marginBottom: space.sm,
          ...type.label,
        }}
      >
        Or add a custom part
      </Text>
      <TextInput
        value={customDraft}
        onChangeText={setCustomDraft}
        placeholder="e.g. 1/2″ brass ball valve"
        placeholderTextColor={colors.textDim}
        style={field}
      />
      <View
        style={{
          flexDirection: "row",
          gap: space.sm,
          marginTop: space.sm,
          alignItems: "center",
        }}
      >
        <TextInput
          value={customQty}
          onChangeText={setCustomQty}
          keyboardType="number-pad"
          placeholder="Qty"
          placeholderTextColor={colors.textDim}
          style={[field, { width: 72 }]}
        />
        <Button
          title="Add to list"
          variant="secondary"
          size="md"
          onPress={addCustom}
          style={{ flex: 1 }}
        />
      </View>

      {customLines.length > 0 ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <Text style={{ color: colors.textDim, ...type.label }}>Custom parts</Text>
          {customLines.map((line) => (
            <View
              key={line.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                padding: space.md,
              }}
            >
              <Text style={{ color: colors.text, flex: 1, fontWeight: "600" }}>{line.label}</Text>
              <TextInput
                value={line.qty}
                onChangeText={(t) =>
                  setCustomLines((prev) =>
                    prev.map((l) =>
                      l.key === line.key ? { ...l, qty: t.replace(/[^\d]/g, "") } : l
                    )
                  )
                }
                keyboardType="number-pad"
                style={[field, { width: 64, minHeight: 40, paddingVertical: 8 }]}
              />
              <Pressable
                onPress={() => setCustomLines((prev) => prev.filter((l) => l.key !== line.key))}
                style={{ minHeight: tapMin, justifyContent: "center", paddingHorizontal: 8 }}
              >
                <Text style={{ color: colors.danger, fontWeight: "700" }}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Text
        style={{
          color: colors.textMuted,
          marginTop: space.xl,
          marginBottom: space.sm,
          ...type.subtitle,
        }}
      >
        {lines.length === 0
          ? "Nothing selected yet"
          : `${lines.length} part${lines.length === 1 ? "" : "s"} ready to send`}
      </Text>

      <Button
        title={
          lines.length <= 1
            ? "Send to storekeeper"
            : `Send ${lines.length} parts to storekeeper`
        }
        loading={mutation.isPending}
        disabled={lines.length === 0}
        onPress={() => mutation.mutate()}
      />
    </ScrollView>
  );
}

const field = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  color: colors.text,
  paddingHorizontal: space.md,
  paddingVertical: 14,
  fontSize: 16,
  minHeight: 48,
} as const;
