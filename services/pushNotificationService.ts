import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { api } from "@/services/api";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";
import { friendlyDispatchCopy } from "@/lib/friendlyDispatch";
import {
  ensureGeneralChannel,
  ensureJobAssignmentChannel,
  ensureUrgentChannel,
  looksLikeJobAssignment,
  startContinuousJobRing,
  stopContinuousJobRing,
  isJobAccepted,
  isRequestAccepted,
  RING_NOTIFICATION_ID,
  JOB_RING_CHANNEL,
  JOB_RING_SOUND,
} from "@/services/jobAssignmentAlert";
import { setPushStatus } from "@/services/jobDispatchWatcher";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureAndroidChannels() {
  if (Platform.OS !== "android") return;
  await ensureJobAssignmentChannel();
  await ensureUrgentChannel();
  await ensureGeneralChannel();
  // Legacy ids kept so old queued pushes still deliver something audible
  await Notifications.setNotificationChannelAsync("urgent-dispatch", {
    name: "Urgent job alerts (legacy)",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500],
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync("default", {
    name: "Workman Alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync("job-assignment", {
    name: "New job assigned (legacy)",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 900, 400, 900, 400, 900],
    enableVibrate: true,
    bypassDnd: true,
  });
}

export async function registerForPushNotifications(employeeId: string) {
  if (!Device.isDevice) {
    await setPushStatus({
      ok: false,
      detail: "Push needs a real phone (not emulator).",
      checkedAt: new Date().toISOString(),
    });
    return null;
  }

  await ensureAndroidChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: true,
      },
    });
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    await setPushStatus({
      ok: false,
      detail: "Notification permission is off — enable it in phone settings.",
      checkedAt: new Date().toISOString(),
    });
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  let tokenData: Notifications.ExpoPushToken;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync(
      projectId && projectId !== "replace-with-eas-project-id"
        ? { projectId }
        : undefined
    );
  } catch (e) {
    console.warn("[push] getExpoPushTokenAsync failed", e);
    await setPushStatus({
      ok: false,
      detail:
        "Cloud push not set up (missing Firebase google-services.json). App will still ring for new jobs while open or when live location is on.",
      checkedAt: new Date().toISOString(),
    });
    return null;
  }

  try {
    await api.registerPushToken({
      employeeId,
      token: tokenData.data,
      platform: Platform.OS,
      deviceModel: Device.modelName ?? "unknown",
      osVersion: `${Platform.OS} ${Device.osVersion ?? ""}`,
      appVersion: Constants.expoConfig?.version ?? "1.0.0",
    });
    await setPushStatus({
      ok: true,
      detail: "Cloud push connected — new jobs can ring with the app closed.",
      checkedAt: new Date().toISOString(),
    });
  } catch {
    await setPushStatus({
      ok: false,
      detail: "Got a push token but ERP did not save it — check server URL.",
      checkedAt: new Date().toISOString(),
    });
  }

  return tokenData.data;
}

function routeFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const type = String(data.type ?? "");
  const jobId = data.jobId ? String(data.jobId) : null;
  if (jobId && (type === "JOB_DISPATCH" || type === "INVENTORY_ISSUED" || type === "DISCOUNT_DECISION")) {
    router.push(`/jobs/${jobId}`);
    return;
  }
  router.push("/(tabs)/requests");
}

/** Foreground toasts + tap-to-open + cold launch handler. Call once from root layout. */
export function attachPushListeners() {
  // Check cold launch from notification tap when app was closed/killed
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      routeFromNotificationData(data);
    }
  });

  const received = Notifications.addNotificationReceivedListener((n) => {
    const data = n.request.content.data as Record<string, unknown> | undefined;

    // Ignore internal ring ticks!
    if (
      n.request.identifier === RING_NOTIFICATION_ID ||
      data?.isLocalRingTick === true
    ) {
      return;
    }

    const jobId = data?.jobId ? String(data.jobId) : undefined;
    const requestId = data?.requestId ? String(data.requestId) : undefined;

    // If job or request is ALREADY accepted, dismiss and do not ring!
    if (isJobAccepted(jobId) || isRequestAccepted(requestId)) {
      void stopContinuousJobRing();
      void Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {});
      return;
    }

    const rawTitle = n.request.content.title ?? "Workman";
    const rawBody = n.request.content.body ?? "";
    const { title } = friendlyDispatchCopy(rawTitle, rawBody);
    void haptic.warn();
    toast(title, "info");

    // If a job assignment notification is received, start continuous looping ringtone until accepted
    if (
      looksLikeJobAssignment({
        type: data?.type ? String(data.type) : undefined,
        title: rawTitle,
        body: rawBody,
      })
    ) {
      void startContinuousJobRing({
        jobId,
        requestId,
        title: friendlyDispatchCopy(rawTitle, rawBody).title,
        body: friendlyDispatchCopy(rawTitle, rawBody).body,
      });
    }
  });

  const response = Notifications.addNotificationResponseReceivedListener((r) => {
    const data = r.notification.request.content.data as Record<string, unknown>;
    routeFromNotificationData(data);
  });

  return () => {
    received.remove();
    response.remove();
  };
}

/** Android channel of a received notification (content in older SDKs, FCM trigger in SDK 57+). */
function receivedChannelId(n: Notifications.Notification): string | null {
  const content = n.request.content as { channelId?: string | null };
  if (content.channelId) return content.channelId;
  const trigger = n.request.trigger as
    | { channelId?: string | null; remoteMessage?: { notification?: { channelId?: string | null } | null } }
    | null;
  return trigger?.channelId ?? trigger?.remoteMessage?.notification?.channelId ?? null;
}
