import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { Employee } from "@/types";
import { isSignedMobileToken } from "@/services/authToken";
import { clearCachedEnrollmentEmbedding } from "@/services/face/embeddingCache";
import { stopContinuousJobRing } from "@/services/jobAssignmentAlert";
import { getDatabase } from "@/db/database";

const KEY_TOKEN = "wms_auth_token";
const KEY_EMPLOYEE = "wms_employee";

type AuthState = {
  token: string | null;
  employee: Employee | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setSession: (token: string, employee: Employee) => Promise<void>;
  /** SKIP_LOGIN only — no signed token required. */
  setDevSession: (employee: Employee) => Promise<void>;
  setEmployee: (employee: Employee) => void;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
  isTechnician: () => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  employee: null,
  isAuthenticated: false,
  isHydrated: false,

  setSession: async (token, employee) => {
    if (!isSignedMobileToken(token)) {
      throw new Error(
        "Server returned an unsigned or malformed session token. Update the ERP mobile auth endpoint."
      );
    }
    await SecureStore.setItemAsync(KEY_TOKEN, token);
    await SecureStore.setItemAsync(KEY_EMPLOYEE, JSON.stringify(employee));
    // Clear leftover forced-PIN keys from older builds
    await SecureStore.deleteItemAsync("wms_must_reset_pin").catch(() => {});
    await SecureStore.deleteItemAsync("wms_pending_current_pin").catch(() => {});
    set({ token, employee, isAuthenticated: true });
  },

  setDevSession: async (employee) => {
    await SecureStore.deleteItemAsync(KEY_TOKEN).catch(() => {});
    await SecureStore.setItemAsync(KEY_EMPLOYEE, JSON.stringify(employee));
    await SecureStore.deleteItemAsync("wms_must_reset_pin").catch(() => {});
    await SecureStore.deleteItemAsync("wms_pending_current_pin").catch(() => {});
    set({ token: null, employee, isAuthenticated: true });
  },

  setEmployee: (employee) => {
    SecureStore.setItemAsync(KEY_EMPLOYEE, JSON.stringify(employee)).catch(() => {});
    set({ employee });
  },

  hydrate: async () => {
    try {
      const [token, raw] = await Promise.all([
        SecureStore.getItemAsync(KEY_TOKEN),
        SecureStore.getItemAsync(KEY_EMPLOYEE),
      ]);

      if (token && !isSignedMobileToken(token)) {
        await SecureStore.deleteItemAsync(KEY_TOKEN);
        await SecureStore.deleteItemAsync(KEY_EMPLOYEE);
        if (raw) {
          try {
            const emp = JSON.parse(raw) as Employee;
            if (emp?.id) await clearCachedEnrollmentEmbedding(emp.id);
          } catch {
            /* ignore */
          }
        }
        set({ token: null, employee: null, isAuthenticated: false, isHydrated: true });
        return;
      }

      if (token && raw) {
        const employee = JSON.parse(raw) as Employee;
        set({ token, employee, isAuthenticated: true, isHydrated: true });
      } else {
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },

  logout: async () => {
    const empId = get().employee?.id;
    if (empId) {
      await clearCachedEnrollmentEmbedding(empId);
    }
    await SecureStore.deleteItemAsync(KEY_TOKEN);
    await SecureStore.deleteItemAsync(KEY_EMPLOYEE);
    await SecureStore.deleteItemAsync("wms_must_reset_pin").catch(() => {});
    await SecureStore.deleteItemAsync("wms_pending_current_pin").catch(() => {});
    await getDatabase()
      .then((db) => db.execAsync("DELETE FROM pending_mutations; DELETE FROM local_jobs;"))
      .catch(() => {});
    void stopContinuousJobRing();
    set({ token: null, employee: null, isAuthenticated: false });
  },

  isTechnician: () => get().employee?.role === "technician",
}));
