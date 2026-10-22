import { api } from "@/services/api";
import { cacheJob } from "@/services/syncService";
import type { Job } from "@/types";

export async function fetchJobs(technicianId: string, status?: string) {
  try {
    const { data } = await api.getJobs(technicianId, status);
    const jobs: Job[] = Array.isArray(data) ? data : data?.jobs ?? data?.data ?? [];
    for (const job of jobs) {
      try {
        await cacheJob({
          id: job.id,
          jobNumber: job.jobNumber,
          status: job.status,
          customerJson: JSON.stringify(job.customer ?? { name: job.customerName }),
          itemsJson: JSON.stringify(job.items ?? []),
        });
      } catch {
        /* SQLite cache failure must never prevent jobs from loading */
      }
    }
    return jobs;
  } catch (err) {
    try {
      const { getDatabase } = await import("@/db/database");
      const db = await getDatabase();
      const rows = await db.getAllAsync<{
        id: string;
        jobNumber: string;
        status: string;
        customerJson: string;
        itemsJson: string;
      }>("SELECT * FROM local_jobs ORDER BY updatedAt DESC");
      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          jobNumber: r.jobNumber,
          status: r.status as any,
          customer: JSON.parse(r.customerJson),
          items: JSON.parse(r.itemsJson),
        })) as Job[];
      }
    } catch {
      /* ignore offline fallback errors */
    }
    throw err;
  }
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

export function isServiceProduct(p: {
  isService?: boolean;
  sku?: string;
  unit?: string;
}) {
  if (p.isService === true) return true;
  const sku = (p.sku || "").toUpperCase();
  if (
    sku.startsWith("SRV-") ||
    sku.startsWith("SVC-") ||
    sku.startsWith("SERVICE-") ||
    sku.startsWith("LABOR-") ||
    sku.startsWith("LBR-")
  ) {
    return true;
  }
  const unit = (p.unit || "").toLowerCase();
  if (["service", "visit", "job", "hr", "hour", "labor"].includes(unit)) {
    return true;
  }
  return false;
}

export function isPhysicalInventoryProduct(p: {
  isService?: boolean;
  sku?: string;
  unit?: string;
}) {
  return !isServiceProduct(p);
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
  return products.filter(isServiceProduct);
}

export async function fetchPhysicalInventoryProducts() {
  const products = await fetchWarehouseProducts();
  return products.filter(isPhysicalInventoryProduct);
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
