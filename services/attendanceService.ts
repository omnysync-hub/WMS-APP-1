import axios from "axios";
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api } from "@/services/api";
import type {
  AttendanceLog,
  AttendanceSubmitPayload,
  AttendanceSubmitResult,
  GeofenceZone,
} from "@/types";

const DEVICE_ID_KEY = "wms_device_id";

export async function getStableDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;

  let hardwareId: string | null = null;
  try {
    if (Platform.OS === "android") {
      hardwareId = Application.getAndroidId() || null;
    } else if (Platform.OS === "ios") {
      hardwareId = (await Application.getIosIdForVendorAsync()) || null;
    }
  } catch {
    hardwareId = null;
  }

  const id =
    hardwareId ||
    `wms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

export async function fetchGeofenceZones(): Promise<GeofenceZone[]> {
  const { data } = await api.getGeofenceZones(true);
  return (data?.zones ?? []) as GeofenceZone[];
}

export async function fetchAttendance(employeeId: string): Promise<AttendanceLog[]> {
  const { data } = await api.getAttendanceHistory(employeeId);
  const logs: AttendanceLog[] = Array.isArray(data)
    ? data
    : data?.logs ?? data?.attendance ?? data?.data ?? [];
  return logs;
}

/** Haversine distance in meters */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type NearestZoneResult = {
  zone: GeofenceZone;
  distanceM: number;
  within: boolean;
};

export function findNearestZone(
  lat: number,
  lng: number,
  zones: GeofenceZone[]
): NearestZoneResult | null {
  if (!zones.length) return null;
  let best: NearestZoneResult | null = null;
  for (const zone of zones) {
    const distanceM = distanceMeters(lat, lng, zone.lat, zone.lng);
    if (!best || distanceM < best.distanceM) {
      best = {
        zone,
        distanceM,
        within: distanceM <= zone.radiusMeters,
      };
    }
  }
  return best;
}

/**
 * Submit punch. On network loss, queues via SQLite (apiRequest offlineQueue)
 * and returns { queued: true }. On HTTP 400, surfaces backend body (status/code/message).
 */
export async function submitAttendancePunch(
  payload: AttendanceSubmitPayload
): Promise<AttendanceSubmitResult> {
  try {
    const data = (await api.punchAttendance(payload)) as AttendanceSubmitResult;
    if (data?.queued) {
      return {
        status: "accepted",
        code: "QUEUED_OFFLINE",
        message: "No connectivity — check-in queued for sync.",
        queued: true,
      };
    }
    return data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as AttendanceSubmitResult;
      if (body?.status === "rejected" || body?.code || body?.message) {
        return {
          status: "rejected",
          code: body.code || "REJECTED",
          message: body.message || "Attendance rejected.",
          flaggedForReview: body.flaggedForReview,
          flagReason: body.flagReason,
        };
      }
    }
    throw err;
  }
}
