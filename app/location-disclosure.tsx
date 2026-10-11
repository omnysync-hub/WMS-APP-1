import { Redirect } from "expo-router";

/** Policy screen removed — old links land in the app. */
export default function LocationDisclosureRedirect() {
  return <Redirect href={"/(tabs)/dashboard" as never} />;
}
