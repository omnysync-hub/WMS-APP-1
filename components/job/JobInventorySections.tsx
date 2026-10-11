import { Text, View } from "react-native";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors, radius, space } from "@/constants/theme";
import { inventoryReqStatus, parseJobLine, formatMoney } from "@/lib/jobLineFormat";
import type { Job, JobItem } from "@/types";

function SectionTitle({
  children,
  count,
}: {
  children: string;
  count?: number;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: space.sm,
      }}
    >
      <Text
        style={{
          color: colors.textDim,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.6,
        }}
      >
        {children}
      </Text>
      {typeof count === "number" ? (
        <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700" }}>{count}</Text>
      ) : null}
    </View>
  );
}

const InvLineCard = ({
  item,
  qty,
  statusLabel,
  tone,
  detail,
}: {
  item: string;
  qty?: number;
  statusLabel: string;
  tone: string;
  detail?: string;
}) => (
  <View style={row}>
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{item}</Text>
      <Text style={{ color: colors.textDim, fontSize: 12 }}>
        Qty {qty ?? "—"}
        {detail ? ` · ${detail}` : ""}
      </Text>
    </View>
    <StatusBadge label={statusLabel} tone={tone} />
  </View>
);

export function JobInventorySections({
  job,
  items,
}: {
  job: Job;
  items: JobItem[];
}) {
  const requests = job.inventoryRequests ?? [];
  const pending = requests.filter((r) => (r.status || "pending").toLowerCase() === "pending");
  const issuedReqs = requests.filter((r) => (r.status || "").toLowerCase() === "issued");
  const declined = requests.filter((r) => {
    const s = (r.status || "").toLowerCase();
    return s === "rejected" || s === "declined";
  });

  const parsed = items.map(parseJobLine);
  const issuedLines = parsed.filter((l) => l.issuedByStore);
  const discountPending = parsed.filter((l) => l.discountRequested && !l.discountApproved);
  const discountApproved = parsed.filter((l) => l.discountApproved);
  const services = parsed.filter((l) => l.isService);

  return (
    <View style={{ gap: space.lg }}>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>Store & discounts</Text>
      <Text style={{ color: colors.textDim, fontSize: 12, marginTop: -8, lineHeight: 18 }}>
        Parts requests, received parts, and discount updates for this job.
      </Text>

      <View>
        <SectionTitle count={pending.length}>PENDING PART REQUESTS</SectionTitle>
        {pending.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>No pending requests.</Text>
        ) : (
          pending.map((req) => {
            const st = inventoryReqStatus(req.status);
            return (
              <InvLineCard
                key={req.id || `${req.item}-p`}
                item={req.item || "Part"}
                qty={req.qtyRequested}
                statusLabel={st.label}
                tone="Pending"
                detail="waiting on storekeeper"
              />
            );
          })
        )}
      </View>

      <View>
        <SectionTitle count={issuedReqs.length + issuedLines.length}>RECEIVED PARTS</SectionTitle>
        {issuedReqs.length === 0 && issuedLines.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Nothing issued yet.</Text>
        ) : (
          <>
            {issuedReqs.map((req) => (
              <InvLineCard
                key={`ir-${req.id || req.item}`}
                item={req.item || "Part"}
                qty={req.qtyRequested}
                statusLabel="Issued"
                tone="Approved"
                detail="from warehouse"
              />
            ))}
            {issuedLines
              .filter(
                (l) =>
                  !issuedReqs.some((r) =>
                    (r.item || "").toLowerCase().includes(l.title.toLowerCase().slice(0, 8))
                  )
              )
              .map((l) => (
                <InvLineCard
                  key={`il-${l.id}`}
                  item={l.title}
                  qty={l.qtyPlanned}
                  statusLabel="On job"
                  tone="Approved"
                  detail={`${formatMoney(l.unitRate)} each`}
                />
              ))}
          </>
        )}
      </View>

      {declined.length > 0 ? (
        <View>
          <SectionTitle count={declined.length}>DECLINED REQUESTS</SectionTitle>
          {declined.map((req) => (
            <InvLineCard
              key={`d-${req.id || req.item}`}
              item={req.item || "Part"}
              qty={req.qtyRequested}
              statusLabel="Declined"
              tone="Rejected"
            />
          ))}
        </View>
      ) : null}

      {discountPending.length > 0 || discountApproved.length > 0 ? (
        <View>
          <SectionTitle count={discountPending.length + discountApproved.length}>
            DISCOUNT REQUESTS
          </SectionTitle>
          {discountPending.map((l) => (
            <View key={`dp-${l.id}`} style={row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{l.title}</Text>
                <Text style={{ color: colors.high, fontSize: 12, fontWeight: "600" }}>
                  Pending · {l.discountRequested}
                </Text>
              </View>
              <StatusBadge label="Pending" tone="Pending" />
            </View>
          ))}
          {discountApproved.map((l) => (
            <View key={`da-${l.id}`} style={row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{l.title}</Text>
                <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>
                  Approved · {l.discountApproved}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 12 }}>
                  Now {formatMoney(l.unitRate)} · line {formatMoney(l.lineTotal)}
                </Text>
              </View>
              <StatusBadge label="Approved" tone="Approved" />
            </View>
          ))}
        </View>
      ) : null}

      {services.length > 0 ? (
        <View>
          <SectionTitle count={services.length}>SERVICES ON JOB</SectionTitle>
          {services.map((l) => (
            <View key={`svc-${l.id}`} style={row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{l.title}</Text>
                <Text style={{ color: colors.textDim, fontSize: 12 }}>
                  {formatMoney(l.unitRate)} · {formatMoney(l.lineTotal)}
                </Text>
                {l.subtitle ? (
                  <Text style={{ color: colors.textDim, fontSize: 11 }}>Added by {l.subtitle}</Text>
                ) : null}
              </View>
              <StatusBadge label="Service" tone="normal" />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const row = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: space.sm,
  backgroundColor: colors.surfaceElevated,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  padding: space.md,
  marginBottom: space.sm,
};
