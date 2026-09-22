/** Temporary test flag — remove when shipping real auth. */
export const SKIP_LOGIN = process.env.EXPO_PUBLIC_SKIP_LOGIN === "1";

export const DEV_LOGIN_PHONE =
  process.env.EXPO_PUBLIC_DEV_PHONE?.trim() || "+971504567890";

export const DEV_LOGIN_PIN = process.env.EXPO_PUBLIC_DEV_PIN?.trim() || "123456";
