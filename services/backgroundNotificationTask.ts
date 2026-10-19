/**
 * Background notification task — runs when push notifications arrive while the app
 * is backgrounded or killed/terminated.
 * Defined via expo-task-manager and registered with expo-notifications.
 */
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { Platform, Vibration } from "react-native";
import {
  isJobAccepted,
  isRequestAccepted,
  looksLikeJobAssignment,
  startContinuousJobRing,
  stopContinuousJobRing,
  ensureJobAssignmentChannel,
  ensureUrgentChannel,
} from "@/services/jobAssignmentAlert";

export const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND-NOTIFICATION-TASK";

TaskManager.defineTask(
  BACKGROUND_NOTIFICATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.warn("[bgNotificationTask] Error:", error);
      return;
    }

    try {
      if (Platform.OS === "android") {
        await ensureJobAssignmentChannel();
        await ensureUrgentChannel();
      }

      const payload = data as Record<string, unknown> | undefined;
      const notification = (payload?.notification ?? payload) as Record<string, unknown> | undefined;
      const contentData = (notification?.data ?? payload?.data ?? {}) as Record<string, unknown>;

      const jobId = contentData.jobId ? String(contentData.jobId) : undefined;
      const requestId = contentData.requestId ? String(contentData.requestId) : undefined;

      // If already accepted, dismiss and cancel ringing immediately
      if (isJobAccepted(jobId) || isRequestAccepted(requestId)) {
        void stopContinuousJobRing();
        return;
      }

      const rawTitle = String(notification?.title ?? "Workman Dispatch");
      const rawBody = String(notification?.body ?? "");

      if (
        looksLikeJobAssignment({
          type: contentData.type ? String(contentData.type) : undefined,
          title: rawTitle,
          body: rawBody,
        })
      ) {
        // High intensity hardware vibration pattern
        Vibration.vibrate([0, 1000, 400, 1000, 400, 1000], false);
        void startContinuousJobRing({
          jobId,
          requestId,
          title: rawTitle,
          body: rawBody,
        });
      }
    } catch (e) {
      console.warn("[bgNotificationTask] handler error:", e);
    }
  }
);

// Register the task once at module evaluation
void Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((err) => {
  // Graceful ignore if running in unsupported environment
  console.log("[bgNotificationTask] registerTaskAsync:", err?.message ?? "ok");
});
