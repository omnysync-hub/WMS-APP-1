import { getDatabase } from "@/db/database";
import { apiClient } from "@/services/api";
import { useSyncStore } from "@/store/syncStore";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

function uuid() {
  return `mut_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getCurrentOwnerId(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync("wms_employee");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown };
    return typeof parsed.id === "string" && parsed.id ? parsed.id : null;
  } catch {
    return null;
  }
}

export async function enqueueMutation(input: {
  endpoint: string;
  method: string;
  payload: unknown;
}) {
  const ownerId = await getCurrentOwnerId();
  if (!ownerId) throw new Error("Sign in before saving an offline action.");
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO pending_mutations (id, ownerId, endpoint, method, payloadJson, createdAt, retryCount)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [uuid(), ownerId, input.endpoint, input.method, JSON.stringify(input.payload), Date.now()]
  );
  const count = await getPendingCount();
  useSyncStore.getState().setPendingCount(count);
}

export async function getPendingCount() {
  const ownerId = await getCurrentOwnerId();
  if (!ownerId) return 0;
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM pending_mutations WHERE ownerId = ?`,
    [ownerId]
  );
  return row?.c ?? 0;
}

export async function processSyncQueue() {
  const { isSyncing, setSyncing, setPendingCount, setLastSyncedAt } =
    useSyncStore.getState();
  if (isSyncing) return;

  setSyncing(true);
  try {
    const ownerId = await getCurrentOwnerId();
    if (!ownerId) return;
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      endpoint: string;
      method: string;
      payloadJson: string;
      retryCount: number;
    }>(`SELECT * FROM pending_mutations WHERE ownerId = ? ORDER BY createdAt ASC LIMIT 20`, [ownerId]);

    for (const row of rows) {
      try {
        let payload = JSON.parse(row.payloadJson) as Record<string, unknown>;

        // Attendance is proof-of-presence and must never be backdated or have
        // its capture time rewritten. Remove legacy queued punches safely.
        if (row.endpoint.includes("/api/attendance")) {
          await db.runAsync(`DELETE FROM pending_mutations WHERE id = ?`, [row.id]);
          continue;
        }

        if (row.endpoint.includes("/api/mobile/telemetry")) {
          payload = {
            ...payload,
            source:
              typeof payload.source === "string" && payload.source.includes("offline")
                ? payload.source
                : "mobile_gps_offline",
          };
        }

        await apiClient.request({
          url: row.endpoint,
          method: row.method.toLowerCase(),
          data: payload,
          validateStatus: (s) => s >= 200 && s < 300,
        });
        await db.runAsync(`DELETE FROM pending_mutations WHERE id = ?`, [row.id]);
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 401) break;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          // Retrying validation/permission/not-found failures can never succeed
          // and used to block every later offline action indefinitely.
          await db.runAsync(`DELETE FROM pending_mutations WHERE id = ?`, [row.id]);
          continue;
        }
        if (row.retryCount >= 4) {
          await db.runAsync(`DELETE FROM pending_mutations WHERE id = ?`, [row.id]);
          continue;
        }
        await db.runAsync(
          `UPDATE pending_mutations SET retryCount = ? WHERE id = ?`,
          [row.retryCount + 1, row.id]
        );
        break; // FIFO — stop on first failure
      }
    }

    setPendingCount(await getPendingCount());
    setLastSyncedAt(Date.now());
  } finally {
    setSyncing(false);
  }
}

export async function clearOfflineUserData() {
  const db = await getDatabase();
  await db.execAsync("DELETE FROM pending_mutations; DELETE FROM local_jobs;");
  useSyncStore.getState().setPendingCount(0);
}

export async function cacheJob(job: {
  id: string;
  jobNumber: string;
  status: string;
  customerJson: string;
  itemsJson: string;
}) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO local_jobs (id, jobNumber, status, customerJson, itemsJson, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [job.id, job.jobNumber, job.status, job.customerJson, job.itemsJson, Date.now()]
  );
}
