import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { fetchRequests } from "@/services/requestsService";
import { friendlyDispatchCopy } from "@/lib/friendlyDispatch";
import {
  alertJobAssignment,
  alertUrgent,
  ensureJobAssignmentChannel,
  looksLikeJobAssignment,
} from "@/services/jobAssignmentAlert";
import type { DispatchRequest } from "@/types";

const KEY_SEEDED = "wms_dispatch_watcher_seeded_v1";
const KEY_ALERTED = "wms_dispatch_alerted_ids_v1";
const KEY_PUSH_STATUS = "wms_push_status_v1";

export type PushStatus = {
  ok: boolean;
  detail: string;
  checkedAt: string;
};

async function loadIds(): Promise<Set<string>> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_ALERTED);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function saveIds(ids: Set<string>) {
  const list = [...ids].slice(-100);
  await SecureStore.setItemAsync(KEY_ALERTED, JSON.stringify(list));
}

export async function setPushStatus(status: PushStatus) {
  try {
    await SecureStore.setItemAsync(KEY_PUSH_STATUS, JSON.stringify(status));
  } catch {
    /* ignore */
  }
}

export async function getPushStatus(): Promise<PushStatus | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_PUSH_STATUS);
    if (!raw) return null;
    return JSON.parse(raw) as PushStatus;
  } catch {
    return null;
  }
}

function payloadJobId(r: DispatchRequest): string | undefined {
  try {
    if (!r.payloadJson) return undefined;
    const p = JSON.parse(r.payloadJson) as { jobId?: string };
    return p.jobId ? String(p.jobId) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Poll ERP for new dispatch rows and fire local long ring.
 * Works without FCM while the app (or background location) is alive.
 * First run seeds existing rows so we don't re-ring old jobs.
 */
export async function checkAndAlertNewDispatches(employeeId: string): Promise<number> {
  if (!employeeId) return 0;
  if (Platform.OS === "android") {
    await ensureJobAssignmentChannel();
  }

  const { requests } = await fetchRequests(employeeId);
  const alerted = await loadIds();
  const seeded = (await SecureStore.getItemAsync(KEY_SEEDED)) === "1";

  if (!seeded) {
    for (const r of requests) alerted.add(r.id);
    await saveIds(alerted);
    await SecureStore.setItemAsync(KEY_SEEDED, "1");
    return 0;
  }

  let rung = 0;
  // Newest first from API — alert oldest-unseen first so order feels natural
  const fresh = [...requests]
    .filter((r) => !alerted.has(r.id))
    .reverse();

  for (const r of fresh) {
    const done =
      r.actionStatus === "accepted" ||
      r.actionStatus === "rejected" ||
      r.actionStatus === "acknowledged";

    if (done) {
      alerted.add(r.id);
      continue;
    }

    const jobLike = looksLikeJobAssignment({
      type: r.type,
      title: r.title,
      body: r.body,
    });
    const copy = friendlyDispatchCopy(r.title, r.body);

    if (jobLike || r.type === "JOB_DISPATCH" || r.type === "EMERGENCY_ALERT") {
      await alertJobAssignment(copy.title, copy.body, payloadJobId(r));
      rung += 1;
    } else if (
      r.type === "INVENTORY_ISSUED" ||
      r.type === "DISCOUNT_DECISION" ||
      r.priority === "high" ||
      r.priority === "urgent"
    ) {
      await alertUrgent(copy.title, copy.body, {
        type: r.type,
        jobId: payloadJobId(r),
        requestId: r.id,
      });
      rung += 1;
    }

    alerted.add(r.id);
  }

  await saveIds(alerted);
  return rung;
}

/** Start SSE + fast poll. Call once from app root while technician is logged in. */
export function startJobDispatchWatcher(
  employeeId: string,
  onInvalidate?: () => void
): () => void {
  let cancelled = false;
  let abort: AbortController | null = null;

  const tick = async () => {
    try {
      await checkAndAlertNewDispatches(employeeId);
      onInvalidate?.();
    } catch {
      /* offline */
    }
  };

  // Immediate + every 8s (ringtone path without FCM)
  void tick();
  const poll = setInterval(() => {
    if (AppState.currentState === "active" || AppState.currentState === "background") {
      void tick();
    }
  }, 8_000);

  const appSub = AppState.addEventListener("change", (s) => {
    if (s === "active") void tick();
  });

  async function connectSse() {
    while (!cancelled) {
      abort?.abort();
      abort = new AbortController();
      try {
        const { ERP_BASE_URL } = await import("@/services/api");
        const token = await SecureStore.getItemAsync("wms_auth_token");
        if (!token) {
          await sleep(5000);
          continue;
        }
        const res = await fetch(
          `${ERP_BASE_URL}/api/mobile/stream?employeeId=${encodeURIComponent(employeeId)}`,
          {
            headers: {
              Accept: "text/event-stream",
              Authorization: `Bearer ${token}`,
            },
            signal: abort.signal,
          }
        );
        if (!res.ok || !res.body || cancelled) {
          await sleep(5000);
          continue;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            if (chunk.includes("NEW_APP_REQUEST") || chunk.includes("REQUEST_RESPONDED")) {
              await tick();
            }
          }
        }
      } catch {
        /* reconnect */
      }
      if (!cancelled) await sleep(4000);
    }
  }

  void connectSse();

  return () => {
    cancelled = true;
    abort?.abort();
    clearInterval(poll);
    appSub.remove();
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
