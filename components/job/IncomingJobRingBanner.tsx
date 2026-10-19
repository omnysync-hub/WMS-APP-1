import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, VolumeX, ArrowRight } from "lucide-react-native";
import { useIncomingJobStore } from "@/store/incomingJobStore";
import { stopContinuousJobRing, markJobAsAccepted } from "@/services/jobAssignmentAlert";
import { transitionJob } from "@/services/jobsService";
import { respondToRequest } from "@/services/requestsService";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";
import { colors, radius, space } from "@/constants/theme";

export function IncomingJobRingBanner() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const isRinging = useIncomingJobStore((s) => s.isRinging);
  const incoming = useIncomingJobStore((s) => s.incoming);
  const [accepting, setAccepting] = useState(false);

  if (!isRinging || !incoming) {
    return null;
  }

  async function handleAccept() {
    if (accepting) return;
    setAccepting(true);
    void haptic.tap();

    const jobId = incoming?.jobId;
    const requestId = incoming?.requestId;

    // Immediately stop ringtone, native audio & vibration, and record acceptance
    await markJobAsAccepted(jobId, requestId, employee?.id);

    try {
      if (jobId && employee?.id) {
        await transitionJob(jobId, {
          action: "accept",
          actor: employee.name ?? "Technician",
          technicianId: employee.id,
        });
      }
      if (requestId && employee?.id) {
        await respondToRequest(requestId, {
          employeeId: employee.id,
          actionStatus: "accepted",
          notes: "En route",
          etaMinutes: 15,
        });
      }

      await stopContinuousJobRing();
      void haptic.success();
      toast("Job accepted! Alarm silenced.", "success");

      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["requests"] });

      if (jobId) {
        router.push(`/jobs/${jobId}`);
      }
    } catch (err: unknown) {
      void haptic.error();
      const msg = err instanceof Error ? err.message : "Could not accept job";
      toast(msg, "error");
    } finally {
      setAccepting(false);
    }
  }

  async function handleSilence() {
    void haptic.tap();
    await stopContinuousJobRing();
    toast("Alarm silenced.", "info");
  }

  function handleOpenDetails() {
    void haptic.tap();
    if (incoming?.jobId) {
      router.push(`/jobs/${incoming.jobId}`);
    } else {
      router.push("/(tabs)/requests");
    }
  }

  return (
    <View
      style={[
        styles.overlay,
        {
          top: Math.max(insets.top, 12) + 6,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <View style={styles.iconCircle}>
              <BellRing size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertHeader}>NEW JOB ASSIGNED</Text>
              <Text style={styles.alertSubheader}>
                Beeping & ringing until accepted
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Silence alarm"
            onPress={handleSilence}
            hitSlop={8}
            style={styles.silenceBtn}
          >
            <VolumeX size={16} color={colors.textDim} />
            <Text style={styles.silenceText}>Mute</Text>
          </Pressable>
        </View>

        <View style={styles.bodyWrap}>
          <Text style={styles.titleText} numberOfLines={1}>
            {incoming.title || "Dispatch Assignment"}
          </Text>
          {incoming.body ? (
            <Text style={styles.bodyText} numberOfLines={2}>
              {incoming.body}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Accept job now"
            onPress={handleAccept}
            disabled={accepting}
            style={[styles.acceptBtn, accepting && { opacity: 0.7 }]}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Check size={18} color="#fff" strokeWidth={3} />
                <Text style={styles.acceptBtnText}>ACCEPT JOB</Text>
              </>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View job details"
            onPress={handleOpenDetails}
            style={styles.detailsBtn}
          >
            <Text style={styles.detailsBtnText}>View</Text>
            <ArrowRight size={14} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 99999,
  },
  card: {
    backgroundColor: "#161D26",
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1.5,
    borderColor: "#E67E22",
    shadowColor: "#E67E22",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E67E22",
    alignItems: "center",
    justifyContent: "center",
  },
  alertHeader: {
    fontSize: 13,
    fontWeight: "900",
    color: "#F39C12",
    letterSpacing: 0.6,
  },
  alertSubheader: {
    fontSize: 11,
    color: colors.textDim,
    fontWeight: "600",
  },
  silenceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  silenceText: {
    fontSize: 11,
    color: colors.textDim,
    fontWeight: "700",
  },
  bodyWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: space.md,
  },
  titleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },
  bodyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    minHeight: 44,
  },
  acceptBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
});
