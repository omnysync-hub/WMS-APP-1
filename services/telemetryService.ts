import * as Location from "expo-location";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  KEY_TELEMETRY_EMPLOYEE,
  TELEMETRY_DISTANCE_M,
  TELEMETRY_MOVING_INTERVAL_MS,
  TELEMETRY_STATIONARY_INTERVAL_MS,
  TELEMETRY_TASK_NAME,
} from "@/constants/location";
import {
  isTelemetryTaskRegistered,
  sendLocationPing,
  setCachedTelemetryEmployee,
} from "@/services/telemetryBackgroundTask";
import { getLocationPermState } from "@/services/locationPermissions";

/**
 * Start background location updates for a technician.
 * Requires foreground + background grants already obtained.
 * Must run while app is in foreground (Android FGS restriction).
 */
export async function startTelemetry(employeeId: string): Promise<boolean> {
  const perms = await getLocationPermState();
  if (!perms.trackingReady) return false;

  setCachedTelemetryEmployee(employeeId);
  await SecureStore.setItemAsync(KEY_TELEMETRY_EMPLOYEE, employeeId);

  const already = await Location.hasStartedLocationUpdatesAsync(TELEMETRY_TASK_NAME).catch(
    () => false
  );
  if (already) {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await sendLocationPing(employeeId, loc, "mobile_gps");
    } catch {
      /* ok */
    }
  }

  if (AppState.currentState !== "active" && !already) {
    // Android blocks starting FGS from background — retry when active
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sub.remove();
        void startTelemetry(employeeId).catch(() => {});
      }
    });
    return false;
  }

  try {
    await Location.startLocationUpdatesAsync(TELEMETRY_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: TELEMETRY_MOVING_INTERVAL_MS,
      distanceInterval: TELEMETRY_DISTANCE_M,
      deferredUpdatesInterval: TELEMETRY_STATIONARY_INTERVAL_MS,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Workman Services Active",
        notificationBody: "Field operations sync active.",
        notificationColor: "#0D7A5F",
        killServiceOnDestroy: false,
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
    });
  } catch (e) {
    console.warn("[telemetry] startLocationUpdatesAsync deferred:", e);
    return false;
  }

  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    await sendLocationPing(employeeId, loc, "mobile_gps");
  } catch {
    /* next background update */
  }

  return true;
}

export async function stopTelemetry() {
  setCachedTelemetryEmployee(null);
  await SecureStore.deleteItemAsync(KEY_TELEMETRY_EMPLOYEE).catch(() => {});
  const running = await Location.hasStartedLocationUpdatesAsync(TELEMETRY_TASK_NAME).catch(
    () => false
  );
  if (running) {
    await Location.stopLocationUpdatesAsync(TELEMETRY_TASK_NAME).catch(() => {});
  }
  // also clear legacy task registration edge cases
  if (await isTelemetryTaskRegistered()) {
    const still = await Location.hasStartedLocationUpdatesAsync(TELEMETRY_TASK_NAME).catch(
      () => false
    );
    if (still) {
      await Location.stopLocationUpdatesAsync(TELEMETRY_TASK_NAME).catch(() => {});
    }
  }
}

/** Resume tracking after app hydrate if technician + permissions still granted. */
export async function resumeTelemetryIfPossible(employeeId: string): Promise<boolean> {
  const perms = await getLocationPermState();
  if (!perms.trackingReady) return false;
  return startTelemetry(employeeId);
}
