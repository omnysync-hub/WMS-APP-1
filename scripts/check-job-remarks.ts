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
if (!part.issuedByStore) throw new Error("issuedByStore should be true");

// Test cases for ERP Equipment & Rates
const eq1 = parseJobLine({
  id: "3",
  description: "EQUIPMENT #1 Specification & Rates",
  quantityPlanned: 1,
  unitRate: 0,
});
if (!eq1.isService) throw new Error("EQUIPMENT #1 Specification & Rates should be classified as service");

const eq2 = parseJobLine({
  id: "4",
  description: "Product / Appliance Type: Inverter AC",
  quantityPlanned: 1,
  unitRate: 0,
});
if (!eq2.isService) throw new Error("Inverter AC specification should be classified as service");

const eq3 = parseJobLine({
  id: "5",
  description: "Gree Inverter Split",
  quantityPlanned: 1,
  unitRate: 0,
});
if (!eq3.isService) throw new Error("Gree Inverter Split should be classified as service");

const storePart = parseJobLine({
  id: "6",
  description: "R410A Refrigerant Gas (Kg)",
  quantityPlanned: 2,
  unitRate: 3500,
});
if (storePart.isService) throw new Error("Gas cylinder/material should remain inventory");

const capPart = parseJobLine({
  id: "7",
  description: "Capacitor 45uF for Gree Inverter AC",
  quantityPlanned: 1,
  unitRate: 1200,
});
if (capPart.isService) throw new Error("Capacitor part for AC should remain inventory");

// Test discount approved deduction on line
const discountedPart = parseJobLine({
  id: "8",
  description: "Copper Pipe 1/2 [Discount Approved: 400]",
  quantityPlanned: 2,
  quantityActual: 2,
  unitRate: 1000,
});
if (discountedPart.discountApprovedAmount !== 400) throw new Error(`Expected discount 400, got ${discountedPart.discountApprovedAmount}`);
if (discountedPart.lineTotal !== 2000) throw new Error(`Expected net lineTotal 2000, got ${discountedPart.lineTotal}`);
if (discountedPart.grossLineTotal !== 2400) throw new Error(`Expected grossLineTotal 2400, got ${discountedPart.grossLineTotal}`);

// Test calculateJobBilling does not charge for equipment, does not bill unused stock, and handles discounts accurately
import { calculateJobBilling } from "../lib/jobLineFormat";
const testJob = {
  discountAmount: 400,
  items: [
    { id: "e1", description: "Inverter AC (Gree)", quantityPlanned: 1, unitRate: 150000 },
    { id: "s1", description: "AC Installation & Commissioning", quantityPlanned: 1, unitRate: 3500 },
    { id: "m1", description: "Copper Pipe 1/2 [Discount Approved: 400]", quantityPlanned: 20, quantityActual: 2, unitRate: 1000 },
  ],
};
const billing = calculateJobBilling(testJob);
// Services: 3500 (equipment excluded)
if (billing.servicesTotal !== 3500) throw new Error(`Expected services 3500, got ${billing.servicesTotal}`);
// Materials: 2 units actually used * 1000 = 2000 (not 20 * 1000 = 20000)
if (billing.materialsTotal !== 2000) throw new Error(`Expected materials 2000, got ${billing.materialsTotal}`);
// Warehouse stock issued value: 20 * 1000 = 20000
if (billing.issuedMaterialsValue !== 20000) throw new Error(`Expected issuedMaterialsValue 20000, got ${billing.issuedMaterialsValue}`);
// Total discount: 400
if (billing.totalDiscount !== 400) throw new Error(`Expected discount 400, got ${billing.totalDiscount}`);
// Net to collect: 5500
if (billing.netTotal !== 5500) throw new Error(`Expected net 5500, got ${billing.netTotal}`);
// Gross total: 5900
if (billing.grossTotal !== 5900) throw new Error(`Expected gross 5900, got ${billing.grossTotal}`);

// Test unused inventory with discount approved does not leak discount into services
const unconsumedJob = {
  discountAmount: 500,
  items: [
    { id: "s1", description: "AC Service", quantityPlanned: 1, unitRate: 3000 },
    { id: "m1", description: "Refrigerant Gas [Discount Approved: 500]", quantityPlanned: 1, quantityActual: 0, unitRate: 2000 },
  ],
};
const unconsumedBilling = calculateJobBilling(unconsumedJob);
if (unconsumedBilling.servicesTotal !== 3000) throw new Error(`Expected services 3000, got ${unconsumedBilling.servicesTotal}`);
if (unconsumedBilling.materialsTotal !== 0) throw new Error(`Expected materials 0, got ${unconsumedBilling.materialsTotal}`);
if (unconsumedBilling.netTotal !== 3000) throw new Error(`Expected net 3000, got ${unconsumedBilling.netTotal}`);
if (unconsumedBilling.totalDiscount !== 0) throw new Error(`Expected discount 0 for unconsumed item, got ${unconsumedBilling.totalDiscount}`);

console.log("check-job-remarks: ok");

