import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { colors, space, type } from "@/constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

/** Screen title + one plain-language “what to do” line. */
export function ScreenHeader({ title, subtitle, right }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: space.lg,
        gap: space.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, ...type.hero }}>{title}</Text>
        {!!subtitle && (
          <Text style={{ color: colors.textMuted, marginTop: space.xs, ...type.subtitle }}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}
