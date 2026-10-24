import { Platform, Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import { setAudioModeAsync, createAudioPlayer, type AudioPlayer } from "expo-audio";
import {
  useIncomingJobStore,
  type IncomingJobAlert,
} from "@/store/incomingJobStore";
import { startNativeAlarm, stopNativeAlarm } from "@/services/nativeAlarm";

/** Android channel identifier for assigned job ringtones (v5: custom ringtone.mp3 + native alarm service + bypassDnd) */
export const JOB_RING_CHANNEL = "job-ring-v5";
export const URGENT_CHANNEL = "urgent-dispatch-v3";
export const GENERAL_CHANNEL = "general-dispatch";

export const JOB_RING_SOUND = "ringtone.mp3";
export const ALERT_SOUND = "alert_chime.wav";
export const RING_NOTIFICATION_ID = "job-incoming-assignment-ring";

const alarmAudio = {
  usage: Notifications.AndroidAudioUsage.ALARM,
  contentType: Notifications.AndroidAudioContentType.SONIFICATION,
  flags: {
    enforceAudibility: true,
    requestHardwareAudioVideoSynchronization: false,
  },
};

// Vibration rhythm: delay 0ms, buzz 1000ms, pause 400ms, buzz 1000ms, pause 400ms...
const VIBRATION_PATTERN = [0, 1000, 400, 1000, 400, 1000, 400, 1000];

let ringInterval: ReturnType<typeof setInterval> | null = null;
let currentRingingJob: IncomingJobAlert | null = null;
let activeAudioPlayer: AudioPlayer | null = null;

// Registry of accepted jobs and requests so accepted alerts never repeat
const acceptedJobIds = new Set<string>();
const acceptedRequestIds = new Set<string>();

export function isJobAccepted(jobId?: string | null): boolean {
  if (!jobId) return false;
  return acceptedJobIds.has(String(jobId));
}

export function isRequestAccepted(requestId?: string | null): boolean {
  if (!requestId) return false;
  return acceptedRequestIds.has(String(requestId));
}

/**
 * Marks a job/request as accepted.
 * Immediately stops any ringing, registers in accepted cache, updates local DB,
 * and responds to pending dispatch requests in the background.
 */
export async function markJobAsAccepted(
  jobId?: string | null,
  requestId?: string | null,
  employeeId?: string | null
) {
  if (jobId) acceptedJobIds.add(String(jobId));
  if (requestId) acceptedRequestIds.add(String(requestId));

  // 1. Immediately silence and stop ringing
  await stopContinuousJobRing();

  // 2. Immediately update local SQLite cache so subsequent local reads show status = 'Accepted'
  if (jobId) {
    try {
      const { getDatabase } = await import("@/db/database");
      const db = await getDatabase();
      await db.runAsync(
        "UPDATE local_jobs SET status = 'Accepted', updatedAt = ? WHERE id = ?",
        [Date.now(), String(jobId)]
      );
    } catch {
      /* ignore offline DB errors */
    }
  }

  // 3. Auto-respond to any pending dispatch requests tied to this jobId so ERP doesn't keep it pending
  if (employeeId && jobId) {
    try {
      const { fetchRequests, respondToRequest } = await import("@/services/requestsService");
      const res = await fetchRequests(employeeId);
      const pendingReqs = (res.requests || []).filter((r) => {
        if (r.actionStatus !== "pending") return false;
        try {
          if (!r.payloadJson) return false;
          const p = JSON.parse(r.payloadJson) as { jobId?: string };
          return String(p.jobId) === String(jobId);
        } catch {
          return false;
        }
      });
      for (const req of pendingReqs) {
        acceptedRequestIds.add(req.id);
        void respondToRequest(req.id, {
          employeeId,
          actionStatus: "accepted",
          notes: "Auto-accepted with job",
        }).catch(() => {});
      }
    } catch {
      /* ignore background request sync error */
    }
  }
}

export function isJobRinging(): boolean {
  return ringInterval !== null;
}

export function getCurrentRingingJob(): IncomingJobAlert | null {
  return currentRingingJob;
}

/**
 * Configures the global audio session to ALWAYS play audio even when the
 * device is in silent mode, mute switch is ON, or on vibrate.
 */
export async function configureAudioForCriticalAlerts() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
  } catch (err) {
    console.warn("[jobRing] setAudioModeAsync error:", err);
  }
}

