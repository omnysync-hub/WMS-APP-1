/** Workman Services brand tokens — mirrors ERP emerald/zinc palette */
export const colors = {
  primary: "#0D7A5F",
  primaryMuted: "#0A5F49",
  background: "#09090B",
  surface: "#18181B",
  surfaceElevated: "#27272A",
  border: "#3F3F46",
  text: "#FAFAFA",
  textMuted: "#A1A1AA",
  textDim: "#71717A",
  urgent: "#E11D48",
  high: "#F59E0B",
  success: "#10B981",
  warning: "#FBBF24",
  danger: "#F43F5E",
} as const;

/** Field-friendly spacing (multiples of 4). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Type scale — large enough for outdoor / glove-adjacent use. */
export const type = {
  hero: { fontSize: 28, fontWeight: "900" as const, lineHeight: 34 },
  title: { fontSize: 22, fontWeight: "800" as const, lineHeight: 28 },
  subtitle: { fontSize: 15, fontWeight: "500" as const, lineHeight: 22 },
  body: { fontSize: 16, fontWeight: "500" as const, lineHeight: 24 },
  label: { fontSize: 13, fontWeight: "700" as const, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "600" as const, lineHeight: 16 },
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

/** Minimum comfortable tap target for technicians. */
export const tapMin = 48;

export const GEOFENCE_RADIUS_M = 150;
