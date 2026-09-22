import { Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Phone, MapPin } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors } from "@/constants/theme";
import type { Job } from "@/types";

export function JobCard({ job }: { job: Job }) {
  const router = useRouter();
  const name = job.customerName ?? job.customer?.name ?? "Customer";
  const address = job.address ?? job.customer?.address ?? "No address";
  const phone = job.customerPhone ?? job.customer?.phone;

  return (
    <Pressable onPress={() => router.push(`/jobs/${job.id}`)}>
      <Card style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
            {job.jobNumber}
          </Text>
          <StatusBadge label={job.status} />
        </View>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>{name}</Text>
        <Text style={{ color: colors.textDim, marginTop: 4, fontSize: 12 }} numberOfLines={2}>
          {address}
        </Text>
        {!!job.scheduledAt && (
          <Text style={{ color: colors.primary, marginTop: 8, fontSize: 12, fontWeight: "600" }}>
            {new Date(job.scheduledAt).toLocaleString()}
          </Text>
        )}
        <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
          {!!phone && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${phone}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Phone size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Call</Text>
            </Pressable>
          )}
          {(job.lat != null && job.lng != null) || address ? (
            <Pressable
              onPress={() => {
                const url =
                  job.lat != null && job.lng != null
                    ? `https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                Linking.openURL(url);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <MapPin size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Navigate</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
