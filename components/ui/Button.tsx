import { Text, TouchableOpacity, ActivityIndicator, type TouchableOpacityProps } from "react-native";
import { colors } from "@/constants/theme";

type Props = TouchableOpacityProps & {
  title: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
};

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  style,
  ...rest
}: Props) {
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? colors.danger
        : variant === "secondary"
          ? colors.surfaceElevated
          : "transparent";

  const border =
    variant === "ghost" || variant === "secondary"
      ? colors.border
      : "transparent";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled || loading}
      style={[
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === "ghost" || variant === "secondary" ? 1 : 0,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: 12,
          alignItems: "center",
          opacity: disabled || loading ? 0.55 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
