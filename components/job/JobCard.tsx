import { Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Phone, MapPin, ChevronRight, Clock3 } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { colors, radius, space, tapMin, type } from "@/constants/theme";
import { haptic } from "@/lib/haptics";
import { humanizeLabel, technicianJobStatus } from "@/lib/jobLineFormat";
import type { Job, JobStatus } from "@/types";

function nextActionHint(status: JobStatus): string {
  const view = technicianJobStatus(String(status));
  if (view.label === "Done") return "Done — tap to view";
  if (status === "Assigned") return "Accept to get started";
  if (status === "Accepted") return "Start when you arrive on site";
  if (status === "InProgress") return "Open to finish or request parts";
  if (status === "Paused") return "Resume when ready";
  if (status === "TechnicianReassigned") return "Reassigned — open successor";
  return "Tap to open";
}

export function JobCard({
  job,
  onAccept,
  accepting,
}: {
  job: Job;
  onAccept?: (jobId: string) => void;
  accepting?: boolean;
}) {
  const router = useRouter();
  const name = job.customerName ?? job.customer?.name ?? "Customer";
  const rawAddress = job.address ?? job.customer?.addressText ?? job.customer?.address;
  const address = rawAddress?.trim() || "No address available";
  const phone = job.customerPhone ?? job.customer?.phone;
  const hint = nextActionHint(job.status);
  const statusView = technicianJobStatus(String(job.status));
  const pendingParts = Array.isArray(job.inventoryRequests)
    ? job.inventoryRequests.filter((r) => (r.status || "pending").toLowerCase() === "pending")
        .length
    : 0;
  const scheduled = job.scheduledAt ?? job.createdAt;
  const scheduledDate = scheduled ? new Date(scheduled) : null;
  const scheduleLabel = scheduledDate && !Number.isNaN(scheduledDate.getTime())
    ? scheduledDate.toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Time not set";

  const openJob = () => {
    void haptic.tap();
    router.push(`/jobs/${job.id}`);
  };

  return (
    <Card style={{ marginBottom: space.lg, padding: space.lg }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: space.sm,
            alignItems: "flex-start",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 19 }}>
              {job.jobNumber}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 }}>
              <Clock3 size={14} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700" }}>
                {scheduleLabel}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            {statusView.showBadge ? (
              <StatusBadge label={statusView.label} friendly />
            ) : statusView.label === "Done" ? (
              <Text style={{ color: colors.success, fontWeight: "800", fontSize: 13 }}>Done</Text>
            ) : null}
            {(job.assignments?.length || 0) > 1 ? (
              <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: "700" }}>
                {job.assignments!.length} technician{job.assignments!.length === 1 ? "" : "s"}
              </Text>
            ) : null}
            {pendingParts > 0 ? (
              <Text style={{ color: colors.high, fontSize: 10, fontWeight: "700" }}>
                {pendingParts} part request{pendingParts === 1 ? "" : "s"}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.lg }} />

        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 17 }}>{name}</Text>
        {!!phone && (
          <Text style={{ color: colors.textMuted, marginTop: 5, fontSize: 13 }}>{phone}</Text>
        )}
        {job.jobType ? (
          <Text style={{ color: colors.primary, marginTop: space.sm, fontSize: 13, fontWeight: "800" }}>
            {humanizeLabel(job.jobType)}
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            gap: space.sm,
            marginTop: space.md,
            alignItems: "flex-start",
          }}
        >
          <MapPin size={15} color={colors.textDim} style={{ marginTop: 2 }} />
          <Text
            style={{ color: colors.textDim, fontSize: 13, flex: 1, lineHeight: 18 }}
            numberOfLines={2}
          >
            {address}
          </Text>
        </View>

        <Text
          style={{
            color: statusView.label === "Done" ? colors.success : colors.primary,
            marginTop: space.md,
            ...type.label,
          }}
        >
          {hint}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: space.md,
            paddingTop: space.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {!!phone && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Call ${name}`}
                onPress={() => {
                  void haptic.press();
                  Linking.openURL(`tel:${phone}`);
                }}
                style={chip}
              >
                <Phone size={15} color={colors.primary} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Call</Text>
              </Pressable>
            )}
            {(job.lat != null && job.lng != null) || Boolean(rawAddress?.trim()) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open map"
                onPress={() => {
                  void haptic.press();
                  const url =
                    job.lat != null && job.lng != null
                      ? `https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                  Linking.openURL(url);
                }}
                style={chip}
              >
                <MapPin size={15} color={colors.primary} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Map</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View details for ${job.jobNumber}`}
            onPress={openJob}
            style={[chip, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>Details</Text>
            <ChevronRight size={16} color="#fff" />
          </Pressable>
        </View>

      {job.status === "Assigned" && onAccept ? (
        <View style={{ marginTop: space.sm }}>
          <Button
            title="Accept job"
            size="md"
            loading={accepting}
            onPress={() => {
              void haptic.tap();
              onAccept(job.id);
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}

const chip = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 6,
  backgroundColor: colors.surfaceElevated,
  paddingHorizontal: space.md,
  minHeight: tapMin,
  borderRadius: radius.full,
};
