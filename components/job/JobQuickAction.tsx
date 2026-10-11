import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { colors, radius, tapMin } from "@/constants/theme";
import { haptic } from "@/lib/haptics";

const tones = {
  default: { bg: colors.surfaceElevated, border: colors.border },
  green: { bg: colors.primary, border: colors.primary },
  blue: { bg: "#2563EB", border: "#2563EB" },
  amber: { bg: "#D97706", border: "#D97706" },
  rose: { bg: "#BE123C", border: "#BE123C" },
} as const;

/** Full-width action bar — same shape as "I'm on site — start". */
export function JobQuickAction({
  title,
  subtitle,
  onPress,
  accent,
  icon,
  tone = "default",
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  accent?: boolean;
  icon?: ReactNode;
  tone?: "default" | "green" | "blue" | "amber" | "rose";
  /** @deprecated always full-width */
  fullWidth?: boolean;
}) {
  const t = accent ? tones.green : tones[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={() => {
        void haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: "100%",
        minHeight: 56,
        backgroundColor: t.bg,
        borderWidth: tone === "default" ? 1 : 0,
        borderColor: t.border,
        borderRadius: radius.lg,
        paddingVertical: 16,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      {icon ? (
        <View
          style={{
            width: 28,
            height: 28,
            alignItems: "center",
            justifyContent: "center",
            minHeight: tapMin - 20,
          }}
        >
          {icon}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17, lineHeight: 22 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: "rgba(255,255,255,0.78)",
              marginTop: 2,
              fontSize: 13,
              lineHeight: 18,
              fontWeight: "600",
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function JobQuickActionRow({ children }: { children: ReactNode }) {
  return <View style={{ gap: 10, marginTop: 12 }}>{children}</View>;
}
