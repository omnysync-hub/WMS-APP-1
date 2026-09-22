import { Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { colors } from "@/constants/theme";
import type { LeaveBalance } from "@/types";

export function LeaveBalanceCard({
  title,
  balance,
}: {
  title: string;
  balance?: LeaveBalance | null;
}) {
  const remaining = balance?.remaining ?? 0;
  const allocated = balance?.allocated ?? 0;
  return (
    <Card style={{ flex: 1, minWidth: "45%" }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>
        {title}
      </Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
        {remaining}
        <Text style={{ color: colors.textDim, fontSize: 14, fontWeight: "500" }}>
          {" "}
          / {allocated}
        </Text>
      </Text>
      <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 4 }}>
        remaining
      </Text>
    </Card>
  );
}
