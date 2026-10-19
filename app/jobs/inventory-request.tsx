import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Minus, Package, Plus, Search, Trash2, X } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { fetchWarehouseProducts, requestJobInventory } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors, radius, space, tapMin, type } from "@/constants/theme";
import { formatMoney } from "@/lib/jobLineFormat";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Line = {
  key: string;
  label: string;
  qty: string;
};

export default function InventoryRequestModal() {
  const insets = useSafeAreaInsets();
  const { jobId, jobNumber } = useLocalSearchParams<{
    jobId: string;
    jobNumber?: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  const selectedProducts = useMemo(() => {
    return products.filter((p) => selected[p.id] != null);
  }, [products, selected]);

  const lines = useMemo(() => {
    return selectedProducts.map((p) => ({
      key: p.id,
      label: `${p.name}${p.sku ? ` (${p.sku})` : ""}`,
      qty: selected[p.id] || "1",
    }));
  }, [selectedProducts, selected]);

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

  function updateQty(id: string, delta: number) {
    void haptic.select();
    setSelected((prev) => {
      const cur = Math.max(1, Number(prev[id] || 1) + delta);
      return { ...prev, [id]: String(cur) };
    });
  }

  function setQtyDirect(id: string, text: string) {
    const sanitized = text.replace(/[^\d]/g, "");
    setSelected((prev) => ({
      ...prev,
      [id]: sanitized || "1",
    }));
  }

  function removeProduct(id: string) {
    void haptic.warn();
    setSelected((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Request inventory"
          subtitle={`Job ${jobNumber || jobId} — request stock from warehouse`}
        />

        {/* Dropdown Selector trigger */}
        <Text style={{ color: colors.textDim, marginBottom: space.sm, ...type.label }}>
          WAREHOUSE CATALOG
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open searchable inventory catalog dropdown"
          onPress={() => {
            void haptic.press();
            setIsDropdownOpen(true);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: selectedProducts.length > 0 ? colors.primary : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: 14,
            minHeight: tapMin,
            marginBottom: space.lg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <Package size={20} color={colors.primary} />
            <Text
              style={{
                color: selectedProducts.length > 0 ? colors.text : colors.textDim,
                fontSize: 15,
                fontWeight: selectedProducts.length > 0 ? "700" : "500",
                flex: 1,
              }}
              numberOfLines={1}
            >
              {selectedProducts.length > 0
                ? `${selectedProducts.length} part${selectedProducts.length === 1 ? "" : "s"} selected from store`
                : products.length > 0
                  ? `Choose parts from warehouse (${products.length} available)...`
                  : "Loading warehouse parts..."}
            </Text>
          </View>
          <ChevronDown size={20} color={colors.textDim} />
        </Pressable>

        {/* Selected Catalog Parts */}
        {selectedProducts.length > 0 && (
          <View style={{ marginBottom: space.lg, gap: space.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.textDim, ...type.label }}>
                PARTS TO REQUEST ({selectedProducts.length})
              </Text>
              <Pressable
                onPress={() => setIsDropdownOpen(true)}
                style={{ paddingVertical: 4, paddingHorizontal: 8 }}
              >
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                  + Add more parts
                </Text>
              </Pressable>
            </View>

            {selectedProducts.map((p) => {
              const qtyVal = selected[p.id] || "1";
              return (
                <View
                  key={p.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: space.md,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                        {p.name}
                      </Text>
                      {p.sku ? (
                        <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                          SKU: {p.sku}
                        </Text>
                      ) : null}
                      {p.unitPrice != null ? (
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
                          {formatMoney(p.unitPrice)}
                        </Text>
                      ) : null}
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${p.name}`}
                      onPress={() => removeProduct(p.id)}
                      style={{ padding: 6 }}
                    >
                      <Trash2 size={18} color={colors.danger} />
                    </Pressable>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: colors.surfaceElevated,
                      borderRadius: radius.sm,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: "600" }}>
                      Requested Quantity
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Decrease quantity"
                        onPress={() => updateQty(p.id, -1)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.sm,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Minus size={14} color={colors.text} />
                      </Pressable>

                      <TextInput
                        value={qtyVal}
                        onChangeText={(t) => setQtyDirect(p.id, t)}
                        keyboardType="number-pad"
                        style={{
                          width: 50,
                          height: 32,
                          backgroundColor: colors.surface,
                          color: colors.text,
                          borderRadius: radius.sm,
                          textAlign: "center",
                          fontWeight: "800",
                          fontSize: 14,
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingVertical: 0,
                        }}
                      />

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Increase quantity"
                        onPress={() => updateQty(p.id, 1)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.sm,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Plus size={14} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}


        <View style={{ marginTop: space.xl, gap: space.sm }}>
          <Text
            style={{
              color: colors.textMuted,
              textAlign: "center",
              ...type.subtitle,
            }}
          >
            {lines.length === 0
              ? "Select parts using the dropdown above"
              : `${lines.length} part request${lines.length === 1 ? "" : "s"} ready to send`}
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
        </View>
      </ScrollView>

      {/* Accessible Searchable Dropdown Modal */}
      <Modal
        visible={isDropdownOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsDropdownOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Modal Header */}
          <View
            style={{
              paddingHorizontal: space.lg,
              paddingTop: Math.max(insets.top, space.lg),
              paddingBottom: space.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
                Select warehouse parts
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                Search and tap parts to include in your request
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close parts selector"
              onPress={() => setIsDropdownOpen(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surfaceElevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Search Box */}
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 12,
              }}
            >
              <Search size={18} color={colors.textDim} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by part name or SKU…"
                placeholderTextColor={colors.textDim}
                autoCorrect={false}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  color: colors.text,
                  paddingHorizontal: 10,
                  paddingVertical: 12,
                  fontSize: 15,
                  minHeight: 46,
                }}
              />
              {search ? (
                <Pressable onPress={() => setSearch("")} style={{ padding: 4 }}>
                  <X size={16} color={colors.textDim} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Catalog List */}
          {productsQuery.isLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={{ color: colors.textDim, marginTop: 10 }}>Loading warehouse catalog…</Text>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: space.xl }}>
              <Text style={{ color: colors.textMuted, fontSize: 15, textAlign: "center" }}>
                No parts match “{search.trim()}”.
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 6, textAlign: "center" }}>
                Try searching with a different keyword or SKU.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 110 + insets.bottom }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: p }) => {
                const on = selected[p.id] != null;
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${p.name}${p.sku ? `, SKU ${p.sku}` : ""}`}
                    onPress={() => toggleProduct(p.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderRadius: radius.md,
                      backgroundColor: on ? colors.primaryMuted : colors.surface,
                      borderWidth: 1,
                      borderColor: on ? colors.primary : colors.border,
                      marginBottom: 8,
                      minHeight: 56,
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
                      {on ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                        {p.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
                        {p.sku ? (
                          <Text style={{ color: colors.textDim, fontSize: 12 }}>
                            SKU: {p.sku}
                          </Text>
                        ) : null}
                        {p.unitPrice != null ? (
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                            {formatMoney(p.unitPrice)}
                          </Text>
                        ) : null}
                        {p.stockQuantity != null ? (
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                            · Stock: {p.stockQuantity}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          {/* Modal Bottom Bar */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.surfaceElevated,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingHorizontal: space.md,
              paddingTop: space.md,
              paddingBottom: Math.max(insets.bottom, space.md),
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
              {selectedProducts.length} selected
            </Text>
            <Button
              title="Done selecting"
              size="md"
              onPress={() => setIsDropdownOpen(false)}
              style={{ minWidth: 140 }}
            />
          </View>
        </View>
      </Modal>
    </View>
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
