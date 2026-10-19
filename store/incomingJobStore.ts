import { create } from "zustand";

export interface IncomingJobAlert {
  jobId?: string;
  requestId?: string;
  jobNumber?: string;
  title: string;
  body: string;
  address?: string;
  customerName?: string;
}

interface IncomingJobStore {
  isRinging: boolean;
  incoming: IncomingJobAlert | null;
  setRinging: (isRinging: boolean, incoming: IncomingJobAlert | null) => void;
  silence: () => void;
}

export const useIncomingJobStore = create<IncomingJobStore>((set) => ({
  isRinging: false,
  incoming: null,
  setRinging: (isRinging, incoming) => set({ isRinging, incoming }),
  silence: () => set({ isRinging: false }),
}));
