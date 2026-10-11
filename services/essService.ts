import { api } from "@/services/api";

export type LedgerEntry = {
  id: string;
  type: string;
  amount: number;
  createdAt?: string;
  note?: string | null;
};

export type TechnicianLedger = {
  netBalance: number;
  totalAdvances: number;
  totalExpensesOwed: number;
  detailedEntries: LedgerEntry[];
};

export async function fetchTechnicianLedger(
  technicianId: string
): Promise<TechnicianLedger> {
  const { data } = await api.getTechnicianLedger(technicianId);
  const techs = Array.isArray(data?.technicians) ? data.technicians : [];
  const mine =
    techs.find((t: { id?: string }) => t.id === technicianId) ?? techs[0] ?? {};
  return {
    netBalance: Number(mine.netBalance ?? data?.netBalance ?? 0),
    totalAdvances: Number(mine.totalAdvances ?? 0),
    totalExpensesOwed: Number(mine.totalExpensesOwed ?? 0),
    // ERP TechnicianLedgerEntry uses `notes`; app type uses `note`
    detailedEntries: Array.isArray(data?.detailedEntries)
      ? data.detailedEntries.map((e: LedgerEntry & { notes?: string | null }) => ({
          ...e,
          note: e.note ?? e.notes ?? null,
        }))
      : [],
  };
}

export async function fetchEssProfile(employeeId: string) {
  const { data } = await api.getEssEmployee(employeeId);
  return data?.employee ?? data;
}

export async function raiseHelpdeskTicket(input: {
  employeeId: string;
  category: string;
  description: string;
}) {
  return api.raiseGrievance(input);
}
