import { api } from "@/services/api";
import type { Employee } from "@/types";
import { useAuthStore } from "@/store/authStore";
import {
  DEV_LOGIN_IDENTIFIER,
  DEV_LOGIN_PASSWORD,
  SKIP_LOGIN,
} from "@/constants/dev";
import {
  LoginError,
  parseLoginFailure,
  resolveLoginIdentifier,
} from "@/services/loginErrors";
import { getDeviceIdentity } from "@/services/deviceIdentity";

export type LoginResult = {
  employee: Employee;
};

export async function loginWithPassword(input: {
  identifier: string;
  password: string;
}): Promise<LoginResult> {
  const id = resolveLoginIdentifier(input.identifier);
  if (!id.username && !id.phone && !id.email) {
    throw new LoginError("credentials", "Enter your username, phone, or email.");
  }
  if (!input.password.trim()) {
    throw new LoginError("credentials", "Password is required.");
  }

  try {
    const device = await getDeviceIdentity();
    const res = await api.login({
      ...id,
      password: input.password.trim(),
      ...device,
    });
    const data = res.data;
    if (!data?.success || !data.token || !data.employee) {
      throw new LoginError("unknown", data?.error || "Login failed");
    }
    await useAuthStore.getState().setSession(data.token, data.employee as Employee);
    return { employee: data.employee as Employee };
  } catch (err: any) {
    if (err instanceof LoginError) throw err;
    const serverError = err?.response?.data?.error || err?.message;
    if (serverError && typeof serverError === "string") {
      throw new LoginError("unknown", serverError);
    }
    throw parseLoginFailure(err);
  }
}

export async function logoutMobileSession() {
  try {
    await api.logoutMobileSession();
  } catch {
    // Local sign-out must still work if the phone is offline. The server session
    // remains authoritative and can be released by an administrator if needed.
  }
}

/** Silent session for SKIP_LOGIN builds — tries ERP, else local stub so UI opens. */
export async function ensureDevSession() {
  if (!SKIP_LOGIN) return;
  const store = useAuthStore.getState();
  if (store.isAuthenticated && store.employee) return;

  try {
    await loginWithPassword({
      identifier: DEV_LOGIN_IDENTIFIER,
      password: DEV_LOGIN_PASSWORD,
    });
    return;
  } catch {
    /* fall through to stub */
  }

  // ponytail: offline stub so we can ship UI without a matching Vercel employee
  const stub: Employee = {
    id: "dev-skip-login",
    name: "Dev Technician",
    phone: DEV_LOGIN_IDENTIFIER,
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
