import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { colors, space, type } from "@/constants/theme";
import { Button } from "@/components/ui/Button";

type Props = {
  title: string;
  message: string;
  icon?: ReactNode;
  actionTitle?: string;
  onAction?: () => void;
};

/** Centered empty / no-data state with optional CTA. */
export function EmptyState({ title, message, icon, actionTitle, onAction }: Props) {
  return (
    <View
      style={{
        marginTop: space.xxl,
        paddingHorizontal: space.xl,
        alignItems: "center",
      }}
    >
      {icon ? <View style={{ marginBottom: space.md }}>{icon}</View> : null}
      <Text style={{ color: colors.text, textAlign: "center", ...type.title }}>{title}</Text>
      <Text
        style={{
          color: colors.textMuted,
          marginTop: space.sm,
          textAlign: "center",
          ...type.subtitle,
        }}
      >
        {message}
      </Text>
      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          size="lg"
          style={{ marginTop: space.xl, alignSelf: "stretch" }}
        />
      ) : null}
    </View>
  );
}
