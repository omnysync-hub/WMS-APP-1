import { Text, TextInput, View } from "react-native";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors, radius, space } from "@/constants/theme";
import { formatMoney, parseJobLine, toPkrLabel } from "@/lib/jobLineFormat";
import type { JobItem } from "@/types";

function LineCard({
  item,
  editable,
  onChangeActual,
}: {
  item: JobItem;
  editable?: boolean;
  onChangeActual?: (id: string, qty: number) => void;
}) {
  const line = parseJobLine(item);
  return (
    <View
      style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: space.md,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "800", flex: 1, fontSize: 15 }}>
          {line.title}
        </Text>
        {line.unitRate != null ? (
          <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>
            {formatMoney(line.unitRate)}
          </Text>
        ) : null}
      </View>

      {line.subtitle ? (
        <Text style={{ color: colors.textDim, fontSize: 12 }}>Added by {line.subtitle}</Text>
      ) : null}

      {!line.isService && line.tags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {line.tags.map((t) => (
            <StatusBadge
              key={t}
              label={t}
              tone={
                t.includes("approved")
                  ? "Approved"
                  : t.includes("pending")
                    ? "Pending"
                    : t === "Issued"
                      ? "Approved"
                      : "normal"
              }
            />
          ))}
        </View>
      ) : null}

      {line.isService ? null : (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Planned{" "}
              <Text style={{ color: colors.text, fontWeight: "700" }}>{line.qtyPlanned}</Text>
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>
              Line {formatMoney(line.lineTotal)}
            </Text>
          </View>

          {editable ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.textDim }}>Used qty</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={String(line.qtyActual ?? line.qtyPlanned ?? 0)}
                onChangeText={(t) =>
                  onChangeActual?.(item.id, Number(t.replace(/[^0-9.]/g, "")) || 0)
                }
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  minHeight: 44,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            </View>
          ) : (
            <Text style={{ color: colors.textDim, fontSize: 12 }}>
              Used qty: {line.qtyActual ?? "—"}
            </Text>
          )}
        </>
      )}

      {line.discountApproved ? (
        <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>
          Discount: {toPkrLabel(line.discountApproved)}
        </Text>
      ) : line.discountRequested ? (
        <Text style={{ color: colors.high, fontSize: 12, fontWeight: "600" }}>
          Discount pending: {toPkrLabel(line.discountRequested)}
        </Text>
      ) : null}
    </View>
  );
}

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
    return <Text style={{ color: colors.textDim }}>No inventory or services on this job yet.</Text>;
  }

  const parsed = items.map((it) => ({ item: it, line: parseJobLine(it) }));
  const services = parsed.filter((p) => p.line.isService);
  const materials = parsed.filter((p) => !p.line.isService);

  return (
    <View style={{ gap: space.md }}>
      {materials.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }}>
            MATERIALS / PARTS ({materials.length})
          </Text>
          {materials.map(({ item }) => (
            <LineCard
              key={item.id}
              item={item}
              editable={editable}
              onChangeActual={onChangeActual}
            />
          ))}
        </View>
      ) : null}

      {services.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }}>
            SERVICES ({services.length})
          </Text>
          {services.map(({ item }) => (
            <LineCard
              key={item.id}
              item={item}
              editable={editable}
              onChangeActual={onChangeActual}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
