import { View, type ViewProps } from "react-native";
import { colors, radius, space } from "@/constants/theme";

export function Card({ style, ...rest }: ViewProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: space.lg,
        },
        style,
      ]}
      {...rest}
    />
  );
}
