import React from "react";
import { View, Text } from "react-native";

/** The 10 SOP statuses, in lifecycle order (Rejected is a side-exit). */
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

export function statusChipClasses(status: string): { wrap: string; text: string } {
  switch (status) {
    case "Closed":
      return { wrap: "bg-zinc-800", text: "text-zinc-400" };
    case "Completed":
      return { wrap: "bg-emerald-950/80 border border-emerald-800", text: "text-emerald-300" };
    case "Pending Approval":
      return { wrap: "bg-amber-950/80 border border-amber-800", text: "text-amber-300" };
    case "Rejected":
      return { wrap: "bg-red-950/80 border border-red-800", text: "text-red-300" };
    case "Approved":
    case "In Progress":
      return { wrap: "bg-cyan-950/80 border border-cyan-800", text: "text-cyan-300" };
    case "On Hold":
      return { wrap: "bg-orange-950/80 border border-orange-800", text: "text-orange-300" };
    default:
      return { wrap: "bg-zinc-800/80 border border-zinc-700", text: "text-zinc-300" };
  }
}

export function StatusChip({ status }: { status: string }) {
  const c = statusChipClasses(status);
  return (
    <View className={`px-2 py-0.5 rounded-full ${c.wrap}`}>
      <Text className={`text-[10px] font-bold ${c.text}`}>{status}</Text>
    </View>
  );
}

/** The 10 steps of the Workshop Job Card SOP. */
export const SOP_STEPS = [
  "Job Card Created",
  "Technician Assigned",
  "Inspection & Diagnosis",
  "Manager Approval",
  "Store Requisition",
  "Inventory Issued",
  "Work & Testing",
  "Job Completed",
  "Material Returned",
  "Closed & Delivered",
] as const;

/**
 * Derives how far a job card has progressed through the SOP from its ERP
 * fields. Indicative only — the server remains the authority on controls.
 */
export function deriveStepState(job: any): { done: boolean[]; current: number } {
  const reqs: any[] = job.requisitions || [];
  const tools: any[] = job.toolIssues || [];
  const anyIssued = reqs.some((r) => (r.issuedQty || 0) > 0);
  const anyRequested = reqs.length > 0;
  const pendingRequests = reqs.some((r) => r.status === "requested");
  const outstandingTools = tools.some((t) => t.status === "issued");
  const status = job.status as string;

  const done = [
    true, // 1 created (the card exists)
    !!job.assignedStaffId || !!job.assignedStaffName, // 2
    !!job.inspectionFindings, // 3
    job.approvalStatus === "approved", // 4
    anyRequested, // 5
    anyIssued, // 6
    !!job.testedAt || !!job.testingPressurePsi || !!job.testingNotes, // 7 (testing logged)
    status === "Completed" || status === "Closed", // 8
    // 9: nothing left pending at store, no tools still out, and job completed
    (status === "Completed" || status === "Closed") && !pendingRequests && !outstandingTools, // 9
    status === "Closed", // 10
  ];
  const current = done.findIndex((d) => !d);
  return { done, current: current === -1 ? SOP_STEPS.length : current };
}

export function StepProgress({ job }: { job: any }) {
  const { done, current } = deriveStepState(job);
  return (
    <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
      <Text className="text-zinc-400 text-[10px] uppercase font-bold mb-2">
        SOP Progress — Step {Math.min(current + 1, 10)} of 10
        {job.status === "Rejected" ? " • Rejected by Manager" : ""}
      </Text>
      <View className="flex-row gap-1 mb-2">
        {done.map((d, i) => (
          <View
            key={i}
            className={`flex-1 h-1.5 rounded-full ${
              d ? "bg-emerald-500" : i === current ? "bg-cyan-500" : "bg-zinc-800"
            }`}
          />
        ))}
      </View>
      <Text className="text-zinc-300 text-xs font-semibold">
        {job.status === "Closed"
          ? "Job card closed — unit ready for delivery."
          : `Next: ${SOP_STEPS[current] || "Closed & Delivered"}`}
      </Text>
    </View>
  );
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}
