import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Package, Percent, Wrench } from "lucide-react-native";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { colors, radius, space, tapMin } from "@/constants/theme";
import { haptic } from "@/lib/haptics";
import {
  formatMoney,
  humanizeLabel,
  inventoryReqStatus,
  parseJobLine,
  toPkrLabel,
} from "@/lib/jobLineFormat";
import type { Job, JobItem } from "@/types";

export type JobSectionId =
  | "details"
  | "stock_req"
  | "received"
  | "discount_req"
  | "discount_ok"
  | "services";

type Tab = { id: JobSectionId; label: string; count?: number };

type InvReq = {
  id?: string;
  item?: string;
  qtyRequested?: number;
  status?: string;
};

function asInvReqs(job: Job): InvReq[] {
  const raw = job.inventoryRequests;
  return Array.isArray(raw) ? (raw as InvReq[]) : [];
}

function lineTitle(value: unknown, fallback = "Part") {
  if (typeof value === "string" && value.trim()) return humanizeLabel(value);
  if (value != null && typeof value !== "object") return humanizeLabel(String(value));
  return fallback;
}

function qtyLabel(qty: unknown) {
  if (qty == null || qty === "") return "—";
  return String(qty);
}

/** Module-level const — Hermes crashed on function-decl `ReqCard` in release. */
const StockLineCard = ({
  title,
  detail,
  badge,
  tone,
}: {
  title: string;
  detail?: string;
  badge?: string;
  tone?: string;
}) => (
  <View style={row}>
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{title}</Text>
      {detail ? (
        <Text style={{ color: colors.textDim, fontSize: 12, lineHeight: 17 }}>{detail}</Text>
      ) : null}
    </View>
    {badge ? <StatusBadge label={badge} tone={tone || "normal"} /> : null}
  </View>
);

export function useJobSectionData(job: Job, items: JobItem[]) {
  return useMemo(() => {
    const requests = asInvReqs(job);
    const pending = requests.filter((r) => (r.status || "pending").toLowerCase() === "pending");
    const issuedReqs = requests.filter((r) => (r.status || "").toLowerCase() === "issued");
    const declined = requests.filter((r) => {
      const s = (r.status || "").toLowerCase();
      return s === "rejected" || s === "declined";
    });
    const safeItems = Array.isArray(items) ? items : [];
    const parsed = safeItems.map(parseJobLine);
    return {
      pending,
      issuedReqs,
      declined,
      issuedLines: parsed.filter((l) => l.issuedByStore),
      discountPending: parsed.filter((l) => l.discountRequested && !l.discountApproved),
      discountApproved: parsed.filter((l) => !!l.discountApproved),
      services: parsed.filter((l) => l.isService),
    };
  }, [job, items]);
}

