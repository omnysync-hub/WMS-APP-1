/**
 * ponytail: smoke-check remark + service split. Upgrade: real unit test if ERP formats grow.
 * Run: npx --yes tsx scripts/check-job-remarks.ts
 */
import { parseJobLine, parseJobRemarks } from "../lib/jobLineFormat";

const rows = parseJobRemarks(
  "[Equipment: Inverter AC | Brand: Gree | Model: Fairy 1.5T] abc | Field Work Execution: Done â€¢ Customer Payment: CASH ($1200) â€¢ Unused Stock Reason: Abc"
);

const by = Object.fromEntries(rows.map((r) => [r.label, r.value]));
if (by.Equipment !== "Inverter AC") throw new Error(`Equipment: ${by.Equipment}`);
if (by.Brand !== "Gree") throw new Error(`Brand: ${by.Brand}`);
if (by.Payment !== "CASH (PKR 1200)") throw new Error(`Payment: ${by.Payment}`);
if (by.Notes) throw new Error("placeholder abc should be skipped");
if (by["Unused stock"]) throw new Error("placeholder Abc unused reason should be skipped");

const svc = parseJobLine({
  id: "1",
  description: "AC Installation & Commissioning",
  quantityPlanned: 1,
  unitRate: 4500,
});
if (!svc.isService) throw new Error("installation line should be a service");

const part = parseJobLine({
  id: "2",
  description: "Copper Pipe 1/4 (123) [Issued by Storekeeper]",
  quantityPlanned: 20,
  unitRate: 1000,
});
if (part.isService) throw new Error("pipe should not be a service");

console.log("check-job-remarks: ok");
