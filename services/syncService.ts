import { getDatabase } from "@/db/database";
import { apiClient } from "@/services/api";
import { useSyncStore } from "@/store/syncStore";

function uuid() {
  return `mut_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueMutation(input: {
  endpoint: string;
  method: string;
  payload: unknown;
}) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO pending_mutations (id, endpoint, method, payloadJson, createdAt, retryCount)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [uuid(), input.endpoint, input.method, JSON.stringify(input.payload), Date.now()]
  );
  const count = await getPendingCount();
  useSyncStore.getState().setPendingCount(count);
}

export async function getPendingCount() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM pending_mutations`
  );
  return row?.c ?? 0;
}

export async function processSyncQueue() {
  const { isSyncing, setSyncing, setPendingCount, setLastSyncedAt } =
    useSyncStore.getState();
  if (isSyncing) return;

  setSyncing(true);
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      endpoint: string;
      method: string;
      payloadJson: string;
      retryCount: number;
    }>(`SELECT * FROM pending_mutations ORDER BY createdAt ASC LIMIT 20`);

    for (const row of rows) {
      try {
        let payload = JSON.parse(row.payloadJson) as Record<string, unknown>;

        // ponytail: backend rejects attendance >2 min old — offline queue can't meet that
        // window, so refresh timestamp on flush and keep original capture time in notes.
        if (row.endpoint.includes("/api/attendance") && typeof payload.timestamp === "string") {
          const capturedAt = payload.timestamp;
          payload = {
            ...payload,
            timestamp: new Date().toISOString(),
            notes: `${payload.notes ? String(payload.notes) + " " : ""}[offline sync; capturedAt=${capturedAt}]`.trim(),
          };
        }

        await apiClient.request({
          url: row.endpoint,
          method: row.method.toLowerCase(),
          data: payload,
          validateStatus: (s) => s >= 200 && s < 300,
        });
        await db.runAsync(`DELETE FROM pending_mutations WHERE id = ?`, [row.id]);
      } catch {
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
