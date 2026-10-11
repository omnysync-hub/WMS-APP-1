import { Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { colors, GEOFENCE_RADIUS_M, space, type } from "@/constants/theme";

export function GeofenceMapCard({
  label,
  distanceM,
  radiusM = GEOFENCE_RADIUS_M,
}: {
  label: string;
  distanceM: number | null;
  radiusM?: number;
}) {
  const within = distanceM != null && distanceM <= radiusM;
  const statusLabel =
    distanceM == null ? "Finding your location…" : within ? "At site" : "Away from site";
  const statusColor =
    distanceM == null ? colors.textMuted : within ? colors.success : colors.high;

  return (
    <Card>
      <Text style={{ color: colors.textDim, ...type.caption }}>Your site</Text>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18, marginTop: space.xs }}>
        {label}
      </Text>
      <Text
        style={{
          color: statusColor,
          marginTop: space.md,
          fontWeight: "800",
          fontSize: 17,
        }}
      >
        {statusLabel}
      </Text>
      <Text style={{ color: colors.textMuted, marginTop: space.xs, ...type.subtitle }}>
        {distanceM == null
          ? "Turn on GPS if this stays blank."
          : within
            ? `${Math.round(distanceM)}m from the check-in zone — you’re good.`
            : `${Math.round(distanceM)}m from ${label} (need to be within ${radiusM}m).`}
      </Text>
      <View
        style={{
          marginTop: space.md,
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.surfaceElevated,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.max(
              8,
              Math.min(100, 100 - ((distanceM ?? radiusM) / (radiusM * 2)) * 100)
            )}%`,
            height: "100%",
            backgroundColor: within ? colors.primary : colors.high,
          }}
        />
      </View>
    </Card>
  );
}
