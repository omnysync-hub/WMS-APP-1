/**
 * Shared workshop domain helpers for the Bikes app:
 * - ERP employee -> workshop role mapping (SOP roles)
 * - UI permission matrix per SOP step
 * - SOP status list, chip styling and the 10-step lifecycle mapping
 */

export interface ErpEmployee {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  role: string;
  department?: string | null;
  designation?: string | null;
  status?: string | null;
}

export type WorkshopRole = "manager" | "supervisor" | "storekeeper" | "mechanic";

export const WORKSHOP_ROLE_LABELS: Record<WorkshopRole, string> = {
  manager: "Workshop Manager",
  supervisor: "Workshop Supervisor",
  storekeeper: "Store Keeper",
  mechanic: "Mechanic",
};

/**
 * Map an ERP employee (from POST /api/mobile/auth) to an SOP workshop role.
 * ERP roles are technician | dispatcher | accountant | admin | storekeeper |
 * call_center | hr; the workshop distinction usually lives in `designation`.
 */
export function workshopRoleFor(emp: Pick<ErpEmployee, "role" | "designation"> | null | undefined): WorkshopRole {
  if (!emp) return "mechanic";
  const role = (emp.role || "").toLowerCase();
  const des = (emp.designation || "").toLowerCase();
  if (role === "admin" || des.includes("manager")) return "manager";
  if (des.includes("supervisor")) return "supervisor";
  if (role === "storekeeper" || des.includes("store")) return "storekeeper";
  return "mechanic";
}

export type WorkshopAction =
  | "create"
  | "assign"
  | "diagnose"
  | "approve"
  | "request_material"
  | "issue_material"
  | "return_material"
  | "testing"
  | "complete"
  | "record_scrap"
  | "close"
  | "tool_create"
  | "tool_audit"
  | "scrap_store"
  | "scrap_dispose";

/** SOP role ownership of each step (manager, as final authority, can cover all). */
const PERMISSIONS: Record<WorkshopAction, WorkshopRole[]> = {
  create: ["supervisor", "manager"],
  assign: ["supervisor", "manager"],
  diagnose: ["mechanic", "manager"],
  approve: ["manager"],
  request_material: ["mechanic", "manager"],
  issue_material: ["storekeeper", "manager"],
  return_material: ["mechanic", "storekeeper", "manager"],
  testing: ["mechanic", "manager"],
  complete: ["mechanic", "manager"],
  record_scrap: ["mechanic", "storekeeper", "manager"],
  close: ["manager"],
  tool_create: ["storekeeper", "supervisor", "manager"],
  tool_audit: ["storekeeper", "supervisor", "manager"],
  scrap_store: ["storekeeper", "manager"],
  scrap_dispose: ["manager"],
};

export function canDo(role: WorkshopRole, action: WorkshopAction): boolean {
  return PERMISSIONS[action].includes(role);
}

export const JOB_STATUSES = [
  "Open",
  "Assigned",
  "Under Inspection",
  "Pending Approval",
  "Approved",
  "Rejected",
  "In Progress",
  "On Hold",
  "Completed",
  "Closed",
] as const;

/** Tailwind classes for a status chip, covering every SOP status. */
export function statusChip(status: string): { wrap: string; text: string } {
  switch (status) {
    case "Closed":
      return { wrap: "bg-zinc-800 border border-zinc-700", text: "text-zinc-300" };
    case "Completed":
      return { wrap: "bg-emerald-950/80 border border-emerald-800", text: "text-emerald-300" };
    case "Pending Approval":
      return { wrap: "bg-amber-950/80 border border-amber-800", text: "text-amber-300" };
    case "Rejected":
      return { wrap: "bg-red-950/80 border border-red-800", text: "text-red-300" };
    case "Approved":
      return { wrap: "bg-teal-950/80 border border-teal-800", text: "text-teal-300" };
    case "In Progress":
      return { wrap: "bg-sky-950/80 border border-sky-800", text: "text-sky-300" };
    case "On Hold":
      return { wrap: "bg-orange-950/80 border border-orange-800", text: "text-orange-300" };
    case "Under Inspection":
      return { wrap: "bg-violet-950/80 border border-violet-800", text: "text-violet-300" };
    case "Assigned":
      return { wrap: "bg-indigo-950/80 border border-indigo-800", text: "text-indigo-300" };
    default: // Open
      return { wrap: "bg-zinc-900 border border-zinc-700", text: "text-zinc-200" };
  }
}

export const SOP_STEPS = [
  "Intake",
  "Assign",
  "Diagnose",
  "Approve",
  "Requisition",
  "Issue",
  "Work & Test",
  "Complete",
  "Returns",
  "Close",
] as const;

/**
 * How many of the 10 SOP steps are complete for a job, derived from its
 * status and data. Used by the step progress indicator on the job card.
 */
export function completedSteps(job: any): number {
  if (!job) return 0;
  const reqs: any[] = job.requisitions || [];
  const anyIssued = reqs.some((r) => (r.issuedQty || 0) > 0);
  switch (job.status) {
    case "Open":
      return 1;
    case "Assigned":
      return 2;
    case "Under Inspection":
      return 2;
    case "Pending Approval":
      return 3;
    case "Rejected":
      return 3;
    case "Approved":
      return 4;
    case "In Progress":
      return anyIssued ? 6 : 5;
    case "On Hold":
      return anyIssued ? 6 : 5;
    case "Completed":
      return 8;
    case "Closed":
      return 10;
    default:
      return 1;
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoney(value?: number | null): string {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}
