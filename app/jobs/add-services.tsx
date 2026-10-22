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
import { Check, Plus, Trash2, Wrench } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { addJobServices, fetchCatalogServices, fetchJob, isServiceProduct } from "@/services/jobsService";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { useAuthStore } from "@/store/authStore";
import { colors, radius, space, tapMin, type } from "@/constants/theme";
import { formatMoney } from "@/lib/jobLineFormat";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";

type Row = {
  key: string;
  description: string;
  unitRate: string;
  quantity: string;
  catalogId?: string;
};

function emptyRow(): Row {
  return {
    key: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: "",
    unitRate: "",
    quantity: "1",
  };
}

export default function AddServicesModal() {
  const { jobId, jobNumber } = useLocalSearchParams<{
    jobId: string;
    jobNumber?: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    enabled: Boolean(jobId),
    queryFn: () => fetchJob(jobId!),
  });

  const catalogQuery = useQuery({
    queryKey: ["catalog-services"],
    queryFn: fetchCatalogServices,
  });

  // Strictly filter to ensure ONLY services are in catalog
  const catalog = useMemo(() => {
    return (catalogQuery.data ?? []).filter(isServiceProduct);
  }, [catalogQuery.data]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const total = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const rate = Math.max(0, Number(r.unitRate) || 0);
        const qty = Math.max(1, Number(r.quantity) || 1);
        return sum + rate * qty;
      }, 0),
    [rows]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("Missing job");
      const services = rows
        .map((r) => ({
          description: r.description.trim(),
          quantity: Math.max(1, Number(r.quantity) || 1),
          unitRate: Math.max(0, Number(r.unitRate) || 0),
        }))
        .filter((s) => s.description.length > 0);
      if (!services.length) throw new Error("Select or add at least one service");
      return addJobServices(jobId, services, employee?.name ?? "Technician");
    },
    onSuccess: () => {
      const count = rows.filter((r) => r.description.trim()).length;
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast(
        count <= 1 ? "Service added to job" : `${count} services added to job`,
        "success"
      );
      router.back();
    },
    onError: (e: Error) => {
      toast(e.message, "error");
      Alert.alert("Couldn't add services", e.message);
    },
  });

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleService(p: { id: string; name: string; unitPrice?: number }) {
    void haptic.select();
    setRows((prev) => {
      const existing = prev.find(
        (r) => r.catalogId === p.id || r.description.trim().toLowerCase() === p.name.trim().toLowerCase()
      );
      if (existing) {
        // Toggle off if already selected
        return prev.filter((r) => r.key !== existing.key);
      }
      return [
        ...prev,
        {
          key: `cat-${p.id}`,
          description: p.name,
          unitRate: String(p.unitPrice ?? 0),
          quantity: "1",
          catalogId: p.id,
        },
      ];
    });
  }

  function updateQty(key: string, delta: number) {
    void haptic.select();
    setRows((prev) =>
      prev
        .map((r) => {
          if (r.key !== key) return r;
          const curr = Math.max(1, Number(r.quantity) || 1);
          const next = curr + delta;
          if (next <= 0) return null;
          return { ...r, quantity: String(next) };
        })
        .filter((r): r is Row => r !== null)
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        title="Add services"
        subtitle={`Job ${jobNumber || jobId} — select billable services`}
      />

      {jobQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.lg }} />
      ) : jobQuery.data?.status !== "InProgress" ? (
        <View style={{ gap: 12, marginTop: space.md }}>
          <InlineBanner
            title="Job not started"
            detail="Services and labor can only be added after starting the job on site (In Progress)."
            tone="warn"
          />
          <Button title="Go back" variant="secondary" onPress={() => router.back()} />
        </View>
      ) : (
        <>
          {/* Service Search Bar */}
          <Text style={{ color: colors.textDim, marginBottom: space.sm, ...type.label }}>
            SELECT SERVICES ({catalog.length} AVAILABLE)
          </Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search service name (e.g. Jet Wash, Leak Test)..."
            placeholderTextColor={colors.textDim}
            autoCorrect={false}
            style={[field, { marginBottom: space.md }]}
          />

          {/* Catalog Services Selection List */}
          {catalogQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginBottom: space.md }} />
          ) : filteredCatalog.length > 0 ? (
            <View style={{ gap: 8, marginBottom: space.lg }}>
              {filteredCatalog.map((p) => {
                const isSelected = rows.some(
                  (r) => r.catalogId === p.id || r.description.trim().toLowerCase() === p.name.trim().toLowerCase()
                );
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggleService(p)}
                    style={{
                      padding: space.md,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? "rgba(34, 197, 94, 0.08)" : colors.surface,
                      minHeight: tapMin,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 8 }}>
                      <Wrench size={18} color={isSelected ? colors.primary : colors.textDim} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                          {p.name}
                        </Text>
                        <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                          {p.sku ? `${p.sku} · ` : ""}
                          {formatMoney(p.unitPrice)}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected ? "#FFFFFF" : colors.primary,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        {isSelected ? "Selected ✓" : "+ Add"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: colors.textMuted, marginBottom: space.lg, ...type.subtitle }}>
              No services match &ldquo;{search}&rdquo;.
            </Text>
          )}

          {/* Selected Services Section */}
          <Text style={{ color: colors.textDim, marginBottom: space.sm, ...type.label }}>
            SERVICES TO ADD ({rows.length})
          </Text>

          {rows.length === 0 ? (
            <View
              style={{
                padding: space.lg,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: "center",
                marginBottom: space.lg,
              }}
            >
              <Text style={{ color: colors.textDim, fontSize: 13 }}>
                Tap &ldquo;+ Add&rdquo; on any service above to include it in this job.
              </Text>
            </View>
          ) : (
            rows.map((row, idx) => (
              <View
                key={row.key}
                style={{
                  marginBottom: space.md,
                  padding: space.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  gap: space.sm,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>Service {idx + 1}</Text>
                  <Pressable
                    onPress={() => {
                      void haptic.select();
                      setRows((prev) => prev.filter((r) => r.key !== row.key));
                    }}
                    style={{ minHeight: tapMin, justifyContent: "center", paddingHorizontal: 4 }}
                  >
                    <Trash2 size={18} color={colors.danger} />
                  </Pressable>
                </View>
                <TextInput
                  value={row.description}
                  onChangeText={(t) => updateRow(row.key, { description: t })}
                  placeholder="Service name"
                  placeholderTextColor={colors.textDim}
                  style={field}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>
                      Price (PKR)
                    </Text>
                    <TextInput
                      value={row.unitRate}
                      onChangeText={(t) => updateRow(row.key, { unitRate: t.replace(/[^\d.]/g, "") })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textDim}
                      style={field}
                    />
                  </View>

                  <View style={{ width: 120 }}>
                    <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>
                      Quantity
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: colors.surfaceElevated,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        height: 48,
                      }}
                    >
                      <Pressable
                        onPress={() => updateQty(row.key, -1)}
                        style={{ width: 36, height: 48, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>-</Text>
                      </Pressable>
                      <Text
                        style={{
                          flex: 1,
                          color: colors.text,
                          fontWeight: "800",
                          fontSize: 15,
                          textAlign: "center",
                        }}
                      >
                        {row.quantity}
                      </Text>
                      <Pressable
                        onPress={() => updateQty(row.key, 1)}
                        style={{ width: 36, height: 48, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {Math.max(1, Number(row.quantity) || 1)} unit(s) ·{" "}
                  {formatMoney(
                    (Math.max(0, Number(row.unitRate) || 0)) * (Math.max(1, Number(row.quantity) || 1))
                  )}
                </Text>
              </View>
            ))
          )}

          <Button
            title="+ Custom Service"
            variant="secondary"
            size="md"
            icon={<Plus size={18} color={colors.text} />}
            onPress={() => {
              void haptic.press();
              setRows((prev) => [...prev, emptyRow()]);
            }}
            style={{ marginBottom: space.lg }}
          />

          <Text style={{ color: colors.textMuted, marginBottom: space.sm, ...type.subtitle }}>
            {rows.filter((r) => r.description.trim()).length} service(s) ready · Total {formatMoney(total)}
          </Text>

          <Button
            title="Save services to job"
            loading={mutation.isPending}
            disabled={!rows.some((r) => r.description.trim())}
            onPress={() => mutation.mutate()}
          />
        </>
      )}
    </ScrollView>
  );
}

const field = {
  backgroundColor: colors.surfaceElevated,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  color: colors.text,
  paddingHorizontal: space.md,
  paddingVertical: 14,
  fontSize: 16,
  minHeight: 48,
} as const;
