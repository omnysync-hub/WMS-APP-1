import React from "react";
import { View, Text } from "react-native";
import { statusChip } from "@/lib/workshop";

export function StatusChip({ status }: { status: string }) {
  const chip = statusChip(status);
  return (
    <View className={`px-2 py-0.5 rounded-full ${chip.wrap}`}>
      <Text className={`text-[10px] font-bold ${chip.text}`}>{status}</Text>
    </View>
  );
}
