import { create } from "zustand";

type ToastTone = "success" | "error" | "info";

type ToastState = {
  visible: boolean;
  message: string;
  tone: ToastTone;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: "",
  tone: "info",
  show: (message, tone = "info") => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ visible: true, message, tone });
    hideTimer = setTimeout(() => set({ visible: false }), 2800);
  },
  hide: () => set({ visible: false }),
}));

export function toast(message: string, tone: ToastTone = "info") {
  useToastStore.getState().show(message, tone);
}
