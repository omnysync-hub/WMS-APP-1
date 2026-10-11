import { Text, View } from "react-native";
import { colors, radius, space, type } from "@/constants/theme";

type Tone = "success" | "warn" | "error" | "info";

type Props = {
  title: string;
  detail?: string;
  tone?: Tone;
};

const TONE: Record<
  Tone,
  { bg: string; border: string; title: string }
> = {
  success: { bg: "#0C2A22", border: colors.success, title: colors.success },
  warn: { bg: "#3F2E12", border: colors.warning, title: colors.warning },
  error: { bg: "#3F1D24", border: colors.danger, title: colors.danger },
  info: { bg: colors.surfaceElevated, border: colors.border, title: colors.text },
};

/** Plain-English status / error / success strip. */
export function InlineBanner({ title, detail, tone = "info" }: Props) {
  const t = TONE[tone];
  return (
    <View
      style={{
        backgroundColor: t.bg,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space.lg,
        marginBottom: space.lg,
      }}
    >
      <Text style={{ color: t.title, fontWeight: "800", fontSize: 15 }}>{title}</Text>
      {!!detail && (
        <Text style={{ color: colors.textMuted, marginTop: space.xs, ...type.subtitle }}>
          {detail}
        </Text>
      )}
    </View>
  );
}
