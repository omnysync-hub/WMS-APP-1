import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/** New channel id whenever sound/DND settings change (Android locks channel config). */
export const JOB_RING_CHANNEL = "job-ring-v1";
export const URGENT_CHANNEL = "urgent-dispatch-v2";
export const GENERAL_CHANNEL = "general-dispatch";

export const JOB_RING_SOUND = "job_ring.wav";
export const ALERT_SOUND = "alert_chime.wav";

const alarmAudio = {
  usage: Notifications.AndroidAudioUsage.ALARM,
  contentType: Notifications.AndroidAudioContentType.SONIFICATION,
  flags: {
    enforceAudibility: true,
    requestHardwareAudioVideoSynchronization: false,
  },
};

/** Long ring + vibrate; alarm stream so it can play on silent / locked / app closed. */
export async function ensureJobAssignmentChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(JOB_RING_CHANNEL, {
    name: "New job ringtone",
    description: "Long ring when a job is assigned — plays even if the app is closed.",
    importance: Notifications.AndroidImportance.MAX,
    sound: JOB_RING_SOUND,
    vibrationPattern: [0, 1000, 400, 1000, 400, 1000, 400, 1000, 400, 1400],
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: "#0D7A5F",
    audioAttributes: alarmAudio,
  });
}

export async function ensureUrgentChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(URGENT_CHANNEL, {
    name: "Parts & urgent alerts",
    description: "Parts ready, discounts, and other important job updates.",
    importance: Notifications.AndroidImportance.MAX,
    sound: ALERT_SOUND,
    vibrationPattern: [0, 500, 200, 500, 200, 800],
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: "#0D7A5F",
    audioAttributes: alarmAudio,
  });
}

export async function ensureGeneralChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(GENERAL_CHANNEL, {
    name: "Workman alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: "#0D7A5F",
  });
}

export async function alertJobAssignment(title: string, body: string, jobId?: string) {
  await ensureJobAssignmentChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: JOB_RING_SOUND,
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: "job_dispatch",
        vibrate: [0, 1000, 400, 1000, 400, 1000, 400, 1000, 400, 1400],
        ...(Platform.OS === "android" ? { channelId: JOB_RING_CHANNEL } : {}),
        data: { type: "JOB_DISPATCH", jobId },
      },
      trigger: null,
    });
  } catch {
    /* permissions */
  }
}

export async function alertUrgent(title: string, body: string, data?: Record<string, unknown>) {
  await ensureUrgentChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: ALERT_SOUND,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 500, 200, 500, 200, 800],
        ...(Platform.OS === "android" ? { channelId: URGENT_CHANNEL } : {}),
        data: data ?? {},
      },
      trigger: null,
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