async function playJobRingAudio() {
  // 1. Native Android alarm service — plays at MAX ALARM stream volume,
  //    bypasses silent/vibrate/DND, survives app kill and phone lock.
  startNativeAlarm();

  // 2. JS-layer expo-audio as backup (covers foreground + iOS)
  await configureAudioForCriticalAlerts();
  try {
    if (!activeAudioPlayer) {
      activeAudioPlayer = createAudioPlayer(require("@/assets/sounds/ringtone.mp3"), {
        keepAudioSessionActive: true,
      });
      activeAudioPlayer.loop = true;
      activeAudioPlayer.volume = 1.0;
      activeAudioPlayer.play();
    } else {
      activeAudioPlayer.loop = true;
      activeAudioPlayer.volume = 1.0;
      if (!activeAudioPlayer.playing) {
        activeAudioPlayer.play();
      }
    }
  } catch (err) {
    console.warn("[jobRing] expo-audio play error:", err);
  }
}

function stopJobRingAudio() {
  // Stop native Android alarm service first (ALARM stream)
  stopNativeAlarm();

  if (activeAudioPlayer) {
    try {
      activeAudioPlayer.pause();
      activeAudioPlayer.remove();
    } catch (err) {
      console.warn("[jobRing] expo-audio stop error:", err);
    }
    activeAudioPlayer = null;
  }
}

/** Long ring + vibrate; alarm stream so it can play on silent / locked / app closed. */
export async function ensureJobAssignmentChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(JOB_RING_CHANNEL, {
      name: "New job assignment (Critical)",
      description: "Continuous ring when a job is assigned until accepted.",
      importance: Notifications.AndroidImportance.MAX,
      sound: JOB_RING_SOUND,
      vibrationPattern: VIBRATION_PATTERN,
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      lightColor: "#0D7A5F",
      audioAttributes: alarmAudio,
    });
  } catch (err) {
    console.warn("[jobRing] setNotificationChannelAsync error", err);
  }
}

export async function ensureUrgentChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(URGENT_CHANNEL, {
      name: "Parts & urgent alerts",
      description: "Parts ready, discounts, and other important job updates.",
      importance: Notifications.AndroidImportance.MAX,
      sound: ALERT_SOUND,
      vibrationPattern: [0, 500, 200, 500, 200, 800],
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      lightColor: "#0D7A5F",
      audioAttributes: alarmAudio,
    });
  } catch (err) {
    console.warn("[urgentChannel] error", err);
  }
}

export async function ensureGeneralChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(GENERAL_CHANNEL, {
      name: "Workman alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      lightColor: "#0D7A5F",
    });
  } catch (err) {
    console.warn("[generalChannel] error", err);
  }
}

async function fireRingTick(job: IncomingJobAlert) {
  if (isJobAccepted(job.jobId) || isRequestAccepted(job.requestId)) {
    void stopContinuousJobRing();
    return;
  }

  try {
    // Continuous hardware vibration (true = repeats until cancelled on Android)
    Vibration.vibrate(VIBRATION_PATTERN, true);

    await Notifications.scheduleNotificationAsync({
      identifier: RING_NOTIFICATION_ID,
      content: {
        title: job.title || "🚨 NEW JOB ASSIGNED",
        body: job.body || "Ringing until accepted — tap to open and accept.",
        sound: JOB_RING_SOUND,
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: "job_dispatch",
        vibrate: VIBRATION_PATTERN,
        sticky: true,
        autoDismiss: false,
        data: {
          type: "JOB_DISPATCH",
          jobId: job.jobId,
          requestId: job.requestId,
          isLocalRingTick: true,
        },
      },
      trigger:
        Platform.OS === "android"
          ? { channelId: JOB_RING_CHANNEL }
          : null,
    });
  } catch (err) {
    console.warn("[jobRing] fireRingTick error", err);
  }
}

