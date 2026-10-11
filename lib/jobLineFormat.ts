import type { JobItem } from "@/types";

export type ParsedJobLine = {
  id: string;
  title: string;
  subtitle?: string;
  tags: string[];
  qtyPlanned: number;
  qtyActual?: number | null;
  unitRate?: number;
  lineTotal?: number;
  discountRequested?: string;
  discountApproved?: string;
  issuedByStore: boolean;
  isService: boolean;
};

function stripDiscountTags(desc: string) {
  return desc.replace(/\s*\[Discount[^\]]*\]/gi, "").trim();
}

function matchTag(desc: string, prefix: string) {
  const m = desc.match(new RegExp(`\\[${prefix}[^\\]]*\\]`, "i"));
  return m?.[0]?.slice(1, -1) ?? null;
}

const ACRONYMS = new Set(["ac", "hvac", "dc", "led", "ups", "pkr", "gps", "id"]);

/** ERP slugs like `Ac_gas_recharge__leakage_repa` → `AC Gas Recharge Leakage Repa`. */
export function humanizeLabel(raw?: string | null): string {
  if (!raw?.trim()) return "";
  return raw
    .trim()
    .replace(/[_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      if (/^\d+$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function parseJobLine(item: JobItem): ParsedJobLine {
  const raw = (item.description ?? item.name ?? "Item").trim();
  const discountRequested = matchTag(raw, "Discount Requested:");
  const discountApproved = matchTag(raw, "Discount Approved:");
  const issuedByStore = /\[Issued by Storekeeper\]/i.test(raw);
  const serviceAdded = /\[Service Added by/i.test(raw);

  let title = humanizeLabel(
    stripDiscountTags(raw)
      .replace(/\s*\[Issued by Storekeeper\]/gi, "")
      .replace(/\s*\[Service Added by[^\]]+\]/gi, "")
      .replace(/^\[Service\]\s*/i, "")
      .trim()
  );

  const isService =
    /^\[Service\]/i.test(raw) ||
    serviceAdded ||
    /\b(installation|commissioning|labour|labor|service call|site visit|recharge|repair|leakage)\b/i.test(
      title
    ) ||
    /&\s*commission/i.test(title);

  const tags: string[] = [];
  if (issuedByStore) tags.push("Issued");
  if (isService) tags.push("Service");
  if (discountRequested) tags.push("Discount pending");
  if (discountApproved) tags.push("Discount approved");

  const qtyPlanned = Number(item.quantityPlanned ?? 0);
  const qtyActual = item.quantityActual;
  const unitRate = item.unitRate ?? item.unitPrice;
  const rate = unitRate != null ? Number(unitRate) : undefined;
  const qtyForTotal = qtyActual != null && qtyActual !== undefined ? Number(qtyActual) : qtyPlanned;

  return {
    id: item.id,
    title: title || "Item",
    subtitle: serviceAdded ? raw.match(/\[Service Added by ([^\]]+)\]/)?.[1] : undefined,
    tags,
    qtyPlanned,
    qtyActual,
    unitRate: rate,
    lineTotal: rate != null && !Number.isNaN(rate) ? rate * qtyForTotal : undefined,
    discountRequested: discountRequested?.replace(/^Discount Requested:\s*/i, "") ?? undefined,
    discountApproved: discountApproved?.replace(/^Discount Approved:\s*/i, "") ?? undefined,
    issuedByStore,
    isService,
  };
}

export function formatMoney(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return `PKR ${Math.round(n).toLocaleString("en-PK")}`;
}

/** ERP tags often store `$500` — show as PKR for technicians. */
export function toPkrLabel(text?: string | null) {
  if (!text) return "";
  return text.replace(/\$\s*/g, "PKR ");
}

function cleanText(s: string) {
  return toPkrLabel(
    s
      .replace(/\u00c3\u00a2\u20ac\u00a2/g, "·") // UTF-8 mojibake for •
      .replace(/â€¢/g, "·")
      .replace(/â€“|â€”/g, "—")
      .replace(/[•●]/g, "·")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

function isPlaceholder(v: string) {
  return /^(abc|hhg|test|xxx|n\/?a|none|-|\.)$/i.test(v.trim());
}

const REMARK_LABELS: Record<string, string> = {
  equipment: "Equipment",
  brand: "Brand",
  model: "Model",
  "field work execution": "Work done",
  "customer payment": "Payment",
  "unused stock reason": "Unused stock",
  "proof photos": "Proof photos",
  payment: "Payment",
  notes: "Notes",
};

/**
 * Turn messy ERP remarks into clean label/value rows for the technician.
 * Handles [Equipment: … | Brand: …], bullets, and `$` → PKR.
 */
export function parseJobRemarks(raw?: string | null): { label: string; value: string }[] {
  if (!raw?.trim()) return [];
  let text = cleanText(raw);
  const rows: { label: string; value: string }[] = [];

  const bracket = text.match(/\[([^\]]+)\]/);
  if (bracket) {
    for (const part of bracket[1].split("|")) {
      const m = part.match(/^\s*([^:]+):\s*(.+)\s*$/);
      if (!m) continue;
      const key = m[1].trim().toLowerCase();
      const val = cleanText(m[2]);
      if (!val || isPlaceholder(val)) continue;
      rows.push({ label: REMARK_LABELS[key] ?? m[1].trim(), value: val });
    }
    text = text.replace(bracket[0], " ").trim();
  }

  // Split remaining "Key: value · Key: value" / "| " chunks
  const chunks = text
    .split(/\s*[|·]\s*/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const m = chunk.match(/^([^:]+):\s*(.+)$/);
    if (m) {
      const key = m[1].trim().toLowerCase();
      const val = cleanText(m[2]);
      if (!val || isPlaceholder(val)) continue;
      // Skip photo counts that are just bookkeeping noise if 0? keep if useful
      rows.push({ label: REMARK_LABELS[key] ?? m[1].trim(), value: val });
    } else if (!isPlaceholder(chunk) && chunk.length > 2) {
      rows.push({ label: "Notes", value: chunk });
    }
  }

  // Dedupe by label+value
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.label}|${r.value}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * ERP post-completion pipeline: AwaitingFeedback -> CompletedPendingVerification -> Finalized -> Verified.
 * All of these are "Done" from the technician's point of view.
 */
export const TECH_DONE_STATUSES = [
  "AwaitingFeedback",
  "CompletedPendingVerification",
  "Finalized",
  "Verified",
  "Completed",
];

export function isTechnicianDoneStatus(status: string): boolean {
  return TECH_DONE_STATUSES.includes(status) || status.toLowerCase().includes("completed");
}

/** Technician-facing job status — ERP verification states show as Done. */
export function technicianJobStatus(status: string): {
  label: string;
  showBadge: boolean;
  tone?: "success" | "active" | "warn" | "muted";
} {
  const s = String(status);
  if (s === "Assigned") return { label: "New job", showBadge: true, tone: "warn" };
  if (s === "Accepted") return { label: "Accepted", showBadge: true, tone: "active" };
  if (s === "InProgress") return { label: "Working", showBadge: true, tone: "active" };
  if (s === "Paused") return { label: "Paused", showBadge: true, tone: "muted" };
  if (isTechnicianDoneStatus(s)) {
    return { label: "Done", showBadge: false, tone: "success" };
  }
  if (s === "TechnicianReassigned") return { label: "Reassigned", showBadge: true, tone: "muted" };
  if (s.toLowerCase().includes("completed")) return { label: "Done", showBadge: false, tone: "success" };
  if (s === "Cancelled") return { label: "Cancelled", showBadge: true, tone: "muted" };
  return { label: s, showBadge: true, tone: "muted" };
}

export function jobHasInventoryPanel(job: { inventoryRequests?: { status?: string }[] }, items: JobItem[]) {
  const reqs = job.inventoryRequests ?? [];
  if (reqs.length > 0) return true;
  return items.some((it) => {
    const raw = (it.description ?? it.name ?? "").toLowerCase();
    return (
      raw.includes("[discount") ||
      raw.includes("[issued by storekeeper]") ||
      raw.includes("[service added by") ||
      raw.startsWith("[service]")
    );
  });
}

export function inventoryReqStatus(status?: string) {
  const s = (status || "pending").toLowerCase();
  if (s === "issued") return { label: "Issued", tone: "success" as const };
  if (s === "rejected" || s === "declined") return { label: "Declined", tone: "danger" as const };
  return { label: "Pending", tone: "warn" as const };
}
