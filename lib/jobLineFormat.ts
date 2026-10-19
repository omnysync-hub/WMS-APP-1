import type { JobItem } from "@/types";

export type ParsedJobLine = {
  id: string;
  title: string;
  subtitle?: string;
  tags: string[];
  qtyPlanned: number;
  qtyActual?: number | null;
  unitRate?: number;
  grossLineTotal?: number;
  discountApprovedAmount?: number;
  lineTotal?: number;
  discountRequested?: string;
  discountApproved?: string;
  issuedByStore: boolean;
  isService: boolean;
  isEquipment?: boolean;
};

function stripDiscountTags(desc: string) {
  return desc.replace(/\s*\[Discount[^\]]*\]/gi, "").trim();
}

function matchTag(desc: string, prefix: string) {
  const m = desc.match(new RegExp(`\\[${prefix}[^\\]]*\\]`, "i"));
  return m?.[0]?.slice(1, -1) ?? null;
}

const ACRONYMS = new Set(["ac", "hvac", "dc", "led", "ups", "pkr", "gps", "id", "tv"]);

/** ERP slugs like `Ac_gas_recharge__leakage_repa` → `AC Gas Recharge Leakage Repa`. */
export function humanizeLabel(raw?: string | null): string {
  if (!raw?.trim()) return "";
  return raw
    .trim()
    .replace(/_{1,}/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      const clean = w.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (ACRONYMS.has(clean)) {
        return w.replace(new RegExp(`\\b${clean}\\b`, "i"), clean.toUpperCase());
      }
      if (/^#?\d+([./-]\d+)*$/.test(w)) return w;
      if (w === "/" || w === "-" || w === "&") return w;
      if (w.includes("/") || w.includes("-")) {
        return w
          .split(/([/-])/)
          .map((sub) => {
            if (sub === "/" || sub === "-") return sub;
            const subClean = sub.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (ACRONYMS.has(subClean)) {
              return sub.replace(new RegExp(`\\b${subClean}\\b`, "i"), subClean.toUpperCase());
            }
            if (/^#?\d+/.test(sub)) return sub;
            return sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase();
          })
          .join("");
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

const PART_KEYWORDS =
  /\b(pipe|wire|cable|tape|gas|freon|refrigerant|r22|r410|r410a|r32|r134|r134a|capacitor|contactor|breaker|bracket|fitting|duct|filter|valve|drain|nut|screw|bolt|fastener|insulation|remote|compressor|motor|fan blade|sensor|thermostat|relay|pcb|board|circuit)\b/i;

const SERVICE_KEYWORDS =
  /\b(service|services|installation|commissioning|labour|labor|service call|site visit|recharge|repair|leakage|inspection|troubleshooting|maintenance|cleaning|uninstallation|dismantling|servicing|visit|charge|fee|audit|checkup)\b/i;

const EQUIPMENT_KEYWORDS =
  /\b(equipment|appliance|specification|rates|inverter ac|split ac|floor standing|cassette ac|window ac|air conditioner|air conditioning|hvac|chiller|refrigerator|fridge|deep freezer|freezer|washing machine|dryer|dishwasher|microwave|oven|stove|hood|dispenser|water dispenser|geyser|water heater|led tv|smart tv|television|ups|inverter split)\b/i;

const BRAND_KEYWORDS =
  /\b(gree|haier|dawlance|orient|kenwood|pel|changhong|tcl|waves|ecostar|homage)\b/i;

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
      .replace(/^\[(?:Service|Equipment)\]\s*/i, "")
      .trim()
  );

  let isService = false;
  let isEquipment = false;

  // Equipment specifications (e.g. appliance specs & rates) must be detected first
  const isEquipmentSpec =
    /^equipment\s*#?\d*/i.test(raw) ||
    /specification\s*&\s*rates/i.test(raw) ||
    /product\s*\/\s*appliance/i.test(raw) ||
    item.category === "equipment" ||
    item.type === "equipment" ||
    /^\[Equipment\]/i.test(raw);

  if (issuedByStore) {
    // Items issued from storekeeper are always physical inventory stock
    isService = false;
  } else if (isEquipmentSpec) {
    // Always classified as equipment spec, rendered under Services & Equipment
    isService = true;
    isEquipment = true;
  } else if (
    item.isService === true ||
    item.type === "service" ||
    item.itemType === "service" ||
    item.category === "service" ||
    /^\[Service\]/i.test(raw) ||
    serviceAdded
  ) {
    isService = true;
  } else if (
    SERVICE_KEYWORDS.test(raw) ||
    SERVICE_KEYWORDS.test(title) ||
    /&\s*commission/i.test(title)
  ) {
    isService = true;
  } else if (
    EQUIPMENT_KEYWORDS.test(raw) ||
    EQUIPMENT_KEYWORDS.test(title) ||
    (BRAND_KEYWORDS.test(title) && !PART_KEYWORDS.test(title))
  ) {
    if (PART_KEYWORDS.test(raw) || PART_KEYWORDS.test(title)) {
      // Physical parts associated with equipment (e.g. "Copper Pipe for Inverter AC")
      isService = false;
    } else {
      isService = true;
      isEquipment = true;
    }
  }

  const tags: string[] = [];
  if (issuedByStore) tags.push("Issued");
  if (isEquipment) tags.push("Equipment");
  else if (isService) tags.push("Service");
  if (discountRequested) tags.push("Discount pending");
  if (discountApproved) tags.push("Discount approved");

  const qtyPlanned = Number(item.quantityPlanned ?? 0);
  const qtyActual = item.quantityActual != null ? Number(item.quantityActual) : null;
  const unitRate = item.unitRate ?? item.unitPrice;
  // If a rate was specified in ERP (e.g. equipment service charges), bill it.
  const rate = unitRate != null ? Number(unitRate) : (isEquipment ? 0 : undefined);

  let discountApprovedAmount = 0;
  if (discountApproved) {
    // Format in ERP: "[Discount Approved: -$10000, Rate: $24500 -> $14500]" or "[Discount Approved: 500]"
    const match =
      discountApproved.match(/Discount Approved:\s*-?\$?(?:PKR\s*)?([0-9]+(?:\.[0-9]+)?)/i) ||
      discountApproved.match(/-?\$?(?:PKR\s*)?([0-9]+(?:\.[0-9]+)?)/i);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        discountApprovedAmount = parsed;
      }
    }
  }

  // For services and equipment with charges: defaults to qtyPlanned or 1.
  // For materials: defaults to actual used quantity (0 if not used yet so customer is not billed for unconsumed truck stock).
  const qtyForTotal = isService
    ? (qtyActual != null ? qtyActual : (qtyPlanned > 0 ? qtyPlanned : 1))
    : (qtyActual != null ? qtyActual : 0);

  // In ERP, unitRate is already the net rate after approved discount ("New rate is PKR 1500").
  const lineTotal = rate != null && !Number.isNaN(rate) ? rate * qtyForTotal : undefined;
  const lineDiscountTotal = discountApprovedAmount * (qtyForTotal > 0 ? qtyForTotal : 1);
  const grossLineTotal = lineTotal != null
    ? (qtyForTotal > 0 ? lineTotal + lineDiscountTotal : lineTotal)
    : undefined;

  return {
    id: item.id,
    title: title || "Item",
    subtitle: serviceAdded ? raw.match(/\[Service Added by ([^\]]+)\]/)?.[1] : undefined,
    tags,
    qtyPlanned,
    qtyActual,
    unitRate: rate,
    grossLineTotal,
    discountApprovedAmount,
    lineTotal,
    discountRequested: discountRequested?.replace(/^Discount Requested:\s*/i, "") ?? undefined,
    discountApproved: discountApproved?.replace(/^Discount Approved:\s*/i, "") ?? undefined,
    issuedByStore,
    isService,
    isEquipment,
  };
}

