import { Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { colors } from "@/constants/theme";

type Holiday = { id: string; name: string; date: string };

export function LeaveCalendar({ holidays }: { holidays: Holiday[] }) {
  const upcoming = [...holidays]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  if (!upcoming.length) {
    return (
      <Card>
        <Text style={{ color: colors.textDim }}>No upcoming holidays listed.</Text>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 10 }}>
        Company Holidays
      </Text>
      {upcoming.map((h) => (
        <View
          key={h.id}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.surfaceElevated,
          }}
        >
          <Text style={{ color: colors.textMuted, flex: 1 }}>{h.name}</Text>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>
            {h.date.slice(0, 10)}
          </Text>
        </View>
      ))}
    </Card>
  );
}
