import { View, type ViewProps } from "react-native";
import { colors } from "@/constants/theme";

export function Card({ style, ...rest }: ViewProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
        },
        style,
      ]}
      {...rest}
    />
  );
}
