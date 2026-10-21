/**
 * nativeAlarm.ts
 *
 * Thin TypeScript wrapper around the native Android AlarmModule.
 * The native service plays job_ring.wav on ALARM stream at MAXIMUM volume,
 * bypassing silent mode, vibrate mode, Do Not Disturb, and survives app kill
 * and phone lock. Falls back silently on iOS (where expo-audio handles it).
 */
import { NativeModules, Platform } from "react-native";

const { AlarmModule } = NativeModules as {
  AlarmModule?: { startAlarm(): void; stopAlarm(): void };
};

/** Start the native alarm ringtone at max volume via the Android ALARM stream. */
export function startNativeAlarm(): void {
  if (Platform.OS === "android" && AlarmModule) {
    try {
      AlarmModule.startAlarm();
    } catch (err) {
      console.warn("[nativeAlarm] startAlarm error:", err);
    }
  }
}

/** Stop the native alarm ringtone and release all audio/vibration resources. */
export function stopNativeAlarm(): void {
  if (Platform.OS === "android" && AlarmModule) {
    try {
      AlarmModule.stopAlarm();
    } catch (err) {
      console.warn("[nativeAlarm] stopAlarm error:", err);
    }
  }
}
