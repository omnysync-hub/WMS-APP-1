import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { fetchRequests } from "@/services/requestsService";
import { fetchJobs, isJobVisibleToTechnician } from "@/services/jobsService";
import { friendlyDispatchCopy } from "@/lib/friendlyDispatch";
import {
  alertUrgent,
  ensureJobAssignmentChannel,
  looksLikeJobAssignment,
  startContinuousJobRing,
  stopContinuousJobRing,
  isJobRinging,
  markJobAsAccepted,
  isJobAccepted,
  isRequestAccepted,
} from "@/services/jobAssignmentAlert";
import type { DispatchRequest, Job } from "@/types";

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

/** Stop repeating ringtone and alarm vibration immediately */
export { stopContinuousJobRing, stopContinuousJobRing as stopJobAssignmentRinging };

/**
 * Poll ERP for new dispatch rows and keep looping ringtone until all assigned jobs are accepted.
 * Works without FCM while the app (or background location) is alive.
 */
export async function checkAndAlertNewDispatches(employeeId: string): Promise<number> {
  if (!employeeId) return 0;
  if (Platform.OS === "android") {
    await ensureJobAssignmentChannel();
  }

  // 1. Fetch both requests and assigned jobs
  let requests: DispatchRequest[] = [];
  try {
    const res = await fetchRequests(employeeId);
    requests = res.requests;
  } catch {
    /* offline fallback */
  }

  let jobs: Job[] = [];
  try {
    jobs = await fetchJobs(employeeId);
  } catch {
    /* offline fallback */
  }

  // Auto-record all non-assigned jobs as accepted
  for (const j of jobs) {
    if (j.status !== "Assigned") {
      void markJobAsAccepted(j.id);
    }
  }

  // Find unaccepted jobs assigned to this technician
  const unacceptedJobs = jobs.filter(
    (j) =>
      j.status === "Assigned" &&
      !isJobAccepted(j.id) &&
      isJobVisibleToTechnician(j, employeeId)
  );

  // Find unaccepted job dispatch requests
  const unacceptedRequests = requests.filter((r) => {
    if (r.actionStatus !== "pending") return false;
    if (isRequestAccepted(r.id)) return false;

    const linkedJobId = payloadJobId(r);
    if (linkedJobId) {
      if (isJobAccepted(linkedJobId)) return false;
      if (jobs.some((j) => j.id === linkedJobId && j.status !== "Assigned")) {
        void markJobAsAccepted(linkedJobId, r.id, employeeId);
        return false;
      }
    }

    return (
      looksLikeJobAssignment({
        type: r.type,
        title: r.title,
        body: r.body,
      }) ||
      r.type === "JOB_DISPATCH" ||
      r.type === "EMERGENCY_ALERT"
    );
  });

  const hasUnaccepted = unacceptedJobs.length > 0 || unacceptedRequests.length > 0;

  if (hasUnaccepted) {
    if (unacceptedJobs.length > 0) {
      const topJob = unacceptedJobs[0];
      const jobAddress = topJob.address ?? "";
      const jobLabel = topJob.jobType ?? "Service Call";
      const copy = friendlyDispatchCopy(
        `New Job Assigned: #${topJob.jobNumber ?? topJob.id.slice(0, 8)}`,
        `${jobLabel}${jobAddress ? ` • ${jobAddress}` : ""}`
      );
      await startContinuousJobRing({
        jobId: topJob.id,
        jobNumber: topJob.jobNumber,
        title: copy.title,
        body: copy.body,
        address: jobAddress,
        customerName: topJob.customerName ?? undefined,
      });
    } else {
      const topReq = unacceptedRequests[0];
      const copy = friendlyDispatchCopy(topReq.title, topReq.body);
      await startContinuousJobRing({
        requestId: topReq.id,
        jobId: payloadJobId(topReq),
        title: copy.title,
        body: copy.body,
      });
    }
  } else {
    // If everything is accepted, silence the continuous ringtone and dismiss all notifications!
    await stopContinuousJobRing();
  }

  // 2. Handle one-time alerts (parts issued, discounts approved/rejected)
  const alerted = await loadIds();
  const seeded = (await SecureStore.getItemAsync(KEY_SEEDED)) === "1";

  if (!seeded) {
    for (const r of requests) alerted.add(r.id);
    await saveIds(alerted);
    await SecureStore.setItemAsync(KEY_SEEDED, "1");
    return hasUnaccepted ? 1 : 0;
  }

  let rung = hasUnaccepted ? 1 : 0;
  const fresh = [...requests].filter((r) => !alerted.has(r.id)).reverse();

  for (const r of fresh) {
    const done =
      r.actionStatus === "accepted" ||
      r.actionStatus === "rejected" ||
      r.actionStatus === "acknowledged";

    if (done) {
      alerted.add(r.id);
      continue;
    }

    const copy = friendlyDispatchCopy(r.title, r.body);

    if (
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
            if (
              chunk.includes("JOB_ASSIGNED") ||
              chunk.includes("JOB_UPDATED") ||
              chunk.includes("NEW_APP_REQUEST") ||
              chunk.includes("REQUEST_RESPONDED")
            ) {
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
    void stopContinuousJobRing();
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