export function formatMoney(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return `PKR ${Math.round(n).toLocaleString("en-PK")}`;
}

/** ERP tags often store `$500` or `500` — format cleanly as PKR for technicians. */
export function toPkrLabel(text?: string | null) {
  if (!text) return "";
  const cleaned = text
    .trim()
    .replace(/\$\s*(\d+(?:\.\d+)?)/g, (_, n) => `PKR ${Math.round(Number(n)).toLocaleString("en-PK")}`)
    .replace(/PKR\s*(\d+(?:\.\d+)?)/gi, (_, n) => `PKR ${Math.round(Number(n)).toLocaleString("en-PK")}`);
  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    return `PKR ${Math.round(Number(cleaned)).toLocaleString("en-PK")}`;
  }
  return cleaned;
}

export type JobBillingSummary = {
  servicesTotal: number;
  materialsTotal: number;
  issuedMaterialsValue: number;
  itemDiscountsTotal: number;
  jobDiscountTotal: number;
  totalDiscount: number;
  discountsTotal: number;
  grossTotal: number;
  /** Amount the customer pays (including sales tax when the ERP applies tax to this job). */
  netTotal: number;
  /** Amount before tax (after discounts). */
  netBeforeTax: number;
  taxAmount: number;
  taxLabel: string | null;
  taxInclusive: boolean;
};

type BillingTax = {
  enabled?: boolean;
  name?: string | null;
  code?: string | null;
  ratePercent?: number;
  inclusive?: boolean;
  applyAfterDiscount?: boolean;
  rounding?: { mode?: string; decimals?: number };
} | null | undefined;