export function JobSectionTabs({
  active,
  onChange,
  tabs,
}: {
  active: JobSectionId;
  onChange: (id: JobSectionId) => void;
  tabs: Tab[];
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
        gap: 8,
        paddingVertical: 4,
        alignItems: "center",
      }}
      style={{ flexGrow: 0, maxHeight: 56 }}
    >
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              void haptic.select();
              onChange(t.id);
            }}
            style={{
              paddingHorizontal: 14,
              minHeight: tapMin - 4,
              justifyContent: "center",
              borderRadius: 999,
              backgroundColor: on ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: on ? colors.primary : colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>{t.label}</Text>
            {typeof t.count === "number" && t.count > 0 ? (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  paddingHorizontal: 6,
                  backgroundColor: on ? "rgba(255,255,255,0.22)" : colors.surfaceElevated,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>{t.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function JobSectionPanel({
  section,
  job,
  items,
}: {
  section: Exclude<JobSectionId, "details">;
  job: Job;
  items: JobItem[];
}) {
  const data = useJobSectionData(job, items);
  const router = useRouter();

  if (section === "stock_req") {
    return (
      <View style={{ gap: space.sm }}>
        <Text style={heading}>Stock requests</Text>
        <Text style={sub}>Parts you asked the store for — pending or declined.</Text>
        {data.pending.length === 0 && data.declined.length === 0 ? (
          <Button
            title="Request inventory"
            size="lg"
            icon={<Package size={20} color="#fff" />}
            onPress={() =>
              router.push({
                pathname: "/jobs/inventory-request",
                params: { jobId: job.id, jobNumber: job.jobNumber },
              })
            }
          />
        ) : (
          <>
            {data.pending.map((req, i) => {
              const st = inventoryReqStatus(req.status);
              return (
                <StockLineCard
                  key={req.id || `pending-${i}-${lineTitle(req.item)}`}
                  title={lineTitle(req.item)}
                  detail={`Qty ${qtyLabel(req.qtyRequested)} · waiting on store`}
                  badge={st.label}
                  tone="Pending"
                />
              );
            })}
            {data.declined.map((req, i) => (
              <StockLineCard
                key={req.id || `declined-${i}-${lineTitle(req.item)}`}
                title={lineTitle(req.item)}
                detail={`Qty ${qtyLabel(req.qtyRequested)}`}
                badge="Declined"
                tone="Rejected"
              />
            ))}
            <Button
              title="Request more parts"
              variant="secondary"
              size="lg"
              icon={<Package size={18} color={colors.text} />}
              onPress={() =>
                router.push({
                  pathname: "/jobs/inventory-request",
                  params: { jobId: job.id, jobNumber: job.jobNumber },
                })
              }
            />
          </>
        )}
      </View>
    );
  }

  if (section === "received") {
    const extras = data.issuedLines.filter((l) => {
      const needle = (l.title || "").toLowerCase().slice(0, 8);
      if (!needle) return true;
      return !data.issuedReqs.some((r) => lineTitle(r.item).toLowerCase().includes(needle));
    });
    return (
      <View style={{ gap: space.sm }}>
        <Text style={heading}>Received stock</Text>
        <Text style={sub}>Inventory issued to this job from the warehouse.</Text>
        {data.issuedReqs.length === 0 && extras.length === 0 ? (
          <Button
            title="Request inventory"
            size="lg"
            icon={<Package size={20} color="#fff" />}
            onPress={() =>
              router.push({
                pathname: "/jobs/inventory-request",
                params: { jobId: job.id, jobNumber: job.jobNumber },
              })
            }
          />
        ) : (
          <>
            {data.issuedReqs.map((req, i) => (
              <StockLineCard
                key={req.id || `issued-${i}-${lineTitle(req.item)}`}
                title={lineTitle(req.item)}
                detail={`Qty ${qtyLabel(req.qtyRequested)} · from warehouse`}
                badge="Issued"
                tone="Approved"
              />
            ))}
            {extras.map((l) => (
              <StockLineCard
                key={l.id}
                title={l.title}
                detail={`Qty ${l.qtyPlanned} · ${formatMoney(l.unitRate)} each`}
                badge="On job"
                tone="Approved"
              />
            ))}
          </>
        )}
      </View>
    );
  }

  if (section === "discount_req") {
    return (
      <View style={{ gap: space.sm }}>
        <Text style={heading}>Discount requests</Text>
        <Text style={sub}>Waiting on office approval.</Text>
        {data.discountPending.length === 0 ? (
          <Button
            title="Ask for discount"
            size="lg"
            icon={<Percent size={20} color="#fff" />}
            onPress={() =>
              router.push({
                pathname: "/jobs/discount-modal",
                params: { jobId: job.id },
              })
            }
            style={{ backgroundColor: "#BE123C" }}
          />
        ) : (
          <>
            {data.discountPending.map((l) => (
              <StockLineCard
                key={l.id}
                title={l.title}
                detail={`Pending · ${toPkrLabel(l.discountRequested)}`}
                badge="Pending"
                tone="Pending"
              />
            ))}
            <Button
              title="Ask another discount"
              variant="secondary"
              size="lg"
              icon={<Percent size={18} color={colors.text} />}
              onPress={() =>
                router.push({
                  pathname: "/jobs/discount-modal",
                  params: { jobId: job.id },
                })
              }
            />
          </>
        )}
      </View>
    );
  }

  if (section === "discount_ok") {
    return (
      <View style={{ gap: space.sm }}>
        <Text style={heading}>Approved discounts</Text>
        <Text style={sub}>Already applied to this job's price.</Text>
        {data.discountApproved.length === 0 ? (
          <Button
            title="Ask for discount"
            size="lg"
            icon={<Percent size={20} color="#fff" />}
            onPress={() =>
              router.push({
                pathname: "/jobs/discount-modal",
                params: { jobId: job.id },
              })
            }
            style={{ backgroundColor: "#BE123C" }}
          />
        ) : (
          data.discountApproved.map((l) => (
            <StockLineCard
              key={l.id}
              title={l.title}
              detail={`Approved · ${toPkrLabel(l.discountApproved)}\nNow ${formatMoney(l.unitRate)} · line ${formatMoney(l.lineTotal)}`}
              badge="Approved"
              tone="Approved"
            />
          ))
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <Text style={heading}>Services</Text>
      <Text style={sub}>Billable services on this job.</Text>
      {data.services.length === 0 ? (
        <Button
          title="Add services"
          size="lg"
          icon={<Wrench size={20} color="#fff" />}
          onPress={() =>
            router.push({
              pathname: "/jobs/add-services",
              params: { jobId: job.id, jobNumber: job.jobNumber },
            })
          }
          style={{ backgroundColor: "#2563EB" }}
        />
      ) : (
        <>
          {data.services.map((l) => (
            <StockLineCard
              key={l.id}
              title={l.title}
              detail={`${formatMoney(l.unitRate)}${l.subtitle ? ` · Added by ${l.subtitle}` : ""}`}
            />
          ))}
          <Button
            title="Add more services"
            variant="secondary"
            size="lg"
            icon={<Wrench size={18} color={colors.text} />}
            onPress={() =>
              router.push({
                pathname: "/jobs/add-services",
                params: { jobId: job.id, jobNumber: job.jobNumber },
              })
            }
          />
        </>
      )}
    </View>
  );
}

export function buildJobTabs(job: Job, items: JobItem[]): Tab[] {
  const requests = asInvReqs(job);
  const safeItems = Array.isArray(items) ? items : [];
  const d = {
    pending: requests.filter((r) => (r.status || "pending").toLowerCase() === "pending").length,
    issued:
      requests.filter((r) => (r.status || "").toLowerCase() === "issued").length +
      safeItems.filter((it) =>
        /\[Issued by Storekeeper\]/i.test(it.description ?? it.name ?? "")
      ).length,
    discReq: safeItems.filter((it) => {
      const raw = it.description ?? it.name ?? "";
      return /\[Discount Requested:/i.test(raw) && !/\[Discount Approved:/i.test(raw);
    }).length,
    discOk: safeItems.filter((it) =>
      /\[Discount Approved:/i.test(it.description ?? it.name ?? "")
    ).length,
    services: safeItems.filter((it) => {
      const raw = it.description ?? it.name ?? "";
      return /^\[Service\]/i.test(raw) || /\[Service Added by/i.test(raw);
    }).length,
  };

  return [
    { id: "details", label: "Job details" },
    { id: "stock_req", label: "Stock request", count: d.pending },
    { id: "received", label: "Received stock", count: d.issued },
    { id: "discount_req", label: "Discount req", count: d.discReq },
    { id: "discount_ok", label: "Approved discount", count: d.discOk },
    { id: "services", label: "Services", count: d.services },
  ];
}

const heading = {
  color: colors.text,
  fontWeight: "800" as const,
  fontSize: 16,
};

const sub = {
  color: colors.textDim,
  fontSize: 12,
  lineHeight: 18,
  marginBottom: 4,
};

const row = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: space.sm,
  backgroundColor: colors.surface,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  padding: space.md,
};
