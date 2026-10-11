import { api } from "@/services/api";
import { cacheJob } from "@/services/syncService";
import type { Job } from "@/types";

export async function fetchJobs(technicianId: string, status?: string) {
  const { data } = await api.getJobs(technicianId, status);
  const jobs: Job[] = Array.isArray(data) ? data : data?.jobs ?? data?.data ?? [];
  for (const job of jobs) {
    await cacheJob({
      id: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      customerJson: JSON.stringify(job.customer ?? { name: job.customerName }),
      itemsJson: JSON.stringify(job.items ?? []),
    });
  }
  return jobs;
}

export async function fetchJob(jobId: string) {
  const { data } = await api.getJob(jobId);
  return (data?.job ?? data) as Job;
}

export async function transitionJob(
  jobId: string,
  payload: Record<string, unknown>
) {
  return api.updateJobStatus(jobId, payload);
}

export async function requestJobInventory(
  jobId: string,
  input: { technicianId: string; item: string; qtyRequested: number }
) {
  return api.requestJobInventory(jobId, input);
}

export async function returnJobStock(
  jobId: string,
  input: {
    technicianId: string;
    item: string;
    qtyReturned: number;
    jobItemId?: string;
    productId?: string;
  }
) {
  return api.returnJobStock(jobId, input);
}

export async function fetchWarehouseProducts() {
  const { data } = await api.getInventoryProducts();
  const list = Array.isArray(data) ? data : data?.products ?? [];
  return list as Array<{
    id: string;
    name: string;
    sku?: string;
    stockQuantity?: number;
    unit?: string;
    unitPrice?: number;
    isService?: boolean;
  }>;
}

export async function fetchCatalogServices() {
  const products = await fetchWarehouseProducts();
  return products.filter(
    (p) =>
      p.isService ||
      (p.sku && (p.sku.startsWith("SRV-") || p.sku.startsWith("SVC-"))) ||
      ["service", "visit", "job", "hr", "hour"].includes((p.unit || "").toLowerCase())
  );
}

/** ERP PATCH action: add_service — syncs line items to job in ERP. */
export async function addJobServices(
  jobId: string,
  services: Array<{ description: string; quantity: number; unitRate: number }>,
  actor: string
) {
  return transitionJob(jobId, {
    action: "add_service",
    services,
    actor,
  });
}

export async function batchAcceptJobs(jobIds: string[], technicianId: string) {
  return api.batchAcceptJobs({ jobIds, technicianId });
}

export function isJobVisibleToTechnician(job: Job, technicianId: string) {
  if (job.status === "TechnicianReassigned") return false;
  if (job.assignedTechnicianId === technicianId) return true;
  return (job.assignments || []).some(
    (a: { technicianId: string; status?: string }) => a.technicianId === technicianId && a.status !== "Removed"
  );
}
