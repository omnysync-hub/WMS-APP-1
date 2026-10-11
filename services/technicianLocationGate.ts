import type { Href } from "expo-router";
import { Platform } from "react-native";
import { Camera } from "expo-camera";
import { acknowledgeLocationConsent } from "@/services/consentService";
import {
  getLocationPermState,
  markLocationFlowCompleted,
  requestTechnicianLocationPermissions,
} from "@/services/locationPermissions";
import { resumeTelemetryIfPossible, startTelemetry } from "@/services/telemetryService";
import { registerForPushNotifications } from "@/services/pushNotificationService";

/** @deprecated Policy screen removed — kept so old links don't crash. */
export const LOCATION_DISCLOSURE_HREF = "/(tabs)/dashboard" as Href;

/**
 * Raw OS permission prompts only (no in-app policy screen).
 * Location → notifications → camera, then start tracking if location granted.
 */
export async function requestEssentialTechnicianPermissions(
  employeeId: string
): Promise<void> {
  // Silent ERP consent record so backend stays happy — no UI text shown.
  try {
    await acknowledgeLocationConsent(employeeId);
  } catch {
    /* offline / ERP optional */
  }

  const perms = await requestTechnicianLocationPermissions();

  if (Platform.OS === "android") {
    await new Promise((r) => setTimeout(r, 250));
  }
  try {
    await registerForPushNotifications(employeeId);
  } catch {
    /* ignore */
  }

  if (Platform.OS === "android") {
    await new Promise((r) => setTimeout(r, 250));
  }
  try {
    await Camera.requestCameraPermissionsAsync();
  } catch {
    /* ignore */
  }

  await markLocationFlowCompleted(employeeId);
  if (perms.trackingReady) {
    await startTelemetry(employeeId);
  }
}

/** After login — OS dialogs only, never routes to a disclosure screen. */
export async function prepareTechnicianLocation(
  employeeId: string
): Promise<{ needsDisclosure: boolean }> {
  const perms = await getLocationPermState();
  if (!perms.trackingReady) {
    await requestEssentialTechnicianPermissions(employeeId);
  } else {
    try {
      await acknowledgeLocationConsent(employeeId);
    } catch {
      /* ignore */
    }
    await markLocationFlowCompleted(employeeId);
    await startTelemetry(employeeId);
    try {
      await registerForPushNotifications(employeeId);
    } catch {
      /* ignore */
    }
  }
  return { needsDisclosure: false };
}

/** App launch / hydrate — request missing perms via OS dialogs, never show policy UI. */
export async function resumeTechnicianLocationOnLaunch(employeeId: string) {
  const perms = await getLocationPermState();
  if (!perms.trackingReady) {
    await requestEssentialTechnicianPermissions(employeeId);
  } else {
    await resumeTelemetryIfPossible(employeeId);
  }
  return { needsDisclosure: false as const };
}
