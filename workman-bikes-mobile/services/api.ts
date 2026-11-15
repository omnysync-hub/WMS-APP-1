import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { getDeviceIdentity } from "@/services/deviceIdentity";
import { workshopRoleFor, type ErpEmployee } from "@/lib/workshop";

export const DEFAULT_ERP_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__
    ? Platform.OS === "android"
      ? "http://10.0.2.2:3001"
      : "http://localhost:3001"
    : "https://softwareworkmanservices.com.pk");

export let ERP_BASE_URL = DEFAULT_ERP_BASE_URL;

export const TOKEN_KEY = "wms_bikes_auth_token";
export const EMPLOYEE_KEY = "wms_bikes_employee";

export async function getStoredApiUrl(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync("wms_bikes_api_url");
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
  await SecureStore.setItemAsync("wms_bikes_api_url", ERP_BASE_URL);
}

/** Extract the ERP server's own error message from an axios failure. */
export function apiErrorMessage(e: any, fallback = "Something went wrong. Please try again."): string {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    (e?.code === "ECONNABORTED" ? "Request timed out. Check the connection and retry." : null) ||
    (e?.message === "Network Error" ? "Cannot reach the ERP server. Check the server URL and connection." : null) ||
    e?.message ||
    fallback
  );
}

let sessionExpiredHandler: (() => void) | null = null;
/** authStore registers here so a 401 can clear the local session without an import cycle. */
export function setSessionExpiredHandler(fn: (() => void) | null) {
  sessionExpiredHandler = fn;
}

const apiClient = axios.create({
  baseURL: ERP_BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  config.baseURL = await getStoredApiUrl();
  try {
    const [token, rawEmployee] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(EMPLOYEE_KEY),
    ]);
    if (token) {
      // Verified mobile session: the ERP resolves the actor (id, DB role, name)
      // from this token and it overrides any actor headers.
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (rawEmployee) {
      const emp = JSON.parse(rawEmployee) as ErpEmployee;
      // Fallback identity for the workshops middleware when no Bearer token is
      // present; ignored by the server whenever the token above is sent.
      config.headers["x-actor-role"] = workshopRoleFor(emp);
      if (emp.name && /^[\x20-\x7E]+$/.test(emp.name)) {
        config.headers["x-actor-name"] = emp.name;
      }
      config.headers["x-actor-id"] = emp.id;
    }
  } catch (e) {
    // ignore - request proceeds unauthenticated and the server will respond
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error?.response?.status === 401) {
      // Session invalid / expired / deactivated on the ERP: drop local copies
      // so the app returns to the login screen instead of failing silently.
      try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(EMPLOYEE_KEY);
      } catch (e) {
        // ignore
      }
      sessionExpiredHandler?.();
    }
    return Promise.reject(error);
  }
);

/**
 * Real ERP authentication, identical to the main Workman app:
 * POST /api/mobile/auth { username | phone | email, password, deviceId, deviceName }
 * -> { success, token, employee }
 */
export const AuthApi = {
  async login(identifier: string, password: string) {
    const id = identifier.trim();
    const device = await getDeviceIdentity();
    const creds: Record<string, string> = { password, ...device };
    if (id.includes("@")) creds.email = id;
    else if (/^[+\d][\d\s-]{6,}$/.test(id)) creds.phone = id;
    else creds.username = id;

    const base = await getStoredApiUrl();
    const res = await axios.post(`${base}/api/mobile/auth`, creds, {
      timeout: 20000,
      headers: { "Content-Type": "application/json" },
    });
    return res.data as { success: boolean; token: string; employee: ErpEmployee; error?: string };
  },

  async logout() {
    try {
      await apiClient.delete("/api/mobile/auth");
    } catch (e) {
      // Local sign-out must still work offline; the server session stays
      // authoritative and can be released by an administrator if needed.
    }
  },
};

