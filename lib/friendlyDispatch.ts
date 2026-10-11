/** Strip ERP bracket tags + mojibake so techs see plain English. */
export function stripErpJargon(text: string): string {
  return text
    .replace(/Ã—/g, "x")
    .replace(/×/g, "x")
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

export function friendlyPriority(priority: string): string {
  const p = (priority || "").toLowerCase();
  if (p === "urgent" || p === "high") return "Important";
  if (p === "low") return "Low";
  return "Normal";
}

/** Clean title/body for inbox cards and toasts (works on old + new payloads). */
export function friendlyDispatchCopy(title: string, body: string) {
  let t = stripErpJargon(title);
  let b = stripErpJargon(body);

  t = t
    .replace(/^Discount Approved for Job #?/i, "Discount approved — ")
    .replace(/^Discount Request Rejected for Job #?/i, "Discount declined — ")
    .replace(/^Parts issued\s*-?\s*/i, "Parts ready — ")
    .replace(/^New Job Assigned:\s*/i, "New job — ")
    .replace(/^Job Assigned:\s*/i, "New job — ")
    .replace(/^New Job:\s*/i, "New job — ")
    .replace(/^Reassigned Job:\s*/i, "Job reassigned — ");

  b = b
    .replace(/^Item discount of PKR\s+(\d+(?:\.\d+)?)\s+was approved for\s+'([^']+)'\.\s*New rate is PKR\s+(\d+(?:\.\d+)?)\.?/i, "$2: PKR $1 off. New price PKR $3.")
    .replace(/^Discount request for\s+'([^']+)'\s+was declined:\s*/i, "$1 — declined. ")
    .replace(/^(\d+)\s*[x×]\s*(.+?)\s+ready for your job\.?\s*Check stock on the job screen\.?/i, "$1 x $2 is ready. Open the job to check.")
    .replace(/You have been assigned to\s+/i, "")
    .replace(/\.\s*Tap to review and accept\.?/i, ". Tap to accept.")
    .replace(/Open the app to accept\.?/i, "Tap to accept.");

  return { title: t || title, body: b || body };
}
