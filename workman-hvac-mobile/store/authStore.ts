import { create } from "zustand";

interface HvacTechState {
  techId: string;
  techName: string;
  benchRig: string;
  shiftStatus: "active" | "break" | "off_duty";
  setTech: (id: string, name: string, rig?: string) => void;
  setShiftStatus: (status: "active" | "break" | "off_duty") => void;
}

export const useAuthStore = create<HvacTechState>((set) => ({
  techId: "h1",
  techName: "Khurram Shahzad (Lead HVAC Tech)",
  benchRig: "Bench Rig #1 (HVAC)",
  shiftStatus: "active",
  setTech: (id, name, rig = "Bench Rig #1") => set({ techId: id, techName: name, benchRig: rig }),
  setShiftStatus: (shiftStatus) => set({ shiftStatus }),
}));
