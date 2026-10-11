/**
 * Background location task — must be imported once at app startup (see app/_layout.tsx).
 * Sends telemetry via the same API + offline queue as foreground pings.
 */
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Battery from "expo-battery";
import { api } from "@/services/api";
import {
  KEY_TELEMETRY_EMPLOYEE,
  TELEMETRY_MOVING_SPEED_MS,
  TELEMETRY_TASK_NAME,
} from "@/constants/location";

async function readBattery01(): Promise<number> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    if (level == null || level < 0) return 1;
    return Math.min(1, Math.max(0, level));
  } catch {
    return 1;
  }
}

export async function sendLocationPing(
  employeeId: string,
  loc: Location.LocationObject,
  source = "mobile_gps"
) {
  const speed = loc.coords.speed ?? 0;
  const isMoving = speed > TELEMETRY_MOVING_SPEED_MS;
  await api.sendTelemetry({
    employeeId,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? 0,
    batteryLevel: await readBattery01(),
    isMoving,
    speed,
    source,
    timestamp: new Date(loc.timestamp || Date.now()).toISOString(),
  });
}

TaskManager.defineTask(TELEMETRY_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const employeeId = await SecureStore.getItemAsync(KEY_TELEMETRY_EMPLOYEE);
  if (!employeeId) return;

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)
    ?.locations;
  if (!locations?.length) return;

  const loc = locations[locations.length - 1];
  try {
    await sendLocationPing(employeeId, loc, "mobile_gps_bg");
  } catch {
    // offlineQueue / next update retries
  }

  // Piggyback: while GPS is alive, also check for new job assigns and ring locally
  // (covers many "app closed" cases when FCM/push is not configured yet).
  try {
    const { checkAndAlertNewDispatches } = await import("@/services/jobDispatchWatcher");
    await checkAndAlertNewDispatches(employeeId);
  } catch {
    /* ignore */
  }
});

export async function isTelemetryTaskRegistered(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(TELEMETRY_TASK_NAME);
}
