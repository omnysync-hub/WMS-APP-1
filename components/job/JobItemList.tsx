import { Text, TextInput, View } from "react-native";
import { colors } from "@/constants/theme";
import type { JobItem } from "@/types";

export function JobItemList({
  items,
  editable,
  onChangeActual,
}: {
  items: JobItem[];
  editable?: boolean;
  onChangeActual?: (id: string, qty: number) => void;
}) {
  if (!items.length) {
    return <Text style={{ color: colors.textDim }}>No planned materials.</Text>;
  }

  return (
    <View style={{ gap: 10 }}>
      {items.map((item) => (
        <View
          key={item.id}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {item.name ?? item.description ?? "Item"}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 12 }}>
            Planned: {item.quantityPlanned ?? 0}
          </Text>
          {editable ? (
            <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.textDim }}>Actual</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={String(item.quantityActual ?? item.quantityPlanned ?? 0)}
                onChangeText={(t) =>
                  onChangeActual?.(item.id, Number(t.replace(/[^0-9.]/g, "")) || 0)
                }
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceElevated,
                  color: colors.text,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              />
            </View>
          ) : (
            <Text style={{ color: colors.textDim, marginTop: 4, fontSize: 12 }}>
              Actual: {item.quantityActual ?? "—"}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