export const WorkshopBikesApi = {
  // ------------------------------------------------------------------ Jobs
  async getJobs(params?: {
    status?: string;
    search?: string;
    assignedStaffId?: string;
    customerId?: string;
  }) {
    const res = await apiClient.get("/api/workshops/jobs", {
      params: { workshopType: "bike", ...params },
    });
    return res.data;
  },

  async getJob(id: string) {
    const res = await apiClient.get("/api/workshops/jobs", { params: { id } });
    return res.data;
  },

  /** SOP Step 1 - Create job card (Supervisor). */
  async createJob(data: any) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "create",
      workshopType: "bike",
      ...data,
    });
    return res.data;
  },

  /** SOP Step 2 - Assign mechanic (Supervisor). */
  async assignStaff(jobCardId: string, staffId: string, staffName: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "assign",
      jobCardId,
      staffId,
      staffName,
    });
    return res.data;
  },

  /** SOP Step 3 - Inspection & diagnosis (Mechanic). Moves job to Pending Approval. */
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

  /** SOP Step 4 - Manager approval of the diagnosis. */
  async approveDiagnosis(jobCardId: string, reason?: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "approve_diagnosis",
      jobCardId,
      reason,
    });
    return res.data;
  },

  /** SOP Step 4 - Manager rejection (unit is returned / job closed off). */
  async rejectDiagnosis(jobCardId: string, reason?: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "reject_diagnosis",
      jobCardId,
      reason,
    });
    return res.data;
  },

  /** SOP Step 5 - Store requisition against the job card (Mechanic). */
  async requestParts(
    jobCardId: string,
    items: Array<{
      productId?: string;
      itemCode?: string;
      description: string;
      requestedQty: number;
      unit?: string;
      unitCost?: number;
    }>
  ) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "request_material",
      jobCardId,
      items,
    });
    return res.data;
  },

  /** SOP Step 6 - Store Keeper issues material; ERP stock is reduced. */
  async issueMaterial(requisitionId: string, issuedQty: number) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "issue_material",
      requisitionId,
      issuedQty,
    });
    return res.data;
  },

  /** SOP Step 9 - Return unused material to store against the same job card. */
  async returnMaterial(requisitionId: string, returnedQty: number, returnReason: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "return_material",
      requisitionId,
      returnedQty,
      returnReason,
    });
    return res.data;
  },

  /** SOP Step 7 - Testing / road test record. */
  async saveTestRun(
    jobCardId: string,
    data: { testingLeakTest: string; testingNotes?: string; testingRunTestAmps?: number; testingPressurePsi?: number }
  ) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "record_testing",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  /** SOP Step 8 - Mechanic marks the job Completed with a work-done summary. */
  async completeJob(jobCardId: string, workDoneSummary: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "complete_job",
      jobCardId,
      workDoneSummary,
    });
    return res.data;
  },

  /** Record replaced parts / used oil as scrap against the job card. */
  async recordScrap(
    jobCardId: string,
    data: { itemDescription: string; quantity?: number; unit?: string; customerKept?: boolean }
  ) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "record_scrap",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  /** SOP Step 10 - Final check & close (Manager). Server blocks closure when
   *  tools are still issued or requisitions are still pending at Store. */
  async closeJob(jobCardId: string, data?: { closeNotes?: string; deliveryStatus?: string; deliveredTo?: string }) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "close_job",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  // ----------------------------------------------------------------- Tools
  async getTools() {
    const res = await apiClient.get("/api/workshops/tools", { params: { workshopType: "bike" } });
    return res.data;
  },

  async getToolAudits() {
    const res = await apiClient.get("/api/workshops/tools", {
      params: { workshopType: "bike", view: "audits" },
    });
    return res.data;
  },

  /** Register a new tool (Tool Code, name, category, quantity, location). */
  async createTool(data: {
    toolCode: string;
    name: string;
    category: string;
    totalQuantity: number;
    location?: string;
  }) {
    const res = await apiClient.post("/api/workshops/tools", {
      action: "create",
      workshopType: "bike",
      ...data,
    });
    return res.data;
  },

  async issueTool(toolId: string, staffName: string, quantity = 1, jobCardId?: string, staffId?: string) {
    const res = await apiClient.post("/api/workshops/tools", {
      action: "issue",
      toolId,
      staffId,
      staffName,
      quantity,
      jobCardId,
    });
    return res.data;
  },

  /** Return a tool with the mandatory condition check. */
  async returnTool(issueId: string, returnCondition = "Operational", notes?: string) {
    const res = await apiClient.post("/api/workshops/tools", {
      action: "return",
      issueId,
      returnCondition,
      notes,
    });
    return res.data;
  },

  /** Monthly tool count / audit record. */
  async auditTools(data: {
    auditMonth: string;
    totalToolsCounted: number;
    discrepancyCount: number;
    verifiedBy?: string;
    notes?: string;
  }) {
    const res = await apiClient.post("/api/workshops/tools", {
      action: "audit",
      workshopType: "bike",
      ...data,
    });
    return res.data;
  },

  // ----------------------------------------------------------------- Scrap
  async getScrap() {
    const res = await apiClient.get("/api/workshops/scrap", { params: { workshopType: "bike" } });
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

  /** Manager-approved scrap disposal or sale (sale posts scrap income). */
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

  // --------------------------------------------------------------- Options
  /** Dropdown data: { staff, products, customers } from the ERP. */
  async getOptions() {
    const res = await apiClient.get("/api/workshops/options");
    return res.data;
  },

  // --------------------------------------------------------------- Reports
  async getReports(reportType: string, params?: { search?: string }) {
    const res = await apiClient.get("/api/workshops/reports", {
      params: { reportType, workshopType: "bike", ...params },
    });
    return res.data;
  },
};
