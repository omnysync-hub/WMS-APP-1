import { api } from "@/services/api";

export async function fetchLeaves(employeeId: string) {
  const { data } = await api.getLeaves(employeeId);
  return data;
}

export async function applyLeave(payload: {
  employeeId: string;
  leaveTypeId?: string;
  leaveType?: string;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  const { data } = await api.submitLeave(payload);
  return data;
}
