import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { colors, radius, space, tapMin, type } from "@/constants/theme";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";

type Draft = {
  key: string;
  amount: string;
  note: string;
  category: ExpenseCategory;
};

const CATEGORIES = ["Food", "Fuel", "Parking & Tolls", "Transport", "Materials", "Lodging", "Communication", "Other"] as const;
type ExpenseCategory = (typeof CATEGORIES)[number];

function blankDraft(): Draft {
  return { key: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, amount: "", note: "", category: "Food" };
}

function todayOnDevice() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NewExpenseScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const technicianId = useAuthStore((s) => s.employee?.id);
  const [rows, setRows] = useState<Draft[]>([blankDraft()]);
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!technicianId) throw new Error("Not signed in");

      const entered = rows.filter((r) => r.amount.trim() || r.note.trim());
      if (entered.length === 0) throw new Error("Enter at least one expense");
      if (entered.some((r) => !/^\d+(\.\d{1,2})?$/.test(r.amount.trim()))) {
        throw new Error("Use a valid amount with up to 2 decimal places");
      }

      const valid = entered.map((r) => ({
        amount: Number(r.amount.trim()),
        category: r.category,
        note: r.note.trim() || `${r.category} expense`,
      }));

      if (valid.some((r) => !Number.isFinite(r.amount) || r.amount <= 0)) {
        throw new Error("Every expense amount must be greater than zero");
      }
      if (valid.some((r) => r.amount > 1_000_000)) {
        throw new Error("An expense cannot exceed PKR 1,000,000");
      }
      if (entered.some((r) => r.category === "Other" && r.note.trim().length < 3)) {
        throw new Error("Describe each other expense in at least 3 characters");
      }
      if (valid.some((r) => r.note.length > 200)) {
        throw new Error("Expense notes cannot exceed 200 characters");
      }

      const results = [];
      for (const row of valid) {
        const res = await api.submitTechnicianExpense({
          technicianId,
          amount: row.amount,
          category: row.category,
          note: row.note,
          expenseDate: todayOnDevice(),
        });
        results.push(res);
      }
      return results;
    },
    onSuccess: (results) => {
      void queryClient.invalidateQueries({ queryKey: ["jobs", technicianId] });
      toast(
        results.length === 1
          ? "Expense saved"
          : `${results.length} expenses saved`,
        "success"
      );
      router.back();
    },
    onError: (e: Error) => {
      toast(e.message, "error");
      Alert.alert("Couldn't save", e.message);
    },
  });

  function updateRow(key: string, patch: Partial<Draft>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    void haptic.press();
    setRows((prev) => [...prev, blankDraft()]);
  }

  function removeRow(key: string) {
    void haptic.select();
    setRows((prev) => (prev.length <= 1 ? [blankDraft()] : prev.filter((r) => r.key !== key)));
  }

  const filledCount = rows.filter((r) => r.amount.trim() || r.note.trim()).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        title="Log expenses"
        subtitle="Add one or many. Each cost is divided equally across the jobs you handled that day."
      />

      {rows.map((row, index) => (
        <View
          key={row.key}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: space.lg,
            marginBottom: space.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: space.md,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              Expense {index + 1}
            </Text>
            {rows.length > 1 ? (
              <Pressable
                onPress={() => removeRow(row.key)}
                style={{ minHeight: tapMin, justifyContent: "center", paddingHorizontal: 4 }}
              >
                <Text style={{ color: colors.danger, fontWeight: "700" }}>Remove</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={{ color: colors.textDim, marginBottom: space.xs, ...type.label }}>
            Category
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Expense category, ${row.category}`}
            onPress={() => setOpenCategoryKey((current) => current === row.key ? null : row.key)}
            style={[field, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: openCategoryKey === row.key ? 0 : space.md }]}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>{row.category}</Text>
            <ChevronDown size={19} color={colors.textMuted} />
          </Pressable>
          {openCategoryKey === row.key ? (
            <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: colors.border, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, overflow: "hidden", marginBottom: space.md }}>
              {CATEGORIES.map((category) => (
                <Pressable
                  key={category}
                  onPress={() => {
                    updateRow(row.key, { category });
                    setOpenCategoryKey(null);
                  }}
                  style={{ minHeight: tapMin, paddingHorizontal: space.md, backgroundColor: row.category === category ? colors.primaryMuted : colors.surfaceElevated, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: category === CATEGORIES[0] ? 0 : 1, borderTopColor: colors.border }}
                >
                  <Text style={{ color: colors.text, fontWeight: row.category === category ? "800" : "600" }}>{category}</Text>
                  {row.category === category ? <Check size={18} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={{ color: colors.textDim, marginBottom: space.xs, ...type.label }}>
            Amount (PKR)
          </Text>
          <TextInput
            value={row.amount}
            onChangeText={(t) => updateRow(row.key, { amount: t })}
            keyboardType="decimal-pad"
            placeholder="1200"
            placeholderTextColor={colors.textDim}
            style={field}
          />

          <Text
            style={{
              color: colors.textDim,
              marginTop: space.md,
              marginBottom: space.xs,
              ...type.label,
            }}
          >
            What for?
          </Text>
          <TextInput
            value={row.note}
            onChangeText={(t) => updateRow(row.key, { note: t })}
            maxLength={180}
            placeholder={row.category === "Food" ? "Lunch during site visit" : row.category === "Fuel" ? "Fuel for job travel" : "What was this expense for?"}
            placeholderTextColor={colors.textDim}
            style={field}
          />
        </View>
      ))}

      <Button title="Add another expense" variant="secondary" onPress={addRow} />

      <Button
        title={
          filledCount <= 1
            ? "Save expense"
            : `Save ${filledCount} expenses`
        }
        loading={mutation.isPending}
        style={{ marginTop: space.md }}
        onPress={() => mutation.mutate()}
      />
    </ScrollView>
  );
}

const field = {
  backgroundColor: colors.surfaceElevated,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: radius.md,
  color: colors.text,
  padding: space.md,
  minHeight: 48,
  fontSize: 16,
} as const;
