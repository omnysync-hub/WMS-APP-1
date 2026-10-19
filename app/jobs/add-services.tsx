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
import { Plus, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { addJobServices, fetchCatalogServices, fetchJob } from "@/services/jobsService";
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
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
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

  const catalog = catalogQuery.data ?? [];
  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog.slice(0, 12);
    return catalog
      .filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q)
      )
      .slice(0, 20);
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
      if (!services.length) throw new Error("Add at least one service name");
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

  function pickCatalog(p: { id: string; name: string; unitPrice?: number }) {
    void haptic.select();
    setRows((prev) => {
      const blank = prev.find((r) => !r.description.trim());
      if (blank) {
        return prev.map((r) =>
          r.key === blank.key
            ? {
                ...r,
                description: p.name,
                unitRate: String(p.unitPrice ?? 0),
                quantity: r.quantity || "1",
                catalogId: p.id,
              }
            : r
        );
      }
      return [
        ...prev,
        {
          ...emptyRow(),
          description: p.name,
          unitRate: String(p.unitPrice ?? 0),
          quantity: "1",
          catalogId: p.id,
        },
      ];
    });
    setSearch("");
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        title="Add services"
        subtitle={`Job ${jobNumber || jobId} — each service is qty 1`}
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
          <Text style={{ color: colors.textDim, marginBottom: space.sm, ...type.label }}>
            Pick from catalog (optional)
          </Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search service name…"
            placeholderTextColor={colors.textDim}
            autoCorrect={false}
            style={[field, { marginBottom: space.sm }]}
          />

      {catalogQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginBottom: space.md }} />
      ) : filteredCatalog.length > 0 ? (
        <View style={{ gap: 8, marginBottom: space.lg }}>
          {filteredCatalog.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => pickCatalog(p)}
              style={{
                padding: space.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                minHeight: tapMin,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>{p.name}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4 }}>
                {p.sku ? `${p.sku} · ` : ""}
                {formatMoney(p.unitPrice)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, marginBottom: space.lg, ...type.subtitle }}>
          No catalog match — type custom services below.
        </Text>
      )}

      <Text style={{ color: colors.textDim, marginBottom: space.sm, ...type.label }}>
        Services to add
      </Text>

      {rows.map((row, idx) => (
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
            {rows.length > 1 ? (
              <Pressable
                onPress={() => {
                  void haptic.select();
                  setRows((prev) => prev.filter((r) => r.key !== row.key));
                }}
                style={{ minHeight: tapMin, justifyContent: "center", paddingHorizontal: 4 }}
              >
                <Trash2 size={18} color={colors.danger} />
              </Pressable>
            ) : null}
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
              <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>Price (PKR)</Text>
              <TextInput
                value={row.unitRate}
                onChangeText={(t) => updateRow(row.key, { unitRate: t.replace(/[^\d.]/g, "") })}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textDim}
                style={field}
              />
            </View>

            <View style={{ width: 80 }}>
              <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>Qty</Text>
              <TextInput
                value={row.quantity}
                onChangeText={(t) => updateRow(row.key, { quantity: t.replace(/[^\d]/g, "") })}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={colors.textDim}
                style={[field, { textAlign: "center" }]}
              />
            </View>
          </View>

          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {Math.max(1, Number(row.quantity) || 1)} unit(s) · {formatMoney((Math.max(0, Number(row.unitRate) || 0)) * (Math.max(1, Number(row.quantity) || 1)))}
          </Text>
        </View>
      ))}

      <Button
        title="Add another service"
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
        {rows.filter((r) => r.description.trim()).length} ready · Total {formatMoney(total)}
      </Text>

      <Button
        title="Save services"
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
