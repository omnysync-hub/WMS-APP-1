import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { Employee } from "@/types";
import { isSignedMobileToken } from "@/services/authToken";
import { clearCachedEnrollmentEmbedding } from "@/services/face/embeddingCache";

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
    await SecureStore.setItemAsync("wms_auth_token", token);
    await SecureStore.setItemAsync("wms_employee", JSON.stringify(employee));
    set({ token, employee, isAuthenticated: true });
  },

  setDevSession: async (employee) => {
    await SecureStore.deleteItemAsync("wms_auth_token").catch(() => {});
    await SecureStore.setItemAsync("wms_employee", JSON.stringify(employee));
    set({ token: null, employee, isAuthenticated: true });
  },

  setEmployee: (employee) => {
    SecureStore.setItemAsync("wms_employee", JSON.stringify(employee)).catch(() => {});
    set({ employee });
  },

  hydrate: async () => {
    try {
      const [token, raw] = await Promise.all([
        SecureStore.getItemAsync("wms_auth_token"),
        SecureStore.getItemAsync("wms_employee"),
      ]);

      // Force re-login if persisted token is pre-hardening (unsigned) format
      if (token && !isSignedMobileToken(token)) {
        await SecureStore.deleteItemAsync("wms_auth_token");
        await SecureStore.deleteItemAsync("wms_employee");
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
    await SecureStore.deleteItemAsync("wms_auth_token");
    await SecureStore.deleteItemAsync("wms_employee");
    set({ token: null, employee: null, isAuthenticated: false });
  },

  isTechnician: () => get().employee?.role === "technician",
}));
