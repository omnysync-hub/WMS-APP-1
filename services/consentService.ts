import * as Device from "expo-device";
import { api } from "@/services/api";
import {
  LOCATION_SURVEILLANCE_DISCLOSURE_TEXT,
  LOCATION_SURVEILLANCE_POLICY_VERSION,
} from "@/constants/location";

export type ConsentStatus = {
  hasConsent: boolean;
  policyVersion: string;
  disclosureText: string;
};

export async function fetchLocationConsent(employeeId: string): Promise<ConsentStatus> {
  try {
    const { data } = await api.getLocationConsent(employeeId);
    return {
      hasConsent: !!data?.hasConsent,
      policyVersion: data?.policyVersion || LOCATION_SURVEILLANCE_POLICY_VERSION,
      disclosureText:
        data?.disclosureText || LOCATION_SURVEILLANCE_DISCLOSURE_TEXT,
    };
  } catch {
    return {
      hasConsent: false,
      policyVersion: LOCATION_SURVEILLANCE_POLICY_VERSION,
      disclosureText: LOCATION_SURVEILLANCE_DISCLOSURE_TEXT,
    };
  }
}

export async function acknowledgeLocationConsent(employeeId: string): Promise<void> {
  await api.acknowledgeLocationConsent({
    employeeId,
    deviceModel: Device.modelName || Device.deviceName || "Workman Field Companion",
    policyVersion: LOCATION_SURVEILLANCE_POLICY_VERSION,
  });
}
