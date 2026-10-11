/** Platform-free self-check for the geofence distance calculation. */
import { distanceMeters } from "../lib/geofence";

const d = distanceMeters(25.2048, 55.2708, 25.2048, 55.2708);
if (d > 0.01) throw new Error(`expected ~0m, got ${d}`);

const d2 = distanceMeters(25.2048, 55.2708, 25.2058, 55.2708);
if (d2 < 50 || d2 > 200) throw new Error(`expected ~111m, got ${d2}`);

console.log("attendance geofence math ok", { d, d2: Math.round(d2) });
