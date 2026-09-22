import { Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { colors, GEOFENCE_RADIUS_M } from "@/constants/theme";

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
  return (
    <Card>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Geofence</Text>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginTop: 4 }}>
        {label}
      </Text>
      <Text
        style={{
          color: within ? colors.success : colors.high,
          marginTop: 10,
          fontWeight: "600",
        }}
      >
        {distanceM == null
          ? "Locating…"
          : `You are ${Math.round(distanceM)}m from ${label} (${within ? "Within" : "Outside"} ${radiusM}m zone)`}
      </Text>
      <View
        style={{
          marginTop: 12,
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.surfaceElevated,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.max(8, Math.min(100, 100 - ((distanceM ?? radiusM) / (radiusM * 2)) * 100))}%`,
            height: "100%",
            backgroundColor: within ? colors.primary : colors.high,
          }}
        />
      </View>
    </Card>
  );
}
