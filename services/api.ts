import axios, { AxiosRequestConfig } from "axios";
import { Alert, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { enqueueMutation } from "@/services/syncService";
import { isMobileAccessDisabledResponse } from "@/services/loginErrors";
import { describeApiError } from "@/services/apiErrors";

/** Android emulator → host machine. Physical device: set EXPO_PUBLIC_API_URL to LAN IP. */
export const DEFAULT_ERP_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__
    ? Platform.OS === "android"
      ? "http://10.0.2.2:3001"
      : "http://localhost:3001"
    : "https://softwareworkmanservices.com.pk");

/** Mutable for Switch Tenant — also mirrored into SecureStore key `wms_api_url`. */
export let ERP_BASE_URL = DEFAULT_ERP_BASE_URL;

/**
 * Switch Tenant is pinned to KNOWN ERP servers only, so a tampered setting can never send the
 * technician's Bearer token to an arbitrary host. Add new tenants here (requires an app build).
 */
const KNOWN_ERP_ORIGINS = new Set<string>([
  "https://softwareworkmanservices.com.pk",
  "http://169.58.158.49",
  "https://hvac-erp-bay.vercel.app",
  "https://erp.workmanservices.pk",
]);
try {
  const configured = new URL(DEFAULT_ERP_BASE_URL).origin;
  if (configured.startsWith("https://")) KNOWN_ERP_ORIGINS.add(configured);
} catch {
  /* ignore malformed env */
}

export function isKnownErpOrigin(origin: string) {
  return KNOWN_ERP_ORIGINS.has(origin);
}

export function normalizeSafeApiBaseUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.username || parsed.password || (parsed.pathname !== "/" && parsed.pathname !== "") || parsed.search || parsed.hash) return null;
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol === "https:" && KNOWN_ERP_ORIGINS.has(parsed.origin)) return parsed.origin;
    // Dev builds only: local ERP over http on a private/LAN address.
    const privateHost =
      host === "localhost" || host === "127.0.0.1" || host === "10.0.2.2" ||
      /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (__DEV__ && parsed.protocol === "http:" && privateHost) return parsed.origin;
    return null;
  } catch {
    return null;
  }
}

export function setErpBaseUrl(url: string) {
  const safeUrl = normalizeSafeApiBaseUrl(url);
  if (!safeUrl) throw new Error("Unsafe API server address.");
  ERP_BASE_URL = safeUrl;
  apiClient.defaults.baseURL = ERP_BASE_URL;
}

