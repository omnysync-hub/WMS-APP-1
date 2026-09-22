import { create } from "zustand";

type SyncState = {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  setPendingCount: (n: number) => void;
  setSyncing: (v: boolean) => void;
  setLastSyncedAt: (t: number) => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  pendingCount: 0,
  isSyncing: false,
  lastSyncedAt: null,
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
}));
