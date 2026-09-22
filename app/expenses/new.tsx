import { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { api } from "@/services/api";
import { colors } from "@/constants/theme";

export default function NewExpenseScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [captured, setCaptured] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.claimJobExpense(jobId!, {
        amount: Number(amount) || 0,
        note: note || "Field expense",
        receiptUrl: captured ? "local://receipt-capture" : undefined,
      }),
    onSuccess: () => {
      Alert.alert("Submitted", "Expense claim queued/sent to ERP.");
      router.back();
    },
    onError: (e: Error) => Alert.alert("Failed", e.message),
  });

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, justifyContent: "center" }}>
        <Text style={{ color: colors.textMuted, marginBottom: 12, textAlign: "center" }}>
          Camera access is needed to scan receipts.
        </Text>
        <Button title="Allow Camera" onPress={() => void requestPermission()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <View style={{ height: 220, borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
        <CameraView style={{ flex: 1 }} facing="back" />
      </View>
      <Button
        title={captured ? "Receipt Captured ✓" : "Capture Receipt"}
        variant={captured ? "secondary" : "primary"}
        onPress={() => setCaptured(true)}
      />

      <Text style={{ color: colors.textDim, marginTop: 16, marginBottom: 6 }}>Amount (PKR)</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="1200"
        placeholderTextColor={colors.textDim}
        style={field}
      />
      <Text style={{ color: colors.textDim, marginTop: 12, marginBottom: 6 }}>Note</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Hardware store brass fitting"
        placeholderTextColor={colors.textDim}
        style={field}
      />
      <Button
        title="Submit Expense"
        loading={mutation.isPending}
        style={{ marginTop: 16 }}
        onPress={() => {
          if (!amount) {
            Alert.alert("Amount required");
            return;
          }
          mutation.mutate();
        }}
      />
    </View>
  );
}

const field = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  color: colors.text,
  padding: 12,
} as const;
