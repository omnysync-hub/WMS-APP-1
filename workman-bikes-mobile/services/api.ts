import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const DEFAULT_ERP_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__
    ? Platform.OS === "android"
      ? "http://10.0.2.2:3001"
      : "http://localhost:3001"
    : "https://softwareworkmanservices.com.pk");

export let ERP_BASE_URL = DEFAULT_ERP_BASE_URL;

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

const apiClient = axios.create({
  baseURL: ERP_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "x-actor-role": "mechanic",
    "x-actor-name": "Bike Workshop Mechanic",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const currentBase = await getStoredApiUrl();
  config.baseURL = currentBase;
  return config;
});

export const WorkshopBikesApi = {
  async getJobs(params?: { status?: string; search?: string }) {
    const res = await apiClient.get("/api/workshops/jobs", {
      params: { workshopType: "bike", ...params },
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
      workshopType: "bike",
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
      estimatedHours: number;
      estimatedCost: number;
    }
  ) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "diagnose",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  async requestParts(jobCardId: string, items: Array<{ description: string; requestedQty: number; unit?: string }>) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "request_material",
      jobCardId,
      items,
    });
    return res.data;
  },

  async saveTestRun(jobCardId: string, data: { testingLeakTest: string; testingNotes?: string }) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "test",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  async completeJob(jobCardId: string, workDoneSummary: string) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "complete",
      jobCardId,
      workDoneSummary,
    });
    return res.data;
  },

  async recordScrap(jobCardId: string, data: { itemDescription: string; quantity?: number; unit?: string; customerKept?: boolean }) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "record_scrap",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  async closeJob(jobCardId: string, data?: { closeNotes?: string; deliveryStatus?: string; deliveredTo?: string }) {
    const res = await apiClient.post("/api/workshops/jobs", {
      action: "close",
      jobCardId,
      ...data,
    });
    return res.data;
  },

  async getTools() {
    const res = await apiClient.get("/api/workshops/tools", { params: { workshopType: "bike" } });
    return res.data;
  },

  async issueTool(toolId: string, staffName: string, quantity = 1, jobCardId?: string) {
    const res = await apiClient.post("/api/workshops/tools", {
      action: "issue",
      toolId,
      staffName,
      quantity,
      jobCardId,
    });
    return res.data;
  },

  async returnTool(issueId: string, returnCondition = "Operational", notes?: string) {
    const res = await apiClient.post("/api/workshops/tools", {
      action: "return",
      issueId,
      returnCondition,
      notes,
    });
    return res.data;
  },

  async getScrap() {
    const res = await apiClient.get("/api/workshops/scrap", { params: { workshopType: "bike" } });
    return res.data;
  },

  async getOptions() {
    const res = await apiClient.get("/api/workshops/options");
    return res.data;
  },
};
