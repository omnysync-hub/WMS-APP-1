import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";

const DEVICE_ID_KEY = "wms_bikes_device_id";

/**
 * Stable per-install device identity, same pattern as the main Workman app.
 * POST /api/mobile/auth requires a deviceId of 16-128 chars.
 */
export async function getDeviceIdentity() {
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }

  const deviceName =
    [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") ||
    "Workman Bikes device";

  return { deviceId, deviceName };
}
