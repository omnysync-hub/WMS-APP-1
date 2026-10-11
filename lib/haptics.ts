import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

async function safe(fn: () => Promise<void>) {
  try {
    if (Platform.OS === "web") return;
    await fn();
  } catch {
    // no haptic hardware / simulator — ignore
  }
}

export const haptic = {
  tap: () =>
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: () =>
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    ),
  error: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    ),
  warn: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    ),
  select: () => safe(() => Haptics.selectionAsync()),
};
