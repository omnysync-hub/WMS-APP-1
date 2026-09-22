/**
 * ponytail: tiny self-check for haversine — run with:
 * npx ts-node --compiler-options '{"module":"commonjs"}' -e "require('./services/attendanceService')"
 * Prefer: node -e after compile, or just trust unit math below via tsc.
 */
import { distanceMeters } from "../services/attendanceService";

const d = distanceMeters(25.2048, 55.2708, 25.2048, 55.2708);
if (d > 0.01) throw new Error(`expected ~0m, got ${d}`);

const d2 = distanceMeters(25.2048, 55.2708, 25.2058, 55.2708);
if (d2 < 50 || d2 > 200) throw new Error(`expected ~111m, got ${d2}`);

console.log("attendance geofence math ok", { d, d2: Math.round(d2) });
