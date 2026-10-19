/** Fallback if GET /api/mobile/consent is unreachable — must match ERP LOCATION_SURVEILLANCE_DISCLOSURE_TEXT. */
export const LOCATION_SURVEILLANCE_POLICY_VERSION = "1.0";

export const LOCATION_SURVEILLANCE_DISCLOSURE_TEXT =
  "Workman Services Field Operations collects background GPS location, speed, device movement, and battery telemetry while you are logged in and working on assigned jobs or company shifts. This data is used solely for proximity-based job dispatch, emergency field assistance, arrival verification, customer safety, and route optimization. Location data is retained for 90 days in accordance with company policy.";

/** Background updates while moving (ms). */
export const TELEMETRY_MOVING_INTERVAL_MS = 15_000;
/** Background updates while stationary (ms). */
export const TELEMETRY_STATIONARY_INTERVAL_MS = 45_000;
/** Distance filter (meters) — 0 ensures continuous pings even when stationary or inside. */
export const TELEMETRY_DISTANCE_M = 0;
export const TELEMETRY_MOVING_SPEED_MS = 0.5;

export const TELEMETRY_TASK_NAME = "WORKMAN_LOCATION_TELEMETRY";
export const KEY_TELEMETRY_EMPLOYEE = "wms_telemetry_employee_id";
export const KEY_LOCATION_FLOW_DONE = "wms_location_flow_done";
