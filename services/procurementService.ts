import { apiClient } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

/** Identity comes from the signed Bearer token (added by apiClient); no actor headers are sent. */
function actorHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  return headers;
}

export type SimplePrItem = {
  description: string;
  quantity: number;
  unit?: string;
  productId?: string;
  itemCode?: string;
};

export async function fetchMyPurchaseRequisitions() {
  const { data } = await apiClient.get("/api/procurement", {
    params: { view: "prs" },
    headers: actorHeaders(),
  });
  const list = Array.isArray(data) ? data : data?.prs ?? data?.data ?? [];
  const employee = useAuthStore.getState().employee;
  const name = (employee?.name || "").trim().toLowerCase();
  const id = employee?.id;
  // Prefer PRs raised by this tech; fall back to all visible if filter yields none
  const mine = list.filter((pr: any) => {
    const by = String(pr.requestedBy || "").trim().toLowerCase();
    const tech = String(pr.technicianName || "").trim().toLowerCase();
    return (name && (by === name || tech === name)) || (id && pr.requestedById === id);
  });
  return (mine.length ? mine : list) as any[];
}

export async function createSimplePurchaseRequisition(input: {
  notes?: string;
  priority?: "Normal" | "Urgent";
  targetJobNumber?: string;
  items: SimplePrItem[];
}) {
  const employee = useAuthStore.getState().employee;
  if (!employee?.id) throw new Error("Sign in again");
  if (!input.items.length) throw new Error("Add at least one line");

  const payload = {
    action: "create_pr",
    requestedBy: employee.name || "Technician",
    technicianName: employee.name || undefined,
    department: employee.department || "Field Service",
    site: input.targetJobNumber || "Job Site",
    targetType: input.targetJobNumber ? "job" : "store",
    targetName: input.targetJobNumber || "Central Store",
    projectCode: input.targetJobNumber || undefined,
    priority: input.priority || "Normal",
    notes: input.notes || "Mobile parts / material request",
    items: input.items.map((it) => ({
      productId: it.productId || "",
      itemCode: it.itemCode || "",
      description: it.description,
      quantity: Math.max(0.1, Number(it.quantity) || 1),
      unit: it.unit || "pcs",
    })),
  };

  const { data } = await apiClient.post("/api/procurement", payload, {
    headers: actorHeaders(),
  });
  return data;
}

export async function submitPurchaseRequisition(prId: string) {
  const { data } = await apiClient.post(
    "/api/procurement",
    { action: "submit_pr", id: prId },
    { headers: actorHeaders() }
  );
  return data;
}
