import { Linking, Pressable, Text, View } from "react-native";
import { MapPin, Phone, Wrench } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { colors, space } from "@/constants/theme";
import {
  formatMoney,
  humanizeLabel,
  parseJobLine,
  parseJobRemarks,
  toPkrLabel,
} from "@/lib/jobLineFormat";
import { haptic } from "@/lib/haptics";
import type { Job } from "@/types";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text
        style={{
          color: colors.textDim,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>
        {value.trim()}
      </Text>
    </View>
  );
}

function LineList({ label, lines }: { label: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text
        style={{
          color: colors.textDim,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      {lines.map((p, i) => (
        <Text
          key={`${label}-${i}-${p.slice(0, 20)}`}
          style={{ color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 4 }}
        >
          · {p}
        </Text>
      ))}
    </View>
  );
}

function isJunkTitle(title: string) {
  return /^(abc|hhg|test|xxx|n\/?a|-)$/i.test(title.trim());
}

/** Customer + ERP fields from job creation — clean, technician-friendly. */
export function JobOverviewCard({ job }: { job: Job }) {
  const customer = job.customerName ?? job.customer?.name ?? "Customer";
  const phone = job.customerPhone ?? job.customer?.phone ?? null;
  const email = job.customer?.email ?? null;
  const address =
    job.address ?? job.customer?.addressText ?? job.customer?.address ?? null;
  const lat = job.lat ?? job.customer?.lat ?? null;
  const lng = job.lng ?? job.customer?.lng ?? null;
  const type = humanizeLabel(job.jobType) || null;
  const remarkRows = parseJobRemarks(job.remarks || job.notes || null);
  const careOf = job.careOfParty
    ? [job.careOfParty.companyName, job.careOfParty.personName].filter(Boolean).join(" · ")
    : null;
  const created = job.createdAt
    ? new Date(job.createdAt).toLocaleString()
    : null;
  const manualRef =
    job.manualJobNumber && !isJunkTitle(String(job.manualJobNumber))
      ? String(job.manualJobNumber)
      : null;

  const parsed = (job.items ?? []).map(parseJobLine).filter((l) => !isJunkTitle(l.title));
  const products = parsed.filter((l) => !l.isService).map((l) => l.title);
  const services = parsed.filter((l) => l.isService).map((l) => l.title);

  return (
    <Card style={{ marginBottom: 14, borderRadius: 18, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.surfaceElevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Wrench size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{customer}</Text>
          {type ? (
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700", marginTop: 2 }}>
              {type}
            </Text>
          ) : null}
        </View>
      </View>

      {phone ? (
        <Pressable
          onPress={() => {
            void haptic.press();
            void Linking.openURL(`tel:${phone}`);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Phone size={16} color={colors.textDim} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{phone}</Text>
        </Pressable>
      ) : null}

      {!!address && (
        <Pressable
          onPress={() => {
            void haptic.tap();
            const url =
              lat != null && lng != null
                ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            void Linking.openURL(url);
          }}
          style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}
        >
          <MapPin size={16} color={colors.textDim} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.textMuted, flex: 1, lineHeight: 20 }}>{address}</Text>
        </Pressable>
      )}

      <View style={{ gap: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
        <Field label="JOB TYPE" value={type} />

        {remarkRows.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Text
              style={{
                color: colors.textDim,
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.5,
              }}
            >
              JOB DETAILS
            </Text>
            {remarkRows.map((r) => (
              <View key={`${r.label}-${r.value}`} style={{ gap: 2 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700" }}>
                  {r.label}
                </Text>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>
                  {r.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Field label="CARE OF" value={careOf} />
        <Field label="REF / MANUAL #" value={manualRef} />
        {email ? <Field label="EMAIL" value={email} /> : null}
        {created ? <Field label="CREATED" value={created} /> : null}
        {job.discountAmount && job.discountAmount > 0 ? (
          <Field
            label="JOB DISCOUNT"
            value={`${formatMoney(job.discountAmount)}${
              job.discountReason ? ` · ${toPkrLabel(job.discountReason)}` : ""
            }`}
          />
        ) : null}
        <LineList label="PRODUCTS / PARTS" lines={products} />
        <LineList label="SERVICES" lines={services} />
      </View>
    </Card>
  );
}
