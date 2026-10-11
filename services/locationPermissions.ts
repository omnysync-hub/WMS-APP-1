import { Linking, Platform } from "react-native";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { KEY_LOCATION_FLOW_DONE } from "@/constants/location";

export type LocationPermState = {
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
  canAskAgain: boolean;
  trackingReady: boolean;
};

export async function getLocationPermState(): Promise<LocationPermState> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  const trackingReady =
    fg.status === Location.PermissionStatus.GRANTED &&
    bg.status === Location.PermissionStatus.GRANTED;
  return {
    foreground: fg.status,
    background: bg.status,
    canAskAgain: fg.canAskAgain !== false && bg.canAskAgain !== false,
    trackingReady,
  };
}

export async function wasLocationFlowCompleted(employeeId: string): Promise<boolean> {
  const v = await SecureStore.getItemAsync(`${KEY_LOCATION_FLOW_DONE}_${employeeId}`);
  return v === "1";
}

export async function markLocationFlowCompleted(employeeId: string): Promise<void> {
  await SecureStore.setItemAsync(`${KEY_LOCATION_FLOW_DONE}_${employeeId}`, "1");
}

/**
 * Request foreground then background via raw OS dialogs (no in-app policy UI).
 */
export async function requestTechnicianLocationPermissions(): Promise<LocationPermState> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    return getLocationPermState();
  }

  // Android 10+: must request background as a separate step after foreground
  if (Platform.OS === "android") {
    await new Promise((r) => setTimeout(r, 350));
  }

  await Location.requestBackgroundPermissionsAsync();
  return getLocationPermState();
}

export function openAppLocationSettings() {
  void Linking.openSettings();
}
