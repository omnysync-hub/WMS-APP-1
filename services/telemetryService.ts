import * as Location from "expo-location";
import { AppState } from "react-native";
import { api } from "@/services/api";

let watchSub: Location.LocationSubscription | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function ping(employeeId: string, loc: Location.LocationObject) {
  try {
    await api.sendTelemetry({
      employeeId,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? 0,
      batteryLevel: 1,
      isMoving: (loc.coords.speed ?? 0) > 0.5,
      speed: loc.coords.speed ?? 0,
    });
  } catch {
    // swallow — next ping retries
  }
}

export async function startTelemetry(employeeId: string) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return;

  await Location.requestBackgroundPermissionsAsync().catch(() => null);

  stopTelemetry();

  watchSub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60_000,
      distanceInterval: 50,
    },
    (loc) => {
      void ping(employeeId, loc);
    }
  );

  intervalId = setInterval(async () => {
    if (AppState.currentState !== "active") return;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await ping(employeeId, loc);
  }, 90_000);
}

export function stopTelemetry() {
  watchSub?.remove();
  watchSub = null;
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