/**
 * Starts continuous beeping and ringtone playback.
 * Guaranteed to play audio via expo-audio (playsInSilentMode: true) even on mute/vibrate.
 * Keeps repeating every 5 seconds until accepted.
 */
export async function startContinuousJobRing(details: IncomingJobAlert) {
  // If already accepted, DO NOT RING!
  if (isJobAccepted(details.jobId) || isRequestAccepted(details.requestId)) {
    return;
  }

  currentRingingJob = details;
  useIncomingJobStore.getState().setRinging(true, details);

  await ensureJobAssignmentChannel();

  // 1. Play native audio through expo-audio with silent mode bypass
  void playJobRingAudio();

  // 2. Fire hardware vibration + full screen / sticky notification
  void fireRingTick(details);

  if (!ringInterval) {
    ringInterval = setInterval(() => {
      if (currentRingingJob) {
        if (
          isJobAccepted(currentRingingJob.jobId) ||
          isRequestAccepted(currentRingingJob.requestId)
        ) {
          void stopContinuousJobRing();
          return;
        }

        // Re-ensure native audio is playing at full volume
        void playJobRingAudio();

        void fireRingTick(currentRingingJob);
      }
    }, 5000);
  }
}

/**
 * Immediately silences and stops the repeating ringtone, native audio & vibration.
 * Clears and cancels all active notifications.
 */
export async function stopContinuousJobRing() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  currentRingingJob = null;
  useIncomingJobStore.getState().setRinging(false, null);

  // 1. Stop native audio playback immediately
  stopJobRingAudio();

  // 2. Stop vibration immediately
  try {
    Vibration.cancel();
  } catch {
    /* ignore vibration cancel errors */
  }

  // 3. Cancel scheduled notifications and dismiss active alerts immediately
  try {
    await Notifications.cancelScheduledNotificationAsync(RING_NOTIFICATION_ID);
  } catch {}
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
  try {
    await Notifications.dismissNotificationAsync(RING_NOTIFICATION_ID);
  } catch {}
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {}
}

/** Convenience single-shot or initial ring invocation */
export async function alertJobAssignment(
  title: string,
  body: string,
  jobId?: string
) {
  if (isJobAccepted(jobId)) return;
  await startContinuousJobRing({
    jobId,
    title,
    body,
  });
}

export async function alertUrgent(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await ensureUrgentChannel();
  await configureAudioForCriticalAlerts();

  try {
    const chime = createAudioPlayer(require("@/assets/sounds/alert_chime.wav"));
    chime.volume = 1.0;
    chime.play();
    setTimeout(() => {
      try {
        chime.remove();
      } catch {}
    }, 4000);
  } catch {
    /* fallback to notification sound */
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: ALERT_SOUND,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 500, 200, 500, 200, 800],
        data: data ?? {},
      },
      trigger:
        Platform.OS === "android"
          ? { channelId: URGENT_CHANNEL }
          : null,
    });
  } catch {
    /* permissions */
  }
}

export function looksLikeJobAssignment(payload: {
  type?: string;
  title?: string;
  body?: string;
}): boolean {
  const type = String(payload.type ?? "").toUpperCase();
  if (type === "JOB_DISPATCH") return true;
  const t = `${payload.title ?? ""} ${payload.body ?? ""}`.toLowerCase();
  return (
    t.includes("new job") ||
    t.includes("job assigned") ||
    t.includes("job dispatch") ||
    t.includes("assigned to you")
  );
}
