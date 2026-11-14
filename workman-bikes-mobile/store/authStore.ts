import { create } from "zustand";

interface MechanicState {
  mechanicId: string;
  mechanicName: string;
  bayNumber: string;
  shiftStatus: "active" | "break" | "off_duty";
  setMechanic: (id: string, name: string, bay?: string) => void;
  setShiftStatus: (status: "active" | "break" | "off_duty") => void;
}

export const useAuthStore = create<MechanicState>((set) => ({
  mechanicId: "m1",
  mechanicName: "Muhammad Ali (Mechanic)",
  bayNumber: "Bay 2 (Bikes)",
  shiftStatus: "active",
  setMechanic: (id, name, bay = "Bay 1") => set({ mechanicId: id, mechanicName: name, bayNumber: bay }),
  setShiftStatus: (shiftStatus) => set({ shiftStatus }),
}));
