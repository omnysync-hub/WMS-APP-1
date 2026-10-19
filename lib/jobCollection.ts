import type { Job } from "@/types";

/** True when the technician is expected to collect payment on site (not FOC, not office-collected). */
export function technicianCollects(job?: Partial<Job> | null): boolean {
  if (!job) return true;
  if (job.billingSummary && typeof job.billingSummary.technicianCollects === "boolean") {
    return job.billingSummary.technicianCollects;
  }
  return !job.isFoc && job.paymentCollectionMode !== "office";
}

/** Banner copy for jobs where the technician must not collect money. */
export function noCollectionCopy(job?: Partial<Job> | null): { title: string; detail: string } {
  if (job?.isFoc) {
    const company = job.careOfParty?.companyName;
    return {
      title: "FOC job — no collection",
      detail: `Referred by ${company || "a company"}; the company pays the office. Do not take any payment from the customer.`,
    };
  }
  return {
    title: "No collection — office collects",
    detail: "Payment for this job is collected by the office. Do not take cash; your hisaab expects PKR 0.",
  };
}