function roundTax(v: number, rounding?: { mode?: string; decimals?: number }) {
  const f = rounding?.decimals === 0 ? 1 : 100;
  const x = v * f;
  const r = rounding?.mode === "up" ? Math.ceil(x - 1e-9) : rounding?.mode === "down" ? Math.floor(x + 1e-9) : Math.round(x);
  return r / f;
}

/** Same formula as the ERP (lib/tax/taxConfig.ts computeTax). */
export function computeJobTax(gross: number, discount: number, tax: BillingTax) {
  const net = Math.max(0, gross - discount);
  const rate = Number(tax?.ratePercent ?? 0);
  const base = tax?.applyAfterDiscount === false ? Math.max(0, gross) : net;
  if (!tax?.enabled || !(rate > 0) || base <= 0) return { net, tax: 0, total: net };
  const t = tax.inclusive ? roundTax(base - base / (1 + rate / 100), tax.rounding) : roundTax((base * rate) / 100, tax.rounding);
  return { net, tax: t, total: tax.inclusive ? net : net + t };
}

export function calculateJobBilling(
  job: { discountAmount?: number | null; items?: JobItem[]; billingSummary?: { tax?: BillingTax } | null },
  itemsOverride?: JobItem[]
): JobBillingSummary {
  const items = itemsOverride ?? job.items ?? [];
  let servicesTotal = 0;
  let materialsTotal = 0;
  let issuedMaterialsValue = 0;
  let itemDiscountsTotal = 0;
  let allItemDiscountsCapacity = 0;

  for (const it of items) {
    const line = parseJobLine(it);
    // Equipment specs without price are pure specs (not billed)
    if (line.isEquipment && (!line.unitRate || line.unitRate <= 0)) continue;

    const rate = line.unitRate ?? 0;
    const planned = Number(it.quantityPlanned ?? 0);
    // Materials bill only what was actually used. Unused bulk truck stock is not billed to customer.
    const qty = line.isService
      ? (it.quantityActual != null ? Number(it.quantityActual) : (planned > 0 ? planned : 1))
      : (it.quantityActual != null ? Number(it.quantityActual) : 0);

    const lineNet = Math.max(0, rate * qty);

    if (line.isService) {
      servicesTotal += lineNet;
    } else {
      materialsTotal += lineNet;
      issuedMaterialsValue += Math.max(0, rate * planned);
    }

    if (line.discountApprovedAmount) {
      const lineCapacity = line.discountApprovedAmount * (planned > 0 ? planned : 1);
      allItemDiscountsCapacity += lineCapacity;
      if (qty > 0) {
        itemDiscountsTotal += line.discountApprovedAmount * qty;
      }
    }
  }

  const jobDiscount = Math.max(0, Number(job.discountAmount ?? 0));
  // Additional general job discount is any discount amount beyond the item discounts in ERP
  const globalJobDiscount = Math.max(0, jobDiscount - allItemDiscountsCapacity);
  const totalDiscount = itemDiscountsTotal + globalJobDiscount;

  const netBeforeTax = Math.max(0, servicesTotal + materialsTotal - globalJobDiscount);
  const grossTotal = netBeforeTax + totalDiscount;
  const taxInfo = job.billingSummary?.tax;
  const taxCalc = computeJobTax(grossTotal, totalDiscount, taxInfo);
  const netTotal = taxCalc.total;

  return {
    servicesTotal,
    materialsTotal,
    issuedMaterialsValue,
    itemDiscountsTotal,
    jobDiscountTotal: jobDiscount,
    totalDiscount,
    discountsTotal: totalDiscount,
    grossTotal,
    netTotal,
    netBeforeTax,
    taxAmount: taxCalc.tax,
    taxLabel: taxCalc.tax > 0 ? `${taxInfo?.name || taxInfo?.code || "Sales tax"} ${Number(taxInfo?.ratePercent ?? 0)}%${taxInfo?.inclusive ? " (included)" : ""}` : null,
    taxInclusive: !!taxInfo?.inclusive,
  };
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
      // UnitPrice and Total in equipment specs are handled in Services section
      if (key === "unitprice" || key === "total" || key === "price") continue;
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
  if (s === "Assigned") return { label: "Assigned", showBadge: true, tone: "warn" };
  if (s === "Accepted") return { label: "Accepted", showBadge: true, tone: "active" };
  if (s === "InProgress") return { label: "In progress", showBadge: true, tone: "active" };
  if (s === "Paused" || s === "PartiallyCompleted" || s.toLowerCase().includes("partially") || s.toLowerCase().includes("paused")) {
    return { label: "Partially completed", showBadge: true, tone: "muted" };
  }
  if (isTechnicianDoneStatus(s)) {
    return { label: "Completed", showBadge: false, tone: "success" };
  }
  if (s === "TechnicianReassigned") return { label: "Reassigned", showBadge: true, tone: "muted" };
  if (s.toLowerCase().includes("completed")) return { label: "Completed", showBadge: false, tone: "success" };
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
