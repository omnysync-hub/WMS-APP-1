// ponytail: assert humanizeLabel — ceiling: few fixtures; upgrade: shared test runner
const ACRONYMS = new Set(["ac", "hvac", "dc", "led", "ups", "pkr", "gps", "id"]);
function humanizeLabel(raw) {
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
const cases = [
  ["Ac_gas_recharge__leakage_repa", "AC Gas Recharge Leakage Repa"],
  ["Installation___commissioning", "Installation Commissioning"],
  ["ac-installation", "AC Installation"],
];
for (const [input, expected] of cases) {
  const got = humanizeLabel(input);
  if (got !== expected) {
    console.error("FAIL", input, "=>", got, "expected", expected);
    process.exit(1);
  }
}
console.log("humanizeLabel ok");
