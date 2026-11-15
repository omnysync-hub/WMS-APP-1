import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AlertCircle, ShieldAlert } from "lucide-react-native";
import { WorkshopBikesApi, apiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { StatusChip } from "@/components/StatusChip";
import { StepProgress } from "@/components/StepProgress";
import { SearchPicker, type PickerItem } from "@/components/SearchPicker";
import { canDo, formatDateTime, formatMoney } from "@/lib/workshop";

const WORK_STATUSES = ["Approved", "In Progress", "On Hold"];

/**
 * Bike Job Card detail — the full 10-step Workshop SOP on one screen.
 * Each section is gated by the signed-in user's workshop role (from the ERP
 * login) and by the job status, mirroring the ERP server controls:
 * no work / material before Manager approval, no close while tools are
 * issued or requisitions are pending at Store.
 */
export default function BikeJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const employee = useAuthStore((s) => s.employee);
  const role = useAuthStore((s) => s.workshopRole);

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [staff, setStaff] = useState<PickerItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Step 2 - assign
  const [showAssign, setShowAssign] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState<string | null>(null);
  const [assignStaffName, setAssignStaffName] = useState<string | null>(null);

  // Step 3 - diagnosis
  const [showDiagnose, setShowDiagnose] = useState(false);
  const [findings, setFindings] = useState("");
  const [workReq, setWorkReq] = useState("");
  const [estHours, setEstHours] = useState("");
  const [estCost, setEstCost] = useState("");

  // Step 4 - approval
  const [rejectReason, setRejectReason] = useState("");

  // Step 5 - requisition
  const [showParts, setShowParts] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [partDesc, setPartDesc] = useState("");
  const [partUnit, setPartUnit] = useState("pcs");
  const [partCost, setPartCost] = useState("");
  const [partQty, setPartQty] = useState("1");

  // Steps 6 & 9 - per-requisition issue / return inputs
  const [issueQty, setIssueQty] = useState<Record<string, string>>({});
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState<Record<string, string>>({});

  // Step 7 - testing
  const [showTest, setShowTest] = useState(false);
  const [testResult, setTestResult] = useState<"Pass" | "Fail">("Pass");
  const [testNotes, setTestNotes] = useState("");

  // Step 8 - completion
  const [showFinish, setShowFinish] = useState(false);
  const [workDone, setWorkDone] = useState("");

  // Scrap on this job
  const [showScrap, setShowScrap] = useState(false);
  const [scrapDesc, setScrapDesc] = useState("");
  const [scrapQty, setScrapQty] = useState("1");
  const [scrapUnit, setScrapUnit] = useState("pcs");
  const [scrapKept, setScrapKept] = useState(false);

  // Step 10 - close
  const [showClose, setShowClose] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("ready_for_delivery");
  const [deliveredTo, setDeliveredTo] = useState("");

  const loadJob = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await WorkshopBikesApi.getJob(id!);
      if (res.success) setJob(res.data);
      else setLoadError(res.error || "Job card not found.");
    } catch (e: any) {
      setLoadError(apiErrorMessage(e, "Failed to load this job card."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadJob();
  }, [id, loadJob]);

  useEffect(() => {
    (async () => {
      try {
        const res = await WorkshopBikesApi.getOptions();
        if (res.success) {
          setStaff(
            (res.data.staff || []).map((s: any) => ({
              id: s.id,
              label: s.name,
              sub: s.designation || s.role || undefined,
            }))
          );
          setProducts(res.data.products || []);
        }
      } catch (e) {
        // Pickers degrade gracefully; free-text paths remain.
      }
    })();
  }, []);

  /** Run a POST action, refresh the job, and surface the ERP's own message on failure. */
  const run = async (key: string, fn: () => Promise<any>, successMsg?: string) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res && res.success === false) {
        Alert.alert("Not Allowed", res.error || "The server rejected this action.");
        return false;
      }
      if (successMsg) Alert.alert("Done", successMsg);
      await loadJob();
      return true;
    } catch (e: any) {
      Alert.alert("Server Message", apiErrorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#09090B] items-center justify-center">
        <ActivityIndicator color="#F59E0B" size="large" />
        <Text className="text-zinc-500 text-xs mt-2">Loading job card...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-[#09090B] items-center justify-center px-8">
        <AlertCircle color="#F87171" size={32} />
        <Text className="text-red-300 text-sm font-bold mt-3 text-center">Could not load this job card</Text>
        <Text className="text-zinc-500 text-xs mt-1 text-center">{loadError || "Unknown error"}</Text>
        <TouchableOpacity onPress={loadJob} className="bg-amber-500 px-4 py-2 rounded-xl mt-4">
          <Text className="text-black text-xs font-bold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const reqs: any[] = job.requisitions || [];
  const outstandingTools: any[] = (job.toolIssues || []).filter((t: any) => t.status === "issued");
  const pendingReqs = reqs.filter((r) => r.status === "requested");
  const closeBlockers: string[] = [];
  if (outstandingTools.length > 0)
    closeBlockers.push(`${outstandingTools.length} tool(s) still checked out to this job`);
  if (pendingReqs.length > 0)
    closeBlockers.push(`${pendingReqs.length} material requisition(s) still pending at Store`);

  const canDiagnose =
    canDo(role, "diagnose") && ["Assigned", "Under Inspection", "Rejected"].includes(job.status);
  const canApprove = canDo(role, "approve") && job.status === "Pending Approval";
  const canRequest =
    canDo(role, "request_material") && WORK_STATUSES.includes(job.status);
  const canTest = canDo(role, "testing") && WORK_STATUSES.includes(job.status);
  const canComplete = canDo(role, "complete") && WORK_STATUSES.includes(job.status);
  const canClose = canDo(role, "close") && job.status === "Completed";
  const canAssign =
    canDo(role, "assign") && !["Closed", "Completed", "Rejected"].includes(job.status);
  const canScrap = canDo(role, "record_scrap") && !["Closed", "Rejected"].includes(job.status);

  const productItems: PickerItem[] = products.map((p) => ({
    id: p.id,
    label: p.name,
    sub: `${p.sku || ""} • Stock: ${p.stockQuantity} ${p.unit} • ${formatMoney(p.costPrice || p.unitPrice)}`,
  }));

  return (
    <ScrollView
      className="flex-1 bg-[#09090B] p-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJob(); }} tintColor="#F59E0B" />}
    >
      {/* Header Banner */}
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-amber-400 font-mono text-xs font-extrabold">{job.jobNumber}</Text>
          <StatusChip status={job.status} />
        </View>
        <Text className="text-white text-lg font-extrabold mt-1">🏍️ {job.bikeRegNo || "—"}</Text>
        <Text className="text-zinc-400 text-xs">
          {job.bikeMakeModel || "Motorbike"} • Chassis: {job.chassisNumber || "N/A"} • Engine:{" "}
          {job.engineNumber || "N/A"} • {job.currentKm ? `${job.currentKm} km` : "Km N/A"}
        </Text>
        <View className="flex-row items-center justify-between mt-2.5 pt-2 border-t border-zinc-800/60">
          <Text className="text-zinc-400 text-xs">
            Material: {formatMoney(job.totalMaterialCost)} • Labour: {formatMoney(job.totalLabourCost)}
          </Text>
          <Text className="text-emerald-400 font-mono font-bold text-xs">
            Total {formatMoney(job.totalJobCost)}
          </Text>
        </View>
      </View>

      <StepProgress job={job} />

      {/* Step 1: Intake & Complaint */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-zinc-400 text-[10px] uppercase font-bold mb-1">
          Step 1: Intake & Customer Complaint
        </Text>
        <Text className="text-white text-xs">{job.complaint}</Text>
        <Text className="text-zinc-500 text-[10px] mt-1.5">
          Customer: {job.customerName || job.customer?.name || "Walk-In"} ({job.customerPhone || job.customer?.phone || "-"})
          {"\n"}Received: {formatDateTime(job.createdAt)} • Supervisor: {job.supervisorName || "-"}
        </Text>
      </View>

      {/* Step 2: Assignment */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-zinc-400 text-[10px] uppercase font-bold">Step 2: Mechanic Assignment</Text>
          {canAssign && (
            <TouchableOpacity onPress={() => setShowAssign(!showAssign)}>
              <Text className="text-amber-400 text-xs font-bold">{job.assignedStaffName ? "Reassign" : "+ Assign"}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text className="text-white text-xs">
          {job.assignedStaffName
            ? `🔧 ${job.assignedStaffName} • assigned ${formatDateTime(job.assignedAt)}`
            : "No mechanic assigned yet."}
        </Text>
        {!canDo(role, "assign") && !job.assignedStaffName && (
          <Text className="text-zinc-500 text-[11px] mt-1">Only the Supervisor or Manager can assign a mechanic.</Text>
        )}
        {showAssign && canAssign && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <SearchPicker
              placeholder="Select mechanic / staff..."
              items={staff}
              selectedId={assignStaffId}
              emptyText="No active staff found in ERP"
              onSelect={(item) => {
                setAssignStaffId(item.id);
                setAssignStaffName(item.label);
              }}
            />
            <TouchableOpacity
              disabled={!assignStaffId || busy === "assign"}
              onPress={async () => {
                const ok = await run(
                  "assign",
                  () => WorkshopBikesApi.assignStaff(job.id, assignStaffId!, assignStaffName!),
                  `Assigned to ${assignStaffName}`
                );
                if (ok) setShowAssign(false);
              }}
              className={`py-2 rounded-lg items-center mt-2.5 ${assignStaffId ? "bg-amber-500" : "bg-zinc-800 opacity-50"}`}
            >
              <Text className="text-black font-bold text-xs">
                {busy === "assign" ? "Assigning..." : "Confirm Assignment"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Steps 3 & 4: Diagnosis & Manager Approval */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-amber-400 text-[10px] uppercase font-bold">Steps 3 & 4: Diagnosis & Manager Gate</Text>
          <Text
            className={`text-[10px] font-bold ${
              job.approvalStatus === "approved"
                ? "text-emerald-400"
                : job.approvalStatus === "rejected"
                ? "text-red-400"
                : "text-amber-400"
            }`}
          >
            {(job.approvalStatus || "pending").toUpperCase()}
          </Text>
        </View>

        {job.inspectionFindings ? (
          <View className="mt-1">
            <Text className="text-zinc-300 text-xs font-semibold">Findings: {job.inspectionFindings}</Text>
            <Text className="text-zinc-400 text-xs mt-0.5">Work required: {job.workRequired}</Text>
            <Text className="text-zinc-500 text-[10px] mt-1">
              Est: {job.estimatedHours ?? "-"} hrs • {formatMoney(job.estimatedCost)} • By {job.diagnosedBy || "-"} •{" "}
              {formatDateTime(job.diagnosedAt)}
            </Text>
            {job.managerApprovedBy && (
              <Text className="text-zinc-500 text-[10px]">
                Manager: {job.managerApprovedBy} • {formatDateTime(job.managerApprovedAt)}
              </Text>
            )}
            {job.rejectionReason && (
              <Text className="text-red-300 text-[11px] mt-1">Rejection reason: {job.rejectionReason}</Text>
            )}
          </View>
        ) : (
          <Text className="text-zinc-500 text-xs italic">Diagnosis not submitted yet.</Text>
        )}

        {job.status !== "Closed" && job.status !== "Completed" && (
          <View className="flex-row items-center gap-2 mt-2">
            <ShieldAlert color="#F59E0B" size={13} />
            <Text className="text-zinc-500 text-[11px] flex-1">
              Control: no repair work or material issue before Manager approval.
            </Text>
          </View>
        )}

        {canDiagnose && (
          <>
            <TouchableOpacity
              onPress={() => {
                setFindings(job.inspectionFindings || "");
                setWorkReq(job.workRequired || "");
                setShowDiagnose(!showDiagnose);
              }}
              className="mt-2.5 bg-zinc-800 py-2 rounded-xl items-center"
            >
              <Text className="text-zinc-200 text-xs font-bold">
                {job.inspectionFindings ? "Re-Submit Diagnosis" : "Log Diagnosis"}
              </Text>
            </TouchableOpacity>
            {showDiagnose && (
              <View className="mt-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <TextInput
                  placeholder="Inspection Findings *"
                  placeholderTextColor="#71717A"
                  value={findings}
                  onChangeText={setFindings}
                  multiline
                  className="bg-[#18181B] text-white text-xs p-2 rounded-lg mb-2"
                />
                <TextInput
                  placeholder="Work Required (incl. parts needed) *"
                  placeholderTextColor="#71717A"
                  value={workReq}
                  onChangeText={setWorkReq}
                  multiline
                  className="bg-[#18181B] text-white text-xs p-2 rounded-lg mb-2"
                />
                <View className="flex-row gap-2">
                  <TextInput
                    placeholder="Est Hours"
                    placeholderTextColor="#71717A"
                    value={estHours}
                    onChangeText={setEstHours}
                    keyboardType="numeric"
                    className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
                  />
                  <TextInput
                    placeholder="Est Cost (PKR)"
                    placeholderTextColor="#71717A"
                    value={estCost}
                    onChangeText={setEstCost}
                    keyboardType="numeric"
                    className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
                  />
                </View>
                <TouchableOpacity
                  disabled={busy === "diagnose"}
                  onPress={async () => {
                    if (!findings.trim() || !workReq.trim()) {
                      Alert.alert("Required", "Please provide inspection findings and work required.");
                      return;
                    }
                    const ok = await run("diagnose", () =>
                      WorkshopBikesApi.saveDiagnosis(job.id, {
                        inspectionFindings: findings.trim(),
                        workRequired: workReq.trim(),
                        estimatedHours: estHours ? Number(estHours) : undefined,
                        estimatedCost: estCost ? Number(estCost) : undefined,
                      })
                    );
                    if (ok) setShowDiagnose(false);
                  }}
                  className="bg-amber-500 py-2 rounded-lg items-center mt-2.5"
                >
                  <Text className="text-black font-bold text-xs">
                    {busy === "diagnose" ? "Submitting..." : "Submit to Manager"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {job.status === "Pending Approval" && !canDo(role, "approve") && (
          <Text className="text-amber-300 text-[11px] mt-2.5">
            Waiting for the Workshop Manager to approve this diagnosis.
          </Text>
        )}

        {canApprove && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl border border-amber-900/60">
            <Text className="text-amber-300 text-[10px] uppercase font-bold mb-2">Manager Decision</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                disabled={busy === "approve"}
                onPress={() =>
                  run("approve", () => WorkshopBikesApi.approveDiagnosis(job.id), "Diagnosis approved. Work can now commence.")
                }
                className="flex-1 bg-emerald-600 py-2.5 rounded-lg items-center"
              >
                <Text className="text-white font-bold text-xs">✓ Approve Work</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={busy === "reject"}
                onPress={async () => {
                  if (!rejectReason.trim()) {
                    Alert.alert("Reason Required", "Enter a rejection reason below first (the unit will be returned / card closed off).");
                    return;
                  }
                  await run("reject", () => WorkshopBikesApi.rejectDiagnosis(job.id, rejectReason.trim()), "Diagnosis rejected.");
                }}
                className="flex-1 bg-red-700 py-2.5 rounded-lg items-center"
              >
                <Text className="text-white font-bold text-xs">✕ Reject</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Rejection reason (required to reject)"
              placeholderTextColor="#71717A"
              value={rejectReason}
              onChangeText={setRejectReason}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg mt-2"
            />
          </View>
        )}
      </View>

      {/* Steps 5, 6 & 9: Requisition, Issue, Returns */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-emerald-400 text-[10px] uppercase font-bold">Steps 5, 6 & 9: Material — Requisition / Issue / Returns</Text>
          {canRequest && (
            <TouchableOpacity onPress={() => setShowParts(!showParts)}>
              <Text className="text-emerald-400 text-xs font-bold">+ Request</Text>
            </TouchableOpacity>
          )}
        </View>
        {!WORK_STATUSES.includes(job.status) && job.status !== "Completed" && job.status !== "Closed" && (
          <Text className="text-zinc-500 text-[11px]">
            Material can only be requisitioned after Manager approval (job must be Approved / In Progress).
          </Text>
        )}

        {reqs.length > 0 ? (
          reqs.map((req) => {
            const unreturned = Math.max(0, (req.issuedQty || 0) - (req.returnedQty || 0));
            const canIssueThis =
              canDo(role, "issue_material") && ["requested", "partially_issued"].includes(req.status);
            const canReturnThis = canDo(role, "return_material") && unreturned > 0;
            return (
              <View key={req.id} className="bg-zinc-950 p-2.5 rounded-lg mt-2 border border-zinc-900">
                <View className="flex-row items-start justify-between">
                  <Text className="text-white text-xs font-semibold flex-1 pr-2">
                    {req.description}
                    {req.product?.name ? ` (${req.product.name})` : ""}
                  </Text>
                  <Text className="text-emerald-400 text-[10px] font-bold">{req.status}</Text>
                </View>
                <Text className="text-zinc-500 text-[10px] mt-0.5">
                  Req {req.requestedQty} • Issued {req.issuedQty || 0} • Returned {req.returnedQty || 0} {req.unit}
                  {req.unitCost ? ` • ${formatMoney(req.unitCost)}/unit` : ""} • Line: {formatMoney(req.totalCost)}
                </Text>
                <Text className="text-zinc-600 text-[10px]">
                  By {req.requestedBy || "-"} {formatDateTime(req.createdAt)}
                  {req.issuedBy ? ` • Issued by ${req.issuedBy} ${formatDateTime(req.issuedAt)}` : ""}
                  {req.returnedBy ? ` • Returned by ${req.returnedBy} (${req.returnReason || ""})` : ""}
                </Text>

                {canIssueThis && (
                  <View className="flex-row gap-2 mt-2">
                    <TextInput
                      placeholder={`Issue qty (req ${req.requestedQty})`}
                      placeholderTextColor="#71717A"
                      value={issueQty[req.id] ?? String(Math.max(0, req.requestedQty - (req.issuedQty || 0)) || "")}
                      onChangeText={(t) => setIssueQty((s) => ({ ...s, [req.id]: t }))}
                      keyboardType="numeric"
                      className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
                    />
                    <TouchableOpacity
                      disabled={busy === `issue-${req.id}`}
                      onPress={async () => {
                        const qty = Number(issueQty[req.id]);
                        if (!qty || qty <= 0) {
                          Alert.alert("Required", "Enter the quantity to issue.");
                          return;
                        }
                        await run(`issue-${req.id}`, () => WorkshopBikesApi.issueMaterial(req.id, qty), "Material issued. ERP stock updated.");
                      }}
                      className="bg-[#0D7A5F] px-3 rounded-lg items-center justify-center"
                    >
                      <Text className="text-white font-bold text-xs">Issue</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {canReturnThis && (
                  <View className="mt-2">
                    <View className="flex-row gap-2">
                      <TextInput
                        placeholder={`Return qty (max ${unreturned})`}
                        placeholderTextColor="#71717A"
                        value={returnQty[req.id] || ""}
                        onChangeText={(t) => setReturnQty((s) => ({ ...s, [req.id]: t }))}
                        keyboardType="numeric"
                        className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
                      />
                      <TouchableOpacity
                        disabled={busy === `return-${req.id}`}
                        onPress={async () => {
                          const qty = Number(returnQty[req.id]);
                          const reason = (returnReason[req.id] || "").trim();
                          if (!qty || qty <= 0) {
                            Alert.alert("Required", "Enter the quantity being returned.");
                            return;
                          }
                          if (!reason) {
                            Alert.alert("Required", "Enter a return reason (e.g. unused, wrong part).");
                            return;
                          }
                          const ok = await run(
                            `return-${req.id}`,
                            () => WorkshopBikesApi.returnMaterial(req.id, qty, reason),
                            "Material returned to store. Stock and job cost adjusted."
                          );
                          if (ok) {
                            setReturnQty((s) => ({ ...s, [req.id]: "" }));
                            setReturnReason((s) => ({ ...s, [req.id]: "" }));
                          }
                        }}
                        className="bg-zinc-700 px-3 rounded-lg items-center justify-center"
                      >
                        <Text className="text-white font-bold text-xs">Return</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      placeholder="Return reason *"
                      placeholderTextColor="#71717A"
                      value={returnReason[req.id] || ""}
                      onChangeText={(t) => setReturnReason((s) => ({ ...s, [req.id]: t }))}
                      className="bg-[#18181B] text-white text-xs p-2 rounded-lg mt-1.5"
                    />
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text className="text-zinc-500 text-xs italic mt-1">No material requisitioned yet.</Text>
        )}

        {showParts && canRequest && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <Text className="text-zinc-400 text-[10px] mb-1">Pick from ERP inventory (stock-checked at issue)</Text>
            <SearchPicker
              placeholder="Select product / part..."
              items={productItems}
              selectedId={productId}
              emptyText="No products in ERP inventory - describe the part below"
              onSelect={(item) => {
                const p = products.find((x) => x.id === item.id);
                setProductId(item.id);
                setPartDesc(item.label);
                if (p) {
                  setPartUnit(p.unit || "pcs");
                  setPartCost(String(p.costPrice || p.unitPrice || ""));
                }
              }}
            />
            <TextInput
              placeholder="Part description * (e.g. Engine Oil 20W50 / Clutch Plates)"
              placeholderTextColor="#71717A"
              value={partDesc}
              onChangeText={(t) => {
                setPartDesc(t);
                setProductId(null);
              }}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg mt-2"
            />
            <View className="flex-row gap-2 mt-2">
              <TextInput
                placeholder="Qty"
                placeholderTextColor="#71717A"
                value={partQty}
                onChangeText={setPartQty}
                keyboardType="numeric"
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
              <TextInput
                placeholder="Unit"
                placeholderTextColor="#71717A"
                value={partUnit}
                onChangeText={setPartUnit}
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
            </View>
            <TouchableOpacity
              disabled={busy === "request"}
              onPress={async () => {
                if (!partDesc.trim()) {
                  Alert.alert("Required", "Please pick a product or enter a part description.");
                  return;
                }
                const picked = products.find((x) => x.id === productId);
                const ok = await run("request", () =>
                  WorkshopBikesApi.requestParts(job.id, [
                    {
                      productId: productId || undefined,
                      itemCode: picked?.sku || undefined,
                      description: partDesc.trim(),
                      requestedQty: Number(partQty) || 1,
                      unit: partUnit || "pcs",
                      unitCost: partCost ? Number(partCost) : undefined,
                    },
                  ])
                );
                if (ok) {
                  setShowParts(false);
                  setPartDesc("");
                  setProductId(null);
                  setPartQty("1");
                }
              }}
              className="bg-[#0D7A5F] py-2 rounded-lg items-center mt-2.5"
            >
              <Text className="text-white font-bold text-xs">
                {busy === "request" ? "Sending..." : "Send Requisition to Store"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Step 7: Testing / Road Test */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-sky-400 text-[10px] uppercase font-bold mb-1">Step 7: Testing — Bike Road Test</Text>
        {job.testedAt ? (
          <Text className="text-white text-xs">
            Result: {job.testingLeakTest || "Pass"} • {job.testingNotes || "No notes"}
            {"\n"}
            <Text className="text-zinc-500 text-[10px]">
              By {job.testedBy || "-"} • {formatDateTime(job.testedAt)}
            </Text>
          </Text>
        ) : (
          <Text className="text-zinc-500 text-xs italic">Road test not logged yet.</Text>
        )}

        {canTest && (
          <>
            <TouchableOpacity
              onPress={() => setShowTest(!showTest)}
              className="mt-2.5 bg-zinc-800 py-2 rounded-xl items-center"
            >
              <Text className="text-zinc-200 text-xs font-bold">Log Road Test Results</Text>
            </TouchableOpacity>
            {showTest && (
              <View className="mt-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <View className="flex-row gap-2">
                  {(["Pass", "Fail"] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setTestResult(r)}
                      className={`flex-1 py-2 rounded-lg items-center ${
                        testResult === r ? (r === "Pass" ? "bg-emerald-600" : "bg-red-700") : "bg-zinc-800"
                      }`}
                    >
                      <Text className="text-white font-bold text-xs">{r === "Pass" ? "✓ Pass" : "✕ Fail"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  placeholder="Test observation (e.g. Smooth road test, brakes sharp)"
                  placeholderTextColor="#71717A"
                  value={testNotes}
                  onChangeText={setTestNotes}
                  multiline
                  className="bg-[#18181B] text-white text-xs p-2 rounded-lg mt-2"
                />
                <TouchableOpacity
                  disabled={busy === "test"}
                  onPress={async () => {
                    const ok = await run("test", () =>
                      WorkshopBikesApi.saveTestRun(job.id, {
                        testingLeakTest: testResult,
                        testingNotes: testNotes.trim() || undefined,
                      })
                    );
                    if (ok) setShowTest(false);
                  }}
                  className="bg-sky-600 py-2 rounded-lg items-center mt-2.5"
                >
                  <Text className="text-white font-bold text-xs">
                    {busy === "test" ? "Saving..." : "Save Test Results"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Scrap recorded on this job */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-zinc-300 text-[10px] uppercase font-bold">Replaced Parts & Scrap (this job)</Text>
          {canScrap && (
            <TouchableOpacity onPress={() => setShowScrap(!showScrap)}>
              <Text className="text-amber-400 text-xs font-bold">+ Record</Text>
            </TouchableOpacity>
          )}
        </View>
        {job.scrapItems && job.scrapItems.length > 0 ? (
          job.scrapItems.map((s: any) => (
            <View key={s.id} className="flex-row items-center justify-between bg-zinc-950 p-2 rounded-lg mt-1.5">
              <Text className="text-white text-xs flex-1 pr-2">
                {s.itemDescription} (x{s.quantity} {s.unit})
              </Text>
              <Text className={`text-[10px] font-bold ${s.customerKept ? "text-amber-300" : "text-zinc-400"}`}>
                {s.customerKept ? "Customer Kept" : s.status}
              </Text>
            </View>
          ))
        ) : (
          <Text className="text-zinc-500 text-xs italic">No scrap recorded against this job yet.</Text>
        )}
        {showScrap && canScrap && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <TextInput
              placeholder="Replaced part / used oil (e.g. Old clutch plates, Used engine oil 0.8L)"
              placeholderTextColor="#71717A"
              value={scrapDesc}
              onChangeText={setScrapDesc}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <View className="flex-row gap-2 mt-2">
              <TextInput
                placeholder="Qty"
                placeholderTextColor="#71717A"
                value={scrapQty}
                onChangeText={setScrapQty}
                keyboardType="numeric"
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
              <TextInput
                placeholder="Unit"
                placeholderTextColor="#71717A"
                value={scrapUnit}
                onChangeText={setScrapUnit}
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
            </View>
            <TouchableOpacity onPress={() => setScrapKept(!scrapKept)} className="py-2">
              <Text className="text-zinc-400 text-xs">
                {scrapKept ? "✓ Customer kept the old parts" : "☐ Customer kept the old parts"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={busy === "scrap"}
              onPress={async () => {
                if (!scrapDesc.trim()) {
                  Alert.alert("Required", "Describe the replaced part / scrap item.");
                  return;
                }
                const ok = await run("scrap", () =>
                  WorkshopBikesApi.recordScrap(job.id, {
                    itemDescription: scrapDesc.trim(),
                    quantity: Number(scrapQty) || 1,
                    unit: scrapUnit || "pcs",
                    customerKept: scrapKept,
                  })
                );
                if (ok) {
                  setShowScrap(false);
                  setScrapDesc("");
                  setScrapKept(false);
                }
              }}
              className="bg-zinc-700 py-2 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-xs">
                {busy === "scrap" ? "Saving..." : "Record Scrap Against Job"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tools checked out to this job */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-zinc-300 text-[10px] uppercase font-bold mb-1">Tools On This Job</Text>
        {job.toolIssues && job.toolIssues.length > 0 ? (
          job.toolIssues.map((t: any) => (
            <View key={t.id} className="flex-row items-center justify-between bg-zinc-950 p-2 rounded-lg mt-1.5">
              <Text className="text-white text-xs flex-1 pr-2">
                {t.tool?.toolCode} {t.tool?.name} • {t.staffName} (x{t.quantity})
              </Text>
              <Text className={`text-[10px] font-bold ${t.status === "issued" ? "text-amber-300" : "text-emerald-400"}`}>
                {t.status}
              </Text>
            </View>
          ))
        ) : (
          <Text className="text-zinc-500 text-xs italic">No tools issued against this job. Issue tools from the Tools tab.</Text>
        )}
        {outstandingTools.length > 0 && (
          <Text className="text-amber-300 text-[11px] mt-1.5">
            {outstandingTools.length} tool(s) still out — return them from the Tools tab before this card can close.
          </Text>
        )}
      </View>

      {/* Step 8: Completion */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-emerald-400 text-[10px] uppercase font-bold mb-1">Step 8: Job Completion</Text>
        {job.workDoneSummary ? (
          <Text className="text-white text-xs">
            {job.workDoneSummary}
            {"\n"}
            <Text className="text-zinc-500 text-[10px]">
              By {job.completedBy || "-"} • {formatDateTime(job.completedAt)}
            </Text>
          </Text>
        ) : (
          <Text className="text-zinc-500 text-xs italic">Job still in progress.</Text>
        )}
        {canComplete && (
          <>
            <TouchableOpacity
              onPress={() => setShowFinish(!showFinish)}
              className="mt-2.5 bg-emerald-600 py-2.5 rounded-xl items-center"
            >
              <Text className="text-white text-xs font-bold">Mark Work Completed</Text>
            </TouchableOpacity>
            {showFinish && (
              <View className="mt-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <TextInput
                  placeholder="Work Done Summary * (what was repaired / replaced)"
                  placeholderTextColor="#71717A"
                  value={workDone}
                  onChangeText={setWorkDone}
                  multiline
                  className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
                />
                <Text className="text-zinc-500 text-[10px] mt-1.5">
                  Tip: record replaced parts as scrap above before completing.
                </Text>
                <TouchableOpacity
                  disabled={busy === "complete"}
                  onPress={async () => {
                    if (!workDone.trim()) {
                      Alert.alert("Required", "Work done summary is required.");
                      return;
                    }
                    const ok = await run("complete", () => WorkshopBikesApi.completeJob(job.id, workDone.trim()));
                    if (ok) setShowFinish(false);
                  }}
                  className="bg-emerald-600 py-2 rounded-lg items-center mt-2"
                >
                  <Text className="text-white font-bold text-xs">
                    {busy === "complete" ? "Saving..." : "Confirm Job Completion"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        {job.status === "Open" || job.status === "Assigned" || job.status === "Pending Approval" ? (
          <Text className="text-zinc-500 text-[11px] mt-1.5">
            Completion unlocks after Manager approval and work execution.
          </Text>
        ) : null}
      </View>

      {/* Step 10: Final Check & Close */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-zinc-300 text-[10px] uppercase font-bold mb-1">Step 10: Final Check, Close & Delivery</Text>
        {job.status === "Closed" ? (
          <Text className="text-white text-xs">
            Closed by {job.closedBy || "-"} • {formatDateTime(job.closedAt)}
            {"\n"}Notes: {job.closeNotes || "-"}
            {"\n"}Delivery: {job.deliveryStatus || "-"}
            {job.deliveredTo ? ` to ${job.deliveredTo}` : ""}
          </Text>
        ) : job.status !== "Completed" ? (
          <Text className="text-zinc-500 text-xs italic">
            Available after the mechanic marks the job Completed.
          </Text>
        ) : (
          <>
            {closeBlockers.length > 0 ? (
              <View className="bg-red-950/50 border border-red-900 rounded-xl p-2.5 mt-1">
                <Text className="text-red-300 text-[11px] font-bold">Cannot close yet:</Text>
                {closeBlockers.map((b) => (
                  <Text key={b} className="text-red-200 text-[11px]">• {b}</Text>
                ))}
              </View>
            ) : (
              <Text className="text-emerald-300 text-[11px] mt-1">
                ✓ All tools returned and material reconciled — ready for final check.
              </Text>
            )}
            {!canDo(role, "close") && (
              <Text className="text-zinc-500 text-[11px] mt-1.5">Only the Workshop Manager can close a job card.</Text>
            )}
            {canClose && (
              <>
                <TouchableOpacity
                  onPress={() => setShowClose(!showClose)}
                  className="mt-2.5 bg-zinc-100 py-2.5 rounded-xl items-center"
                >
                  <Text className="text-black text-xs font-bold">Final Check & Close Job Card</Text>
                </TouchableOpacity>
                {showClose && (
                  <View className="mt-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <TextInput
                      placeholder="Close notes (final check remarks)"
                      placeholderTextColor="#71717A"
                      value={closeNotes}
                      onChangeText={setCloseNotes}
                      multiline
                      className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
                    />
                    <View className="flex-row gap-2 mt-2">
                      {[
                        { v: "ready_for_delivery", label: "Ready for Delivery" },
                        { v: "delivered", label: "Delivered" },
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.v}
                          onPress={() => setDeliveryStatus(opt.v)}
                          className={`flex-1 py-2 rounded-lg items-center ${deliveryStatus === opt.v ? "bg-amber-500" : "bg-zinc-800"}`}
                        >
                          <Text className={`font-bold text-[11px] ${deliveryStatus === opt.v ? "text-black" : "text-zinc-300"}`}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {deliveryStatus === "delivered" && (
                      <TextInput
                        placeholder="Delivered to (person name)"
                        placeholderTextColor="#71717A"
                        value={deliveredTo}
                        onChangeText={setDeliveredTo}
                        className="bg-[#18181B] text-white text-xs p-2 rounded-lg mt-2"
                      />
                    )}
                    <TouchableOpacity
                      disabled={busy === "close"}
                      onPress={async () => {
                        const ok = await run(
                          "close",
                          () =>
                            WorkshopBikesApi.closeJob(job.id, {
                              closeNotes: closeNotes.trim() || undefined,
                              deliveryStatus,
                              deliveredTo: deliveryStatus === "delivered" ? deliveredTo.trim() || undefined : undefined,
                            }),
                          "Job card closed."
                        );
                        if (ok) setShowClose(false);
                      }}
                      className="bg-zinc-100 py-2.5 rounded-lg items-center mt-2.5"
                    >
                      <Text className="text-black font-bold text-xs">
                        {busy === "close" ? "Closing..." : "Close Job Card"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </View>

      {/* Status History */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-8">
        <Text className="text-zinc-400 text-[10px] uppercase font-bold mb-1.5">Job Status History</Text>
        {job.statusLogs && job.statusLogs.length > 0 ? (
          job.statusLogs.map((log: any) => (
            <View key={log.id} className="py-1.5 border-b border-zinc-900">
              <Text className="text-zinc-200 text-xs font-semibold">
                {log.fromStatus} → {log.toStatus}
                <Text className="text-zinc-500 font-normal"> • {log.changedBy} • {formatDateTime(log.changedAt)}</Text>
              </Text>
              {!!log.notes && <Text className="text-zinc-500 text-[11px] mt-0.5">{log.notes}</Text>}
            </View>
          ))
        ) : (
          <Text className="text-zinc-500 text-xs italic">No status history recorded.</Text>
        )}
        <Text className="text-zinc-600 text-[10px] mt-2">Signed in as {employee?.name} ({role})</Text>
      </View>
    </ScrollView>
  );
}
