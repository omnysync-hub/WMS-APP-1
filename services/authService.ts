import { api } from "@/services/api";
import type { Employee } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { DEV_LOGIN_PHONE, DEV_LOGIN_PIN, SKIP_LOGIN } from "@/constants/dev";

export async function loginWithPin(input: {
  phone?: string;
  email?: string;
  employeeId?: string;
  pin: string;
}) {
  const { data } = await api.login(input);
  if (!data?.success || !data.token || !data.employee) {
    throw new Error(data?.error || "Login failed");
  }
  await useAuthStore.getState().setSession(data.token, data.employee as Employee);
  return data.employee as Employee;
}

/** Silent session for SKIP_LOGIN builds — tries ERP, else local stub so UI opens. */
export async function ensureDevSession() {
  if (!SKIP_LOGIN) return;
  const store = useAuthStore.getState();
  if (store.isAuthenticated && store.employee) return;

  const phones = [
    DEV_LOGIN_PHONE,
    "+971 50 456 7890",
    "+971504567890",
    "0504567890",
    "4567890",
  ];

  for (const phone of phones) {
    try {
      await loginWithPin({ phone, pin: DEV_LOGIN_PIN });
      return;
    } catch {
      /* try next */
    }
  }

  // ponytail: offline stub so we can ship UI without a matching Vercel employee
  const stub: Employee = {
    id: "dev-skip-login",
    name: "Dev Technician",
    phone: DEV_LOGIN_PHONE,
    role: "technician",
    designation: "Field Technician",
    status: "active",
  };
  await store.setDevSession(stub);
}

export async function refreshProfile(employeeId: string) {
  const { data } = await api.getProfile(employeeId);
  if (data?.employee) {
    useAuthStore.getState().setEmployee(data.employee as Employee);
  }
  return data;
}
