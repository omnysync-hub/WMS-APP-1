/** Store contact for field techs — override via .env */
export const STOREKEEPER = {
  name: process.env.EXPO_PUBLIC_STOREKEEPER_NAME || "Storekeeper",
  phone: (process.env.EXPO_PUBLIC_STOREKEEPER_PHONE || "").replace(/\s/g, ""),
  displayPhone: process.env.EXPO_PUBLIC_STOREKEEPER_PHONE || "",
};

/** Office / accounts contact for discount calls — falls back to storekeeper if unset */
export const OFFICE = {
  name: process.env.EXPO_PUBLIC_OFFICE_NAME || "Office",
  phone: (
    process.env.EXPO_PUBLIC_OFFICE_PHONE ||
    process.env.EXPO_PUBLIC_STOREKEEPER_PHONE ||
    ""
  ).replace(/\s/g, ""),
  displayPhone:
    process.env.EXPO_PUBLIC_OFFICE_PHONE ||
    process.env.EXPO_PUBLIC_STOREKEEPER_PHONE ||
    "",
};