export const apiClient = axios.create({
  baseURL: ERP_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const override = await SecureStore.getItemAsync("wms_api_url");
  if (override && override !== apiClient.defaults.baseURL) {
    const safeOverride = normalizeSafeApiBaseUrl(override);
    if (!safeOverride) {
      await SecureStore.deleteItemAsync("wms_api_url");
    } else {
      setErpBaseUrl(safeOverride);
      config.baseURL = ERP_BASE_URL;
    }
  }
  // Identity/role come ONLY from the signed Bearer token; the server strips any x-actor-* headers.
  const token = await SecureStore.getItemAsync("wms_auth_token");
  if (token) {
    const { isSignedMobileToken } = await import("@/services/authToken");
    if (!isSignedMobileToken(token)) {
      await SecureStore.deleteItemAsync("wms_auth_token");
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let handlingAccessDisabled = false;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (!axios.isAxiosError(error) || !error.response) {
      if (axios.isAxiosError(error)) error.message = describeApiError(error);
      return Promise.reject(error);
    }

    const status = error.response.status;
    const url = String(error.config?.url ?? "");
    const method = String(error.config?.method ?? "").toLowerCase();
    const isLoginPost =
      method === "post" &&
      (url.endsWith("/api/mobile/auth") || /\/api\/mobile\/auth(\?|$)/.test(url));

    if (isLoginPost) {
      return Promise.reject(error);
    }

    if (
      !handlingAccessDisabled &&
      isMobileAccessDisabledResponse(status, error.response.data)
    ) {
      const { useAuthStore } = await import("@/store/authStore");
      if (useAuthStore.getState().isAuthenticated) {
        handlingAccessDisabled = true;
        try {
          const { stopTelemetry } = await import("@/services/telemetryService");
          stopTelemetry();
          await useAuthStore.getState().logout();
          Alert.alert(
            "Access disabled",
            "Your mobile access has been disabled — contact your admin/HR"
          );
        } finally {
          handlingAccessDisabled = false;
        }
      }
    }

    // Screens show `e.message`; make it the server's real reason, not "status code 400".
    error.message = describeApiError(error);
    return Promise.reject(error);
  }
);

/** Queue write mutations when offline; callers pass `offlineQueue: true`. */
export async function apiRequest<T = unknown>(
  config: AxiosRequestConfig & { offlineQueue?: boolean }
): Promise<T> {
  try {
    const res = await apiClient.request<T>(config);
    return res.data;
  } catch (err: unknown) {
    const isNetwork =
      axios.isAxiosError(err) && (!err.response || err.code === "ERR_NETWORK");
    if (config.offlineQueue && isNetwork && config.method && config.url) {
      await enqueueMutation({
        endpoint: config.url,
        method: config.method.toUpperCase(),
        payload: config.data ?? {},
      });
      return { queued: true } as T;
    }
    // Surface the ERP's `{ error }` message (e.g. "at least one proof-of-work photo is required",
    // "Forbidden: role 'x' lacks permission 'jobs.complete'") instead of axios' generic text.
    if (axios.isAxiosError(err) && err.response?.data) {
      const data = err.response.data as { error?: unknown };
      if (typeof data.error === "string" && data.error.trim()) {
        const wrapped = new Error(data.error) as Error & { status?: number; cause?: unknown };
        wrapped.status = err.response.status;
        wrapped.cause = err;
        throw wrapped;
      }
    }
    throw err;
  }
}

export const api = {
  login: (credentials: {
    username?: string;
    phone?: string;
    email?: string;
    employeeId?: string;
    password: string;
    deviceId: string;
    deviceName: string;
  }) => apiClient.post("/api/mobile/auth", credentials),

  logoutMobileSession: () => apiClient.delete("/api/mobile/auth"),

  getProfile: (employeeId: string) =>
    apiClient.get(`/api/mobile/auth?employeeId=${employeeId}`),

  registerPushToken: (data: {
    employeeId: string;
    token: string;
    platform: string;
    deviceModel: string;
    osVersion: string;
    appVersion?: string;
  }) => apiClient.post("/api/mobile/push-token", data),

  getRequests: (technicianId: string, limit = 20) =>
    apiClient.get(`/api/mobile/requests`, { params: { technicianId, limit } }),

  respondRequest: (
    requestId: string,
    data: {
      employeeId: string;
      actionStatus: "accepted" | "rejected" | "acknowledged";
      notes?: string;
      etaMinutes?: number;
    }
  ) => apiClient.post(`/api/mobile/requests/${requestId}/respond`, data),

  sendTelemetry: (data: {
    employeeId: string;
    lat: number;
    lng: number;
    accuracy: number;
    batteryLevel: number;
    isMoving: boolean;
    speed: number;
    source?: string;
    timestamp?: string;
  }) =>
    apiRequest({
      method: "POST",
      url: "/api/mobile/telemetry",
      data,
      offlineQueue: true,
    }),

  getLocationConsent: (employeeId?: string) =>
    apiClient.get("/api/mobile/consent", {
      params: employeeId ? { employeeId } : undefined,
    }),

  acknowledgeLocationConsent: (data: {
    employeeId?: string;
    deviceModel?: string;
    policyVersion?: string;
  }) => apiClient.post("/api/mobile/consent", data),

  getJobs: (technicianId: string, status?: string) =>
    apiClient.get(`/api/jobs`, { params: { technicianId, status } }),

  getJob: (jobId: string) => apiClient.get(`/api/jobs/${jobId}`),

  updateJobStatus: (jobId: string, payload: Record<string, unknown>) =>
    apiRequest({
      method: "PATCH",
      url: `/api/jobs/${jobId}`,
      data: payload,
      offlineQueue: true,
    }),

  batchAcceptJobs: (data: { jobIds: string[]; technicianId: string }) =>
    apiRequest({
      method: "POST",
      url: "/api/jobs",
      data: { action: "batch_accept", ...data },
      offlineQueue: true,
    }),

  claimJobExpense: (
    jobId: string,
    data: {
      technicianId: string;
      amount: number;
      note: string;
      receiptUrl?: string;
    }
  ) =>
    apiRequest({
      method: "POST",
      url: `/api/jobs/${jobId}/expense`,
      data,
      offlineQueue: true,
    }),

  submitTechnicianExpense: (data: {
    technicianId: string;
    amount: number;
    category: string;
    note?: string;
    expenseDate?: string;
    receiptUrl?: string;
  }) =>
    apiRequest<{
      id: string;
      amount: number;
      category: string;
      note: string;
      allocationCount: number;
      queued?: boolean;
    }>({
      method: "POST",
      url: "/api/mobile/expenses",
      data,
      offlineQueue: true,
    }),

  requestJobInventory: (
    jobId: string,
    data: { technicianId: string; item: string; qtyRequested: number }
  ) =>
    apiRequest({
      method: "POST",
      url: `/api/jobs/${jobId}/inventory-request`,
      data,
      offlineQueue: true,
    }),

  returnJobStock: (
    jobId: string,
    data: {
      technicianId: string;
      item: string;
      qtyReturned: number;
      /** Job line the parts came from — ERP resolves the warehouse product via its "(SKU)". */
      jobItemId?: string;
      productId?: string;
    }
  ) =>
    apiRequest({
      method: "POST",
      url: `/api/jobs/${jobId}/stock-return`,
      data,
      offlineQueue: true,
    }),

  getInventoryProducts: () => apiClient.get("/api/inventory"),

  getTechnicianLedger: (technicianId: string) =>
    apiClient.get("/api/accounts", {
      params: { view: "technicians", technicianId },
    }),

  getEssEmployee: (employeeId: string) =>
    apiClient.get(`/api/hrm/employees/${employeeId}`),

  raiseGrievance: (data: {
    employeeId: string;
    category: string;
    description: string;
  }) =>
    apiClient.post("/api/hrm/grievances", {
      action: "raise",
      ...data,
    }),

  getLeaves: (employeeId: string) =>
    apiClient.get(`/api/mobile/leaves?employeeId=${employeeId}`),

  submitLeave: (data: {
    employeeId: string;
    leaveTypeId?: string;
    leaveType?: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) => apiClient.post("/api/mobile/leaves", data),

  getGeofenceZones: (activeOnly = true, employeeId?: string) =>
    apiClient.get(`/api/geofence-zones`, {
      params: {
        activeOnly: activeOnly ? "true" : "false",
        ...(employeeId ? { employeeId } : {}),
      },
    }),

  punchAttendance: (data: {
    employeeId: string;
    geofenceZoneId?: string;
    lat: number;
    lng: number;
    timestamp: string;
    faceMatchScore: number;
    livenessScore?: number;
    deviceId: string;
    notes?: string;
    backupPassword?: string;
    punchType?: "CHECK_IN" | "CHECK_OUT";
  }) =>
    apiRequest({
      method: "POST",
      url: "/api/attendance",
      data,
      // Attendance is proof-of-presence; a stale queued punch must not be
      // replayed later as a new check-in/out.
      offlineQueue: false,
    }),

  getAttendanceHistory: (employeeId: string, limit = 50) =>
    apiClient.get(`/api/attendance`, { params: { employeeId, limit } }),

  enrollFace: (
    employeeId: string,
    data: {
      embedding: number[];
      enrolledAt?: string;
      actorName?: string;
      actorRole?: string;
      actorId?: string;
    }
  ) => apiClient.post(`/api/employees/${employeeId}/enrollment`, data),

  getEnrollmentStatus: (employeeId: string, includeEmbedding = false) =>
    apiClient.get(`/api/employees/${employeeId}/enrollment`, {
      params: includeEmbedding ? { includeEmbedding: "true" } : undefined,
    }),
};
