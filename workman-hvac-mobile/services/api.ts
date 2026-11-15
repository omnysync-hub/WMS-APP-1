import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { isSignedMobileToken } from "@/services/authToken";

export const DEFAULT_ERP_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__
    ? Platform.OS === "android"
      ? "http://10.0.2.2:3001"
      : "http://localhost:3001"
    : "https://softwareworkmanservices.com.pk");

export let ERP_BASE_URL = DEFAULT_ERP_BASE_URL;

/** Same SecureStore key as the main Workman app, so the session token is shared in shape. */
export const AUTH_TOKEN_KEY = "wms_auth_token";
const API_URL_KEY = "wms_hvac_api_url";
const DEVICE_ID_KEY = "wms_hvac_device_id";

export async function getStoredApiUrl(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(API_URL_KEY);
    if (stored) {
      ERP_BASE_URL = stored;
      return stored;
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_ERP_BASE_URL;
}

export async function setStoredApiUrl(url: string): Promise<void> {
  ERP_BASE_URL = url.trim();
  await SecureStore.setItemAsync(API_URL_KEY, ERP_BASE_URL);
}

/**
 * Stable per-install device identity. The ERP mobile login binds one physical
 * installation per employee and requires a deviceId of 16–128 chars, so the id
 * is generated once and persisted in SecureStore.
 */
export async function getDeviceIdentity(): Promise<{ deviceId: string; deviceName: string }> {
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId || deviceId.length < 16) {
    const bytes = await Crypto.getRandomBytesAsync(24);
    deviceId =
      "hvac-" +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  const deviceName =
    Device.modelName || Device.deviceName || (Platform.OS === "android" ? "Android device" : "iOS device");
  return { deviceId, deviceName };
}

const apiClient = axios.create({
  baseURL: ERP_BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the signed mobile session token (if any). Identity/role come ONLY from
// the Bearer token — the ERP strips client-supplied x-actor-* headers, so the app
// must never send fake actor headers (the previous hardcoded
// "x-actor-name: HVAC Bench Technician" was silently ignored by the server and
// every action was recorded as "Unauthenticated").
apiClient.interceptors.request.use(async (config) => {
  const currentBase = await getStoredApiUrl();
  config.baseURL = currentBase;
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (token) {
    if (!isSignedMobileToken(token)) {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Surface the ERP's `{ error }` message (e.g. "Cannot close Job Card: 2 material
// requisition(s) are pending at Store…") instead of axios' generic
// "Request failed with status code 400", so control blocks are readable in the UI.
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data as { error?: unknown };
      if (typeof data.error === "string" && data.error.trim()) {
        const wrapped = new Error(data.error) as Error & { status?: number };
        wrapped.status = error.response.status;
        return Promise.reject(wrapped);
      }
    }
    if (axios.isAxiosError(error) && !error.response) {
      return Promise.reject(
        new Error("Cannot reach the ERP server. Check the connection / server URL and try again.")
      );
    }
    return Promise.reject(error);
  }
);

export interface ErpEmployee {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role: string;
  department?: string;
  designation?: string;
  employmentType?: string;
  status?: string;
}

export const AuthApi = {
  /**
   * Real ERP mobile login — POST /api/mobile/auth (same route as the main app).
   * `identifier` may be a username, phone number, or email; the server resolves it.
   */
  async login(identifier: string, pwd: string): Promise<{ token: string; employee: ErpEmployee }> {
    const device = await getDeviceIdentity();
    const id = identifier.trim();
    const looksLikeEmail = id.includes("@");
    const looksLikePhone = /^[+\d][\d\s-]{6,}$/.test(id);
    const credentials: Record<string, string> = {
      password: pwd,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
    };
    if (looksLikeEmail) credentials.email = id;
    else if (looksLikePhone) credentials.phone = id;
    else credentials.username = id;

    const res = await apiClient.post("/api/mobile/auth", credentials);
    const data = res.data;
    if (!data?.success || !data.token || !data.employee) {
      throw new Error(data?.error || "Login failed");
    }
    return { token: data.token as string, employee: data.employee as ErpEmployee };
  },

  /** Releases the server-side mobile session (best effort; local sign-out always proceeds). */
  async logoutMobileSession(): Promise<void> {
    await apiClient.delete("/api/mobile/auth");
  },
};

export interface MaterialRequestItem {
  productId?: string;
  itemCode?: string;
  description: string;
  requestedQty: number;
  unit?: string;
  unitCost?: number;
}

export const WorkshopHvacApi = {
  async getJobs(params?: {
    status?: string;
    search?: string;
    assignedStaffId?: string;
    customerId?: string;
  }) {
    const res = await apiClient.get("/api/workshops/jobs", {
      params: { workshopType: "hvac", ...params },
    });
    return res.data;
  },

  async getJob(id: string) {
    const res = await apiClient.get("/api/workshops/jobs", { params: { id } });
    return res.data;
  },

  async createJob(data: any) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "create",
      workshopType: "hvac",
      ...data,
    });
    return res.data;
  },

  async assignStaff(jobCardId: string, staffId: string, staffName: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "assign",
      jobCardId,
      staffId,
      staffName,
    });
    return res.data;
  },

  async saveDiagnosis(
    jobCardId: string,
    data: {
      inspectionFindings: string;
      workRequired: string;
      estimatedHours?: number;
      estimatedCost?: number;
    }
  ) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "diagnose",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  /** SOP Step 4 — Manager approval gate. No work/material may start before this. */
  async approveDiagnosis(jobCardId: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "approve",
      jobCardId,
    });
    return res.data;
  },

  async rejectDiagnosis(jobCardId: string, reason?: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "reject",
      jobCardId,
      reason,
    });
    return res.data;
  },

  async requestGasAndParts(jobCardId: string, items: MaterialRequestItem[]) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "request_material",
      jobCardId,
      items,
    });
    return res.data;
  },

  /** SOP Step 6 — Store Keeper issues stock against a requisition line. */
  async issueMaterial(requisitionId: string, issuedQty: number) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "issue_material",
      requisitionId,
      issuedQty,
    });
    return res.data;
  },

  /** SOP Step 9 — Technician returns unused material against the same requisition line. */
  async returnMaterial(requisitionId: string, returnedQty: number, returnReason: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "return_material",
      requisitionId,
      returnedQty,
      returnReason,
    });
    return res.data;
  },

  async saveBenchTest(
    jobCardId: string,
    data: {
      testingPressurePsi?: number;
      testingLeakTest?: string;
      testingRunTestAmps?: number;
      testingNotes?: string;
    }
  ) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "record_testing",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  async completeJob(jobCardId: string, workDoneSummary: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "complete_job",
      jobCardId,
      workDoneSummary,
    });
    return res.data;
  },

  async recordScrap(
    jobCardId: string,
    data: {
      itemDescription: string;
      quantity?: number;
      unit?: string;
      customerKept?: boolean;
    }
  ) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "record_scrap",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  async closeJob(
    jobCardId: string,
    data?: { closeNotes?: string; deliveryStatus?: string; deliveredTo?: string }
  ) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "close_job",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  // ---- Tools register ----

  async getTools() {
    const res = await apiClient.get("/api/workshops/tools", { params: { workshopType: "hvac" } });
    return res.data;
  },

  async getToolIssues() {
    const res = await apiClient.get("/api/workshops/tools", {
      params: { workshopType: "hvac", view: "issues" },
    });
    return res.data;
  },

  async createTool(data: {
    toolCode: string;
    name: string;
    category: string;
    totalQuantity: number;
    location?: string;
    workshopType?: string;
  }) {
    const res = await apiClient.post("/api/workshops/tools", {
      action: "create",
      workshopType: "hvac",
      ...data,
    });
    return res.data;
  },

  async issueTool(
    toolId: string,
    staffName: string,
    quantity = 1,
    jobCardId?: string,
    opts?: { staffId?: string; notes?: string }
  ) {
    const res = await apiClient.post("/api/workshops/tools", {
      action: "issue",
      toolId,
      staffName,
      staffId: opts?.staffId,
      quantity,
      jobCardId,
      notes: opts?.notes,
    });
    return res.data;
  },

  async returnTool(
    issueId: string,
    returnCondition: "Operational" | "Damaged" | "Under Repair" | "Lost" = "Operational",
    notes?: string
  ) {
    const res = await apiClient.post("/api/workshops/tools", {
      action: "return",
      issueId,
      returnCondition,
      notes,
    });
    return res.data;
  },

  /** Monthly physical count / audit of the tools register. */
  async auditTools(data: {
    auditMonth: string;
    totalToolsCounted: number;
    discrepancyCount: number;
    verifiedBy?: string;
    notes?: string;
  }) {
    const res = await apiClient.post("/api/workshops/tools", {
      action: "audit",
      workshopType: "hvac",
      ...data,
    });
    return res.data;
  },

  async getToolAudits() {
    const res = await apiClient.get("/api/workshops/tools", {
      params: { workshopType: "hvac", view: "audits" },
    });
    return res.data;
  },

  // ---- Scrap register ----

  async getScrap(params?: { status?: string; jobCardId?: string }) {
    const res = await apiClient.get("/api/workshops/scrap", {
      params: { workshopType: "hvac", ...params },
    });
    return res.data;
  },

  /** Hand recorded scrap over to the Store (enters the Scrap Register). */
  async returnScrapToStore(scrapId: string) {
    const res = await apiClient.post("/api/workshops/scrap", {
      action: "return_to_store",
      scrapId,
    });
    return res.data;
  },

  /** Manager-approved disposal or sale (sale amount posts as scrap income in the ERP). */
  async disposeOrSellScrap(
    scrapId: string,
    data: { actionType: "sold" | "disposed"; saleAmount?: number; disposalNotes?: string }
  ) {
    const res = await apiClient.post("/api/workshops/scrap", {
      action: "dispose_or_sell",
      scrapId,
      ...data,
    });
    return res.data;
  },

  // ---- Options & reports ----

  async getOptions() {
    const res = await apiClient.get("/api/workshops/options");
    return res.data;
  },

  async getReport(
    reportType:
      | "hvac_history"
      | "mechanic_productivity"
      | "job_costing"
      | "material_flow"
      | "pending_jobs"
      | "tools_report"
      | "scrap_report",
    params?: { search?: string }
  ) {
    const res = await apiClient.get("/api/workshops/reports", {
      params: { reportType, workshopType: "hvac", ...params },
    });
    return res.data;
  },
};

export { apiClient };
