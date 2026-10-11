import type { ReactNode } from "react";
import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from "react-native";
import { colors, radius, tapMin } from "@/constants/theme";
import { haptic } from "@/lib/haptics";

type Props = TouchableOpacityProps & {
  title: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  icon?: ReactNode;
  /** Default lg — field technicians need big primary taps. */
  size?: "md" | "lg";
};

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  style,
  icon,
  size = "lg",
  onPress,
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
    variant === "ghost" || variant === "secondary" ? colors.border : "transparent";

  const isLg = size === "lg";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      activeOpacity={0.85}
      onPress={(e) => {
        if (disabled || loading) return;
        void haptic.press();
        onPress?.(e);
      }}
      style={[
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === "ghost" || variant === "secondary" ? 1 : 0,
          paddingVertical: isLg ? 18 : 14,
          paddingHorizontal: 18,
          borderRadius: radius.lg,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 10,
          minHeight: isLg ? 56 : tapMin,
          opacity: disabled || loading ? 0.55 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text
            style={{
              color: colors.text,
              fontWeight: "800",
              fontSize: isLg ? 17 : 15,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
