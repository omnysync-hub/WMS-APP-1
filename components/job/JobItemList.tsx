import { Pressable, Text, TextInput, View } from "react-native";
import { Minus, Plus, Percent, X } from "lucide-react-native";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors, radius, space, tapMin } from "@/constants/theme";
import { formatMoney, parseJobLine, toPkrLabel } from "@/lib/jobLineFormat";
import { haptic } from "@/lib/haptics";
import type { JobItem } from "@/types";

function LineCard({
  item,
  editable,
  onChangeActual,
  onChangeRate,
  onRemove,
  onDiscountPress,
}: {
  item: JobItem;
  editable?: boolean;
  onChangeActual?: (id: string, qty: number) => void;
  onChangeRate?: (id: string, rate: number) => void;
  onRemove?: (id: string) => void;
  onDiscountPress?: (item: JobItem) => void;
}) {
  const line = parseJobLine(item);
  const currentActual = line.qtyActual != null ? Number(line.qtyActual) : 0;
  const isLeftover = !line.isService && line.qtyPlanned > currentActual;

  const handleStep = (delta: number) => {
    void haptic.select();
    const max = line.qtyPlanned > 0 ? line.qtyPlanned : 999;
    const next = Math.min(max, Math.max(0, currentActual + delta));
    onChangeActual?.(item.id, next);
  };

  return (
    <View
      style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: space.md,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15, lineHeight: 20 }}>
            {line.title}
          </Text>
          {line.subtitle ? (
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
              Added by {line.subtitle}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {!line.isService && onDiscountPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Get discount on ${line.title}`}
              onPress={() => {
                void haptic.press();
                onDiscountPress(item);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: "rgba(251, 191, 36, 0.15)",
                borderWidth: 1.5,
                borderColor: "#FBBF24",
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: radius.sm,
              }}
            >
              <Percent size={14} color="#FBBF24" />
              <Text style={{ color: "#FBBF24", fontWeight: "800", fontSize: 13 }}>
                Get discount
              </Text>
            </Pressable>
          ) : null}

          {onRemove && line.isService ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${line.title}`}
              onPress={() => {
                void haptic.tap();
                onRemove(item.id);
              }}
              style={{
                padding: 6,
                borderRadius: radius.sm,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <X size={14} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {line.tags.length > 0 ? (
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
                      : t === "Equipment"
                        ? "InProgress"
                        : "normal"
              }
            />
          ))}
        </View>
      ) : null}

      {/* Pricing and Quantity breakdown */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: radius.sm,
          paddingVertical: 10,
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1.15, alignItems: "center" }}>
          <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>UNIT PRICE</Text>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, marginTop: 2 }}>
            {line.unitRate != null ? formatMoney(line.unitRate) : "—"}
          </Text>
        </View>

        <View style={{ width: 1, height: 26, backgroundColor: colors.border }} />

        <View style={{ flex: 0.8, alignItems: "center" }}>
          <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>
            {line.isService ? "QTY" : "PLANNED"}
          </Text>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, marginTop: 2 }}>
            {line.isService ? (line.qtyActual ?? line.qtyPlanned ?? 1) : line.qtyPlanned}
          </Text>
        </View>

        {!line.isService && (
          <>
            <View style={{ width: 1, height: 26, backgroundColor: colors.border }} />
            <View style={{ flex: 0.8, alignItems: "center" }}>
              <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>USED</Text>
              <Text
                style={{
                  color: currentActual > 0 ? colors.text : colors.textDim,
                  fontWeight: "800",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {currentActual}
              </Text>
            </View>
          </>
        )}

        <View style={{ width: 1, height: 26, backgroundColor: colors.border }} />

        <View style={{ flex: 1.25, alignItems: "center" }}>
          <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>LINE TOTAL</Text>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, marginTop: 2 }}>
            {formatMoney(line.lineTotal)}
          </Text>
        </View>
      </View>

      {/* Service editing: Rate & Quantity */}
      {line.isService && !line.isEquipment && editable && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 4,
            gap: 8,
          }}
        >
          {/* Service Rate Edit */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: "700" }}>Rate:</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={String(line.unitRate ?? 0)}
              onChangeText={(t) => {
                const raw = Number(t.replace(/[^0-9.]/g, "")) || 0;
                onChangeRate?.(item.id, raw);
              }}
              style={{
                width: 76,
                height: 36,
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
          </View>

          {/* Service Quantity controls */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: "700" }}>Qty:</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease service quantity"
              onPress={() => {
                void haptic.select();
                const cur = Number(line.qtyActual ?? line.qtyPlanned ?? 1);
                const next = Math.max(1, cur - 1);
                onChangeActual?.(item.id, next);
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.sm,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Minus size={15} color={colors.text} />
            </Pressable>

            <TextInput
              keyboardType="decimal-pad"
              value={String(line.qtyActual ?? line.qtyPlanned ?? 1)}
              onChangeText={(t) => {
                const raw = Number(t.replace(/[^0-9.]/g, "")) || 0;
                onChangeActual?.(item.id, Math.max(1, raw));
              }}
              style={{
                width: 48,
                height: 34,
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
              accessibilityLabel="Increase service quantity"
              onPress={() => {
                void haptic.select();
                const cur = Number(line.qtyActual ?? line.qtyPlanned ?? 1);
                onChangeActual?.(item.id, cur + 1);
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.sm,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plus size={15} color={colors.text} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Materials Used Quantity controls */}
      {!line.isService && (
        <View style={{ gap: 8, paddingTop: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Used Quantity</Text>
              <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 1 }}>
                {currentActual === 0
                  ? "None used yet (not billed)"
                  : isLeftover
                    ? `${currentActual} used · ${line.qtyPlanned - currentActual} leftover to return`
                    : `All ${currentActual} used`}
              </Text>
            </View>

            {editable ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease used quantity"
                  onPress={() => handleStep(-1)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Minus size={15} color={colors.text} />
                </Pressable>

                <TextInput
                  keyboardType="decimal-pad"
                  value={String(currentActual)}
                  onChangeText={(t) => {
                    const raw = Number(t.replace(/[^0-9.]/g, "")) || 0;
                    const max = line.qtyPlanned > 0 ? line.qtyPlanned : 999;
                    onChangeActual?.(item.id, Math.min(max, raw));
                  }}
                  style={{
                    width: 50,
                    height: 34,
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
                  accessibilityLabel="Increase used quantity"
                  onPress={() => handleStep(1)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={15} color={colors.text} />
                </Pressable>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: colors.surface,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>
                  {currentActual} used
                </Text>
              </View>
            )}
          </View>

          {editable && line.qtyPlanned > 0 && (
            <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set used quantity to 0"
                onPress={() => {
                  void haptic.select();
                  onChangeActual?.(item.id, 0);
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.sm,
                  backgroundColor: currentActual === 0 ? colors.primaryMuted : colors.surface,
                  borderWidth: 1,
                  borderColor: currentActual === 0 ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: currentActual === 0 ? colors.primary : colors.textDim,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  None (0)
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Set used quantity to all ${line.qtyPlanned}`}
                onPress={() => {
                  void haptic.select();
                  onChangeActual?.(item.id, line.qtyPlanned);
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.sm,
                  backgroundColor: currentActual === line.qtyPlanned ? colors.primaryMuted : colors.surface,
                  borderWidth: 1,
                  borderColor: currentActual === line.qtyPlanned ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: currentActual === line.qtyPlanned ? colors.primary : colors.textDim,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  All ({line.qtyPlanned})
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {line.discountApproved ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.surface,
            padding: 8,
            borderRadius: radius.sm,
          }}
        >
          <Text style={{ color: colors.success, fontSize: 12, fontWeight: "700" }}>
            ✓ Discount approved: {toPkrLabel(line.discountApproved)}
          </Text>
        </View>
      ) : line.discountRequested ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.surface,
            padding: 8,
            borderRadius: radius.sm,
          }}
        >
          <Text style={{ color: colors.high, fontSize: 12, fontWeight: "700" }}>
            ⏳ Discount requested: {toPkrLabel(line.discountRequested)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function InventoryList({
  items,
  editable,
  onChangeActual,
  onRemove,
  onDiscountPress,
}: {
  items: JobItem[];
  editable?: boolean;
  onChangeActual?: (id: string, qty: number) => void;
  onRemove?: (id: string) => void;
  onDiscountPress?: (item: JobItem) => void;
}) {
  const materials = items.filter((it) => !parseJobLine(it).isService);
  if (!materials.length) {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: space.lg,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.textDim, fontSize: 13, textAlign: "center" }}>
          No stock or materials assigned to this job yet. Tap “Request inventory” to request parts from warehouse.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      {materials.map((item) => (
        <LineCard
          key={item.id}
          item={item}
          editable={editable}
          onChangeActual={onChangeActual}
          onRemove={onRemove}
          onDiscountPress={onDiscountPress}
        />
      ))}
    </View>
  );
}

export function ServicesList({
  items,
  editable,
  onChangeActual,
  onChangeRate,
  onRemove,
}: {
  items: JobItem[];
  editable?: boolean;
  onChangeActual?: (id: string, qty: number) => void;
  onChangeRate?: (id: string, rate: number) => void;
  onRemove?: (id: string) => void;
}) {
  const services = items.filter((it) => parseJobLine(it).isService);
  if (!services.length) {
    return <Text style={{ color: colors.textDim }}>No services added to this job yet.</Text>;
  }

  return (
    <View style={{ gap: space.sm }}>
      {services.map((item) => (
        <LineCard
          key={item.id}
          item={item}
          editable={editable}
          onChangeActual={onChangeActual}
          onChangeRate={onChangeRate}
          onRemove={onRemove}
        />
      ))}
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
