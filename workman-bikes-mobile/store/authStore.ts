import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { AuthApi, TOKEN_KEY, EMPLOYEE_KEY, setSessionExpiredHandler } from "@/services/api";
import {
  workshopRoleFor,
  type ErpEmployee,
  type WorkshopRole,
} from "@/lib/workshop";

const PREFS_KEY = "wms_bikes_prefs";

interface AuthState {
  token: string | null;
  employee: ErpEmployee | null;
  workshopRole: WorkshopRole;
  isAuthenticated: boolean;
  isHydrated: boolean;
  /** Local workstation preferences (not identity). */
  bayNumber: string;
  shiftStatus: "active" | "break" | "off_duty";
  hydrate: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<ErpEmployee>;
  logout: () => Promise<void>;
  clearSession: () => void;
  setBayNumber: (bay: string) => void;
  setShiftStatus: (status: "active" | "break" | "off_duty") => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  employee: null,
  workshopRole: "mechanic",
  isAuthenticated: false,
  isHydrated: false,
  bayNumber: "Bay 2 (Bikes)",
  shiftStatus: "active",

  hydrate: async () => {
    try {
      const [token, rawEmployee, rawPrefs] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(EMPLOYEE_KEY),
        SecureStore.getItemAsync(PREFS_KEY),
      ]);
      const prefs = rawPrefs ? JSON.parse(rawPrefs) : {};
      if (token && rawEmployee) {
        const employee = JSON.parse(rawEmployee) as ErpEmployee;
        set({
          token,
          employee,
          workshopRole: workshopRoleFor(employee),
          isAuthenticated: true,
          isHydrated: true,
          bayNumber: prefs.bayNumber || "Bay 2 (Bikes)",
          shiftStatus: prefs.shiftStatus || "active",
        });
        return;
      }
      set({
        isHydrated: true,
        bayNumber: prefs.bayNumber || "Bay 2 (Bikes)",
        shiftStatus: prefs.shiftStatus || "active",
      });
    } catch (e) {
      set({ isHydrated: true });
    }
  },

  login: async (identifier, password) => {
    const data = await AuthApi.login(identifier, password);
    if (!data?.success || !data.token || !data.employee) {
      throw new Error(data?.error || "Login failed. Please check your credentials.");
    }
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    await SecureStore.setItemAsync(EMPLOYEE_KEY, JSON.stringify(data.employee));
    set({
      token: data.token,
      employee: data.employee,
      workshopRole: workshopRoleFor(data.employee),
      isAuthenticated: true,
    });
    return data.employee;
  },

  logout: async () => {
    await AuthApi.logout();
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(EMPLOYEE_KEY);
    } catch (e) {
      // ignore
    }
    set({ token: null, employee: null, workshopRole: "mechanic", isAuthenticated: false });
  },

  clearSession: () => {
    set({ token: null, employee: null, workshopRole: "mechanic", isAuthenticated: false });
  },

  setBayNumber: (bayNumber) => {
    set({ bayNumber });
    persistPrefs({ bayNumber, shiftStatus: get().shiftStatus });
  },

  setShiftStatus: (shiftStatus) => {
    set({ shiftStatus });
    persistPrefs({ bayNumber: get().bayNumber, shiftStatus });
  },
}));

function persistPrefs(prefs: { bayNumber: string; shiftStatus: string }) {
  SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
}

// When the API layer sees a 401 it clears SecureStore itself; mirror that in
// the in-memory store so the root layout sends the user back to /login.
setSessionExpiredHandler(() => {
  useAuthStore.getState().clearSession();
});
