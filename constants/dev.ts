/** Temporary test flag — remove when shipping real auth. */
export const SKIP_LOGIN = process.env.EXPO_PUBLIC_SKIP_LOGIN === "1";

/** Admin-set username, or phone / email (see resolveLoginIdentifier). */
export const DEV_LOGIN_IDENTIFIER =
  process.env.EXPO_PUBLIC_DEV_LOGIN?.trim() ||
  process.env.EXPO_PUBLIC_DEV_PHONE?.trim() ||
  "+971504567890";

export const DEV_LOGIN_PASSWORD =
  process.env.EXPO_PUBLIC_DEV_PASSWORD?.trim() ||
  process.env.EXPO_PUBLIC_DEV_PIN?.trim() ||
  "123456";
