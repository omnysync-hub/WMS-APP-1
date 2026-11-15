import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { AUTH_TOKEN_KEY, AuthApi, type ErpEmployee } from "@/services/api";
import { isSignedMobileToken } from "@/services/authToken";

const KEY_EMPLOYEE = "wms_hvac_employee";
const KEY_BENCH_RIG = "wms_hvac_bench_rig";

interface HvacAuthState {
  token: string | null;
  employee: ErpEmployee | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  /** Local workstation label (bench rig this device sits on) — a device preference, not an identity. */
  benchRig: string;
  hydrate: () => Promise<void>;
  login: (identifier: string, pwd: string) => Promise<void>;
  logout: () => Promise<void>;
  setBenchRig: (rig: string) => Promise<void>;
}

/**
 * Real ERP session store. Replaces the old fake local persona
 * ("Khurram Shahzad (Lead HVAC Tech)", id "h1") that never authenticated:
 * sign-in goes through POST /api/mobile/auth exactly like the main Workman
 * app, the signed token is persisted in SecureStore and sent as
 * `Authorization: Bearer …` on every API call (see services/api.ts).
 */
export const useAuthStore = create<HvacAuthState>((set, get) => ({
  token: null,
  employee: null,
  isAuthenticated: false,
  isHydrated: false,
  benchRig: "Bench Rig #1 (HVAC)",

  hydrate: async () => {
    try {
      const [token, rawEmployee, rig] = await Promise.all([
        SecureStore.getItemAsync(AUTH_TOKEN_KEY),
        SecureStore.getItemAsync(KEY_EMPLOYEE),
        SecureStore.getItemAsync(KEY_BENCH_RIG),
      ]);
      if (rig) set({ benchRig: rig });
      if (token && rawEmployee && isSignedMobileToken(token)) {
        set({
          token,
          employee: JSON.parse(rawEmployee) as ErpEmployee,
          isAuthenticated: true,
          isHydrated: true,
        });
        return;
      }
      // Unsigned/expired-shape token or partial state — force a clean sign-in.
      if (token) await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      if (rawEmployee) await SecureStore.deleteItemAsync(KEY_EMPLOYEE);
      set({ token: null, employee: null, isAuthenticated: false, isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },

  login: async (identifier, password) => {
    const { token, employee } = await AuthApi.login(identifier, password);
    if (!isSignedMobileToken(token)) {
      throw new Error("Server returned an unsigned or malformed session token. Update the ERP mobile auth endpoint.");
    }
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    await SecureStore.setItemAsync(KEY_EMPLOYEE, JSON.stringify(employee));
    set({ token, employee, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await AuthApi.logoutMobileSession();
    } catch {
      // Local sign-out must still work offline; the server session can be
      // released by an administrator if needed.
    }
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(KEY_EMPLOYEE).catch(() => {});
    set({ token: null, employee: null, isAuthenticated: false });
  },

  setBenchRig: async (rig) => {
    const value = rig.trim() || "Bench Rig #1 (HVAC)";
    await SecureStore.setItemAsync(KEY_BENCH_RIG, value);
    set({ benchRig: value });
  },
}));

/** Convenience selectors kept for screens that show the signed-in technician. */
export const selectTechName = (s: HvacAuthState) => s.employee?.name || "Technician";
export const selectTechId = (s: HvacAuthState) => s.employee?.id || "";
