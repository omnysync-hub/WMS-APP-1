import axios from "axios";
import { distanceMeters } from "@/lib/geofence";
import { api } from "@/services/api";
import { getDeviceIdentity } from "@/services/deviceIdentity";
import type {
  AttendanceLog,
  AttendanceSubmitPayload,
  AttendanceSubmitResult,
  GeofenceZone,
} from "@/types";

export async function getStableDeviceId(): Promise<string> {
  return (await getDeviceIdentity()).deviceId;
}

export async function fetchGeofenceZones(employeeId?: string): Promise<GeofenceZone[]> {
  const { data } = await api.getGeofenceZones(true, employeeId);
  return (data?.zones ?? []) as GeofenceZone[];
}

export async function fetchAttendance(employeeId: string): Promise<AttendanceLog[]> {
  const { data } = await api.getAttendanceHistory(employeeId);
  const logs: AttendanceLog[] = Array.isArray(data)
    ? data
    : data?.logs ?? data?.attendance ?? data?.data ?? [];
  return logs;
}

export { distanceMeters } from "@/lib/geofence";

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
