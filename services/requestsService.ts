import { api } from "@/services/api";
import type { DispatchRequest } from "@/types";

export async function fetchRequests(technicianId: string) {
  const { data } = await api.getRequests(technicianId);
  return {
    requests: (data?.requests ?? []) as DispatchRequest[],
    unreadCount: (data?.unreadCount ?? 0) as number,
  };
}

export async function respondToRequest(
  requestId: string,
  payload: {
    employeeId: string;
    actionStatus: "accepted" | "rejected" | "acknowledged";
    notes?: string;
    etaMinutes?: number;
  }
) {
  const { data } = await api.respondRequest(requestId, payload);
  return data;
}
