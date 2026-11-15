import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { WorkshopHvacApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { StatusChip, StepProgress, formatDateTime } from "@/components/jobUi";
import OptionPicker, { type PickerOption } from "@/components/OptionPicker";

const WORKABLE_STATUSES = ["Approved", "In Progress", "On Hold"];

export default function HvacJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const employee = useAuthStore((s) => s.employee);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [staffOptions, setStaffOptions] = useState<PickerOption[]>([]);
  const [productOptions, setProductOptions] = useState<PickerOption[]>([]);

  // Step 2 — assign
  const [assignPick, setAssignPick] = useState<PickerOption | null>(null);

  // Step 3 — diagnosis
  const [showDiagnose, setShowDiagnose] = useState(false);
  const [findings, setFindings] = useState("");
  const [workReq, setWorkReq] = useState("");
  const [estHours, setEstHours] = useState("");
  const [estCost, setEstCost] = useState("");

  // Step 4 — rejection reason
  const [rejectReason, setRejectReason] = useState("");

  // Step 5 — material request
  const [showRequest, setShowRequest] = useState(false);
  const [productPick, setProductPick] = useState<PickerOption | null>(null);
  const [matDesc, setMatDesc] = useState("");
  const [matQty, setMatQty] = useState("");
  const [matUnit, setMatUnit] = useState("kg");

  // Steps 6/9 — per-requisition issue/return inputs
  const [issueQty, setIssueQty] = useState<Record<string, string>>({});
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState<Record<string, string>>({});
  const [openReqAction, setOpenReqAction] = useState<string | null>(null);

  // Step 7 — testing
  const [showTest, setShowTest] = useState(false);
  const [testPsi, setTestPsi] = useState("");
  const [testAmps, setTestAmps] = useState("");
  const [leakResult, setLeakResult] = useState<"Pass" | "Fail">("Pass");
  const [leakDetail, setLeakDetail] = useState("");
  const [testNotes, setTestNotes] = useState("");

  // Scrap
  const [showScrap, setShowScrap] = useState(false);
  const [scrapDesc, setScrapDesc] = useState("");
  const [scrapQty, setScrapQty] = useState("1");
  const [scrapUnit, setScrapUnit] = useState("pcs");
  const [scrapCustomerKept, setScrapCustomerKept] = useState(false);

  // Step 8 — complete
  const [showFinish, setShowFinish] = useState(false);
  const [workDone, setWorkDone] = useState("");

  // Step 10 — close
  const [closeNotes, setCloseNotes] = useState("");
  const [deliveredTo, setDeliveredTo] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState<"ready_for_delivery" | "delivered">("ready_for_delivery");

  const loadJob = useCallback(async () => {
    if (!id) return;
    try {
      setLoadError(null);
      const res = await WorkshopHvacApi.getJob(id);
      if (res.success) {
        setJob(res.data);
      } else {
        setLoadError(res.error || "Job card not found");
      }
    } catch (e: any) {
      setLoadError(e?.message || "Could not load this job card");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadOptions = useCallback(async () => {
    try {
      const res = await WorkshopHvacApi.getOptions();
      if (res.success && res.data) {
        setStaffOptions(
          (res.data.staff || []).map((s: any) => ({
            id: s.id,
            label: s.name,
            sub: [s.designation || s.role, s.department].filter(Boolean).join(" • "),
          }))
        );
        setProductOptions(
          (res.data.products || []).map((p: any) => ({
            id: p.id,
            label: p.name,
            sub: `${p.sku || ""} • Stock: ${p.stockQuantity} ${p.unit} • PKR ${p.costPrice || p.unitPrice || 0}`,
            raw: p,
          }))
        );
      }
    } catch {
      // Pickers degrade gracefully; free-text flows still work.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadJob();
      loadOptions();
    }, [loadJob, loadOptions])
  );

  /** Runs a mutating action, surfaces the ERP's own error text, then reloads. */
  const runAction = async (fn: () => Promise<any>, successMsg?: string) => {
    setActionLoading(true);
    try {
      const res = await fn();
      if (res && res.success === false) {
        Alert.alert("Blocked", res.error || "The server rejected this action.");
        return false;
      }
      if (successMsg) Alert.alert("Done", successMsg);
      await loadJob();
      return true;
    } catch (e: any) {
      Alert.alert("Blocked", e?.message || "Action failed");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // ---------- handlers ----------

  const handleAssign = async () => {
    if (!assignPick) {
      Alert.alert("Select Technician", "Pick a technician from the ERP staff list first.");
      return;
    }
    const ok = await runAction(
      () => WorkshopHvacApi.assignStaff(job.id, assignPick.id, assignPick.label),
      `Assigned to ${assignPick.label}`
    );
    if (ok) setAssignPick(null);
  };

  const openDiagnose = () => {
    setFindings(job.inspectionFindings || "");
    setWorkReq(job.workRequired || "");
    setEstHours(job.estimatedHours != null ? String(job.estimatedHours) : "");
    setEstCost(job.estimatedCost != null ? String(job.estimatedCost) : "");
    setShowDiagnose(!showDiagnose);
  };

  const handleSaveDiagnosis = async () => {
    if (!findings.trim() || !workReq.trim()) {
      Alert.alert("Required", "Please provide inspection findings and work required.");
      return;
    }
    const ok = await runAction(
      () =>
        WorkshopHvacApi.saveDiagnosis(job.id, {
          inspectionFindings: findings.trim(),
          workRequired: workReq.trim(),
          estimatedHours: estHours ? Number(estHours) : undefined,
          estimatedCost: estCost ? Number(estCost) : undefined,
        }),
      "Diagnosis submitted — job is now Pending Approval. No work may start until the Manager approves."
    );
    if (ok) setShowDiagnose(false);
  };

  const handleApprove = () =>
    runAction(() => WorkshopHvacApi.approveDiagnosis(job.id), "Diagnosis approved. Work can now commence.");

  const handleReject = async () => {
    const ok = await runAction(
      () => WorkshopHvacApi.rejectDiagnosis(job.id, rejectReason.trim() || undefined),
      "Diagnosis rejected. Return the unit to the customer or close the card."
    );
    if (ok) setRejectReason("");
  };

  const pickProduct = (opt: PickerOption | null) => {
    setProductPick(opt);
    if (opt?.raw) {
      setMatDesc(opt.raw.name || "");
      if (opt.raw.unit) setMatUnit(String(opt.raw.unit));
    }
  };

  const handleRequestMaterial = async () => {
    if (!matDesc.trim() || !matQty || Number(matQty) <= 0) {
      Alert.alert("Required", "Enter the material description and a quantity above zero.");
      return;
    }
    const ok = await runAction(
      () =>
        WorkshopHvacApi.requestGasAndParts(job.id, [
          {
            productId: productPick?.id,
            itemCode: productPick?.raw?.sku,
            description: matDesc.trim(),
            requestedQty: Number(matQty),
            unit: matUnit.trim() || "unit",
            unitCost: productPick?.raw ? Number(productPick.raw.costPrice || productPick.raw.unitPrice || 0) : undefined,
          },
        ]),
      "Requisition sent to the Store Keeper against this Job Card No."
    );
    if (ok) {
      setShowRequest(false);
      setProductPick(null);
      setMatDesc("");
      setMatQty("");
    }
  };

  const handleIssue = async (req: any) => {
    const qty = Number(issueQty[req.id]);
    if (!qty || qty <= 0) {
      Alert.alert("Required", "Enter the quantity being issued.");
      return;
    }
    const ok = await runAction(
      () => WorkshopHvacApi.issueMaterial(req.id, qty),
      `Issued ${qty} ${req.unit} of ${req.description}. Stock and job cost updated in ERP.`
    );
    if (ok) {
      setIssueQty((m) => ({ ...m, [req.id]: "" }));
      setOpenReqAction(null);
    }
  };

  const handleReturn = async (req: any) => {
    const qty = Number(returnQty[req.id]);
    const reason = (returnReason[req.id] || "").trim();
    if (!qty || qty <= 0) {
      Alert.alert("Required", "Enter the quantity being returned.");
      return;
    }
    if (!reason) {
      Alert.alert("Required", "A return reason is required (e.g. unused gas remaining, extra part).");
      return;
    }
    const ok = await runAction(
      () => WorkshopHvacApi.returnMaterial(req.id, qty, reason),
      `Returned ${qty} ${req.unit} to store. Stock and job cost adjusted.`
    );
    if (ok) {
      setReturnQty((m) => ({ ...m, [req.id]: "" }));
      setReturnReason((m) => ({ ...m, [req.id]: "" }));
      setOpenReqAction(null);
    }
  };

  const openTest = () => {
    setTestPsi(job.testingPressurePsi != null ? String(job.testingPressurePsi) : "");
    setTestAmps(job.testingRunTestAmps != null ? String(job.testingRunTestAmps) : "");
    setLeakResult((job.testingLeakTest || "Pass").toLowerCase().startsWith("fail") ? "Fail" : "Pass");
    setLeakDetail("");
    setTestNotes(job.testingNotes || "");
    setShowTest(!showTest);
  };

  const handleSaveTest = async () => {
    if (!testPsi && !testAmps && !testNotes.trim()) {
      Alert.alert("Required", "Enter at least one measured value (PSI, amps, or notes).");
      return;
    }
    const leak = leakDetail.trim() ? `${leakResult} — ${leakDetail.trim()}` : leakResult;
    const ok = await runAction(
      () =>
        WorkshopHvacApi.saveBenchTest(job.id, {
          testingPressurePsi: testPsi ? Number(testPsi) : undefined,
          testingLeakTest: leak,
          testingRunTestAmps: testAmps ? Number(testAmps) : undefined,
          testingNotes: testNotes.trim() || undefined,
        }),
      "Testing results logged."
    );
    if (ok) setShowTest(false);
  };

  const handleRecordScrap = async () => {
    if (!scrapDesc.trim()) {
      Alert.alert("Required", "Describe the replaced part / scrap item.");
      return;
    }
    const ok = await runAction(
      () =>
        WorkshopHvacApi.recordScrap(job.id, {
          itemDescription: scrapDesc.trim(),
          quantity: Number(scrapQty) || 1,
          unit: scrapUnit.trim() || "pcs",
          customerKept: scrapCustomerKept,
        }),
      scrapCustomerKept
        ? "Scrap recorded as customer-retained on the job card."
        : "Scrap recorded against the job card. Hand it to the Store from the Scrap tab."
    );
    if (ok) {
      setShowScrap(false);
      setScrapDesc("");
      setScrapQty("1");
      setScrapCustomerKept(false);
    }
  };

  const handleComplete = async () => {
    if (!workDone.trim()) {
      Alert.alert("Required", "Work done summary is required.");
      return;
    }
    const ok = await runAction(
      () => WorkshopHvacApi.completeJob(job.id, workDone.trim()),
      "Job marked Completed. Return any unused material, then the Manager can close the card."
    );
    if (ok) setShowFinish(false);
  };

  const handleClose = async () => {
    await runAction(
      () =>
        WorkshopHvacApi.closeJob(job.id, {
          closeNotes: closeNotes.trim() || undefined,
          deliveryStatus,
          deliveredTo: deliveredTo.trim() || undefined,
        }),
      "Job card closed. Unit is ready for delivery."
    );
  };

  const handleReturnTool = (issue: any) =>
    runAction(
      () => WorkshopHvacApi.returnTool(issue.id, "Operational"),
      `${issue.tool?.name || "Tool"} returned to store.`
    );

  // ---------- render ----------

  if (loading) {
    return (
      <View className="flex-1 bg-[#09090B] items-center justify-center">
        <ActivityIndicator color="#06B6D4" size="large" />
        <Text className="text-zinc-500 text-xs mt-2">Loading job card…</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-[#09090B] items-center justify-center px-8">
        <Text className="text-red-400 text-sm font-bold text-center">Job card unavailable</Text>
        <Text className="text-zinc-500 text-xs text-center mt-1">{loadError || "Not found."}</Text>
        <TouchableOpacity onPress={loadJob} className="bg-cyan-500 px-4 py-2 rounded-xl mt-4">
          <Text className="text-black text-xs font-bold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isClosed = job.status === "Closed";
  const workable = WORKABLE_STATUSES.includes(job.status);
  const outstandingTools = (job.toolIssues || []).filter((t: any) => t.status === "issued");
  const pendingReqs = (job.requisitions || []).filter((r: any) => r.status === "requested");

  return (
    <ScrollView className="flex-1 bg-[#09090B] p-4">
      {/* Header */}
      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-cyan-400 font-mono text-xs font-extrabold">{job.jobNumber}</Text>
          <StatusChip status={job.status} />
        </View>
        <Text className="text-white text-lg font-extrabold mt-1.5">❄️ {job.brandModel}</Text>
        <Text className="text-zinc-400 text-xs">
          {job.unitType} • S/N: {job.serialNumber || "N/A"} • Ref: {job.refrigerantType || "—"}
          {job.compressorSpec ? ` • ${job.compressorSpec}` : ""}
        </Text>
        <View className="mt-2.5 pt-2 border-t border-zinc-800/60 space-y-0.5">
          <Text className="text-zinc-400 text-xs">
            Customer: <Text className="text-zinc-200 font-semibold">{job.customerName || job.customer?.name || "—"}</Text>
            {job.customerPhone || job.customer?.phone ? ` • ${job.customerPhone || job.customer?.phone}` : ""}
          </Text>
          <Text className="text-zinc-400 text-xs">Site: {job.customerSite || "—"}</Text>
          <Text className="text-zinc-400 text-xs">
            Technician: <Text className="text-zinc-200 font-semibold">{job.assignedStaffName || "Not assigned"}</Text>
            {job.supervisorName ? ` • Supervisor: ${job.supervisorName}` : ""}
          </Text>
          <Text className="text-emerald-400 font-mono font-bold text-xs mt-1">
            Job Cost: PKR {(job.totalJobCost || 0).toLocaleString()}
            <Text className="text-zinc-500 font-normal">
              {"  "}(Material PKR {(job.totalMaterialCost || 0).toLocaleString()})
            </Text>
          </Text>
        </View>
      </View>

      <StepProgress job={job} />

      {/* Step 1 — Intake */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-zinc-400 text-[10px] uppercase font-bold mb-1">Step 1: Unit Received — Complaint</Text>
        <Text className="text-white text-xs">{job.complaint}</Text>
        <Text className="text-zinc-500 text-[10px] mt-1">Received: {formatDateTime(job.createdAt)}</Text>
      </View>

      {/* Step 2 — Assign (Supervisor) */}
      {!isClosed && (
        <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
          <Text className="text-cyan-400 text-[10px] uppercase font-bold mb-1.5">
            Step 2: Assign Technician (Supervisor)
          </Text>
          <Text className="text-zinc-400 text-xs mb-2">
            Currently: <Text className="text-zinc-200 font-semibold">{job.assignedStaffName || "Unassigned"}</Text>
            {job.assignedAt ? ` • since ${formatDateTime(job.assignedAt)}` : ""}
          </Text>
          <OptionPicker
            label="Technician"
            placeholder="Select from ERP staff…"
            options={staffOptions}
            value={assignPick}
            onChange={setAssignPick}
          />
          <TouchableOpacity
            onPress={handleAssign}
            disabled={actionLoading || !assignPick}
            className={`mt-2.5 py-2 rounded-xl items-center ${assignPick ? "bg-cyan-600" : "bg-zinc-800 opacity-50"}`}
          >
            <Text className="text-white text-xs font-bold">
              {job.assignedStaffId ? "Reassign Technician" : "Assign Technician"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Steps 3 & 4 — Diagnosis + Manager Approval */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-cyan-400 text-[10px] uppercase font-bold">Steps 3–4: Diagnosis & Manager Approval</Text>
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
              Est: {job.estimatedHours ?? "—"} hrs • PKR {(job.estimatedCost || 0).toLocaleString()}
              {job.diagnosedBy ? ` • by ${job.diagnosedBy}` : ""}
              {job.diagnosedAt ? ` • ${formatDateTime(job.diagnosedAt)}` : ""}
            </Text>
            {job.approvalStatus === "approved" && job.managerApprovedBy && (
              <Text className="text-emerald-500 text-[10px] mt-0.5">
                Approved by {job.managerApprovedBy} • {formatDateTime(job.managerApprovedAt)}
              </Text>
            )}
            {job.approvalStatus === "rejected" && (
              <Text className="text-red-400 text-[10px] mt-0.5">
                Rejected{job.rejectionReason ? `: ${job.rejectionReason}` : ""} — return the unit / close the card.
              </Text>
            )}
          </View>
        ) : (
          <Text className="text-zinc-500 text-xs italic">Diagnosis not submitted yet.</Text>
        )}

        {!isClosed && job.status !== "Completed" && (
          <TouchableOpacity onPress={openDiagnose} className="mt-2.5 bg-zinc-800 py-2 rounded-xl items-center">
            <Text className="text-zinc-200 text-xs font-bold">
              {job.inspectionFindings ? "Update Diagnosis" : "Log Diagnosis (Technician)"}
            </Text>
          </TouchableOpacity>
        )}

        {showDiagnose && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
            <TextInput
              placeholder="Inspection Findings *"
              placeholderTextColor="#71717A"
              value={findings}
              onChangeText={setFindings}
              multiline
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TextInput
              placeholder="Work Required *"
              placeholderTextColor="#71717A"
              value={workReq}
              onChangeText={setWorkReq}
              multiline
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
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
              onPress={handleSaveDiagnosis}
              disabled={actionLoading}
              className="bg-amber-500 py-2 rounded-lg items-center mt-1"
            >
              <Text className="text-black font-bold text-xs">Submit to Manager</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manager gate */}
        {job.status === "Pending Approval" && (
          <View className="mt-3 p-3 bg-amber-950/40 rounded-xl border border-amber-900 space-y-2">
            <Text className="text-amber-300 text-xs font-bold">Manager Decision Required</Text>
            <Text className="text-zinc-400 text-[11px]">
              Control: no repair work and no material issue may start before approval.
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={handleApprove}
                disabled={actionLoading}
                className="flex-1 bg-emerald-600 py-2 rounded-lg items-center"
              >
                <Text className="text-white font-bold text-xs">Approve — Start Work</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReject}
                disabled={actionLoading}
                className="flex-1 bg-red-700 py-2 rounded-lg items-center"
              >
                <Text className="text-white font-bold text-xs">Reject</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Rejection reason (optional)"
              placeholderTextColor="#71717A"
              value={rejectReason}
              onChangeText={setRejectReason}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
          </View>
        )}
      </View>

      {/* Steps 5, 6 & 9 — Material: requisition / issue / return */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-emerald-400 text-[10px] uppercase font-bold">Steps 5–6–9: Material (Gas & Parts)</Text>
          {!isClosed && (
            <TouchableOpacity
              onPress={() => {
                if (!workable) {
                  Alert.alert(
                    "Control Block",
                    `Material can only be requisitioned after Manager approval. Current status: "${job.status}".`
                  );
                  return;
                }
                setShowRequest(!showRequest);
              }}
            >
              <Text className="text-emerald-400 text-xs font-bold">+ Request</Text>
            </TouchableOpacity>
          )}
        </View>

        {job.requisitions && job.requisitions.length > 0 ? (
          job.requisitions.map((req: any) => {
            const outstanding = Math.max(0, (req.issuedQty || 0) - (req.returnedQty || 0));
            const canIssue = ["requested", "partially_issued"].includes(req.status) && !isClosed;
            const canReturn = outstanding > 0 && !isClosed;
            return (
              <View key={req.id} className="bg-zinc-950 p-2.5 rounded-lg mt-1.5 border border-zinc-800/70">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white text-xs font-semibold flex-1 pr-2">{req.description}</Text>
                  <Text className="text-emerald-400 text-[10px] font-bold">{req.status}</Text>
                </View>
                <Text className="text-zinc-400 text-[11px] mt-0.5">
                  Req: {req.requestedQty} {req.unit} • Issued: {req.issuedQty || 0} • Returned: {req.returnedQty || 0}
                  {req.totalCost ? ` • PKR ${Number(req.totalCost).toLocaleString()}` : ""}
                </Text>
                <Text className="text-zinc-600 text-[10px]">
                  {req.requestedBy ? `Requested by ${req.requestedBy} • ` : ""}
                  {formatDateTime(req.createdAt)}
                  {req.issuedBy ? ` • Issued by ${req.issuedBy}` : ""}
                  {req.returnedBy ? ` • Returned by ${req.returnedBy}` : ""}
                </Text>

                {(canIssue || canReturn) && (
                  <View className="flex-row gap-2 mt-2">
                    {canIssue && (
                      <TouchableOpacity
                        onPress={() => setOpenReqAction(openReqAction === `issue-${req.id}` ? null : `issue-${req.id}`)}
                        className="bg-cyan-700 px-2.5 py-1.5 rounded-lg"
                      >
                        <Text className="text-white text-[10px] font-bold">Issue (Store Keeper)</Text>
                      </TouchableOpacity>
                    )}
                    {canReturn && (
                      <TouchableOpacity
                        onPress={() => setOpenReqAction(openReqAction === `return-${req.id}` ? null : `return-${req.id}`)}
                        className="bg-zinc-800 px-2.5 py-1.5 rounded-lg"
                      >
                        <Text className="text-zinc-200 text-[10px] font-bold">Return Unused</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {openReqAction === `issue-${req.id}` && (
                  <View className="flex-row gap-2 mt-2">
                    <TextInput
                      placeholder={`Qty (max ${req.requestedQty - (req.issuedQty || 0)})`}
                      placeholderTextColor="#71717A"
                      value={issueQty[req.id] || ""}
                      onChangeText={(t) => setIssueQty((m) => ({ ...m, [req.id]: t }))}
                      keyboardType="numeric"
                      className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
                    />
                    <TouchableOpacity
                      onPress={() => handleIssue(req)}
                      disabled={actionLoading}
                      className="bg-cyan-600 px-3 py-2 rounded-lg items-center justify-center"
                    >
                      <Text className="text-white text-xs font-bold">Issue</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {openReqAction === `return-${req.id}` && (
                  <View className="mt-2 space-y-2">
                    <View className="flex-row gap-2">
                      <TextInput
                        placeholder={`Return qty (max ${outstanding})`}
                        placeholderTextColor="#71717A"
                        value={returnQty[req.id] || ""}
                        onChangeText={(t) => setReturnQty((m) => ({ ...m, [req.id]: t }))}
                        keyboardType="numeric"
                        className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
                      />
                      <TextInput
                        placeholder="Reason *"
                        placeholderTextColor="#71717A"
                        value={returnReason[req.id] || ""}
                        onChangeText={(t) => setReturnReason((m) => ({ ...m, [req.id]: t }))}
                        className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => handleReturn(req)}
                      disabled={actionLoading}
                      className="bg-zinc-700 py-2 rounded-lg items-center"
                    >
                      <Text className="text-white text-xs font-bold">Confirm Return to Store</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text className="text-zinc-500 text-xs italic">No gas or materials requisitioned yet.</Text>
        )}

        {showRequest && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
            <OptionPicker
              label="ERP Product (optional — links stock & cost)"
              placeholder="Free-text item below, or pick a product"
              options={productOptions}
              value={productPick}
              onChange={pickProduct}
            />
            <TextInput
              placeholder="Item description * (e.g. R410A Refrigerant Gas)"
              placeholderTextColor="#71717A"
              value={matDesc}
              onChangeText={setMatDesc}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <View className="flex-row gap-2">
              <TextInput
                placeholder="Quantity *"
                placeholderTextColor="#71717A"
                value={matQty}
                onChangeText={setMatQty}
                keyboardType="numeric"
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
              <TextInput
                placeholder="Unit (kg / pcs / ft)"
                placeholderTextColor="#71717A"
                value={matUnit}
                onChangeText={setMatUnit}
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
            </View>
            <TouchableOpacity
              onPress={handleRequestMaterial}
              disabled={actionLoading}
              className="bg-[#0D7A5F] py-2 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-xs">Send Requisition to Store</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tools checked out to this job */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-cyan-400 text-[10px] uppercase font-bold mb-1">Tools on this Job Card</Text>
        {job.toolIssues && job.toolIssues.length > 0 ? (
          job.toolIssues.map((iss: any) => (
            <View key={iss.id} className="flex-row items-center justify-between bg-zinc-950 p-2 rounded-lg mt-1.5">
              <View className="flex-1 pr-2">
                <Text className="text-white text-xs font-semibold">
                  {iss.tool?.name || "Tool"} × {iss.quantity}
                </Text>
                <Text className="text-zinc-500 text-[10px]">
                  {iss.staffName} • {formatDateTime(iss.issuedAt)} • {iss.status}
                  {iss.returnCondition ? ` • ${iss.returnCondition}` : ""}
                </Text>
              </View>
              {iss.status === "issued" && !isClosed && (
                <TouchableOpacity
                  onPress={() => handleReturnTool(iss)}
                  disabled={actionLoading}
                  className="bg-zinc-800 px-2.5 py-1.5 rounded-lg"
                >
                  <Text className="text-zinc-200 text-[10px] font-bold">Return</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        ) : (
          <Text className="text-zinc-500 text-xs italic">No tools issued against this job. Issue from the Tools tab.</Text>
        )}
        {outstandingTools.length > 0 && (
          <Text className="text-amber-400 text-[10px] mt-1.5">
            ⚠ {outstandingTools.length} tool(s) still checked out — the Manager cannot close this card until they are returned.
          </Text>
        )}
      </View>

      {/* Step 7 — Testing */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-cyan-400 text-[10px] uppercase font-bold mb-1">Step 7: Testing (Pressure • Leak • Run)</Text>
        <View className="flex-row gap-3 my-1">
          <Text className="text-white text-xs font-bold font-mono">PSI: {job.testingPressurePsi ?? "—"}</Text>
          <Text className="text-white text-xs font-bold font-mono">
            Amps: {job.testingRunTestAmps != null ? `${job.testingRunTestAmps}A` : "—"}
          </Text>
          <Text className="text-white text-xs font-bold">Leak: {job.testingLeakTest || "—"}</Text>
        </View>
        <Text className="text-zinc-400 text-xs">{job.testingNotes || "Test results not logged yet."}</Text>
        {job.testedAt && (
          <Text className="text-zinc-600 text-[10px] mt-0.5">
            Tested {formatDateTime(job.testedAt)}{job.testedBy ? ` by ${job.testedBy}` : ""}
          </Text>
        )}

        {!isClosed && job.status !== "Completed" && (
          <TouchableOpacity onPress={openTest} className="mt-2.5 bg-zinc-800 py-2 rounded-xl items-center">
            <Text className="text-zinc-200 text-xs font-bold">Log / Update Test Results</Text>
          </TouchableOpacity>
        )}

        {showTest && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
            <View className="flex-row gap-2">
              <TextInput
                placeholder="Nitrogen PSI (measured)"
                placeholderTextColor="#71717A"
                value={testPsi}
                onChangeText={setTestPsi}
                keyboardType="numeric"
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg font-mono"
              />
              <TextInput
                placeholder="Running Amps (measured)"
                placeholderTextColor="#71717A"
                value={testAmps}
                onChangeText={setTestAmps}
                keyboardType="numeric"
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg font-mono"
              />
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-zinc-400 text-xs">Leak Test:</Text>
              {(["Pass", "Fail"] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setLeakResult(r)}
                  className={`px-3 py-1.5 rounded-lg ${leakResult === r ? (r === "Pass" ? "bg-emerald-600" : "bg-red-600") : "bg-zinc-800"}`}
                >
                  <Text className="text-white text-xs font-bold">{r}</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                placeholder="Detail (e.g. 400 PSI held 24h)"
                placeholderTextColor="#71717A"
                value={leakDetail}
                onChangeText={setLeakDetail}
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
            </View>
            <TextInput
              placeholder="Test observations (vacuum microns, delta-T, vibration…)"
              placeholderTextColor="#71717A"
              value={testNotes}
              onChangeText={setTestNotes}
              multiline
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <TouchableOpacity
              onPress={handleSaveTest}
              disabled={actionLoading}
              className="bg-cyan-600 py-2 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-xs">Save Test Results</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Scrap on this job */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-amber-400 text-[10px] uppercase font-bold">Scrap / Replaced Parts</Text>
          {!isClosed && (
            <TouchableOpacity onPress={() => setShowScrap(!showScrap)}>
              <Text className="text-amber-400 text-xs font-bold">+ Record Scrap</Text>
            </TouchableOpacity>
          )}
        </View>
        {job.scrapItems && job.scrapItems.length > 0 ? (
          job.scrapItems.map((s: any) => (
            <View key={s.id} className="flex-row items-center justify-between bg-zinc-950 p-2 rounded-lg mt-1.5">
              <View className="flex-1 pr-2">
                <Text className="text-white text-xs font-semibold">{s.itemDescription}</Text>
                <Text className="text-zinc-500 text-[10px]">
                  {s.quantity} {s.unit} • {formatDateTime(s.createdAt)}
                </Text>
              </View>
              <Text className={`text-[10px] font-bold ${s.customerKept ? "text-amber-300" : "text-zinc-400"}`}>
                {s.customerKept ? "Customer Retained" : s.status}
              </Text>
            </View>
          ))
        ) : (
          <Text className="text-zinc-500 text-xs italic">No replaced parts recorded yet.</Text>
        )}

        {showScrap && (
          <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
            <TextInput
              placeholder="Replaced part * (e.g. Burnt Compressor 1.5 Ton)"
              placeholderTextColor="#71717A"
              value={scrapDesc}
              onChangeText={setScrapDesc}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <View className="flex-row gap-2">
              <TextInput
                placeholder="Qty"
                placeholderTextColor="#71717A"
                value={scrapQty}
                onChangeText={setScrapQty}
                keyboardType="numeric"
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
              <TextInput
                placeholder="Unit (pcs / kg)"
                placeholderTextColor="#71717A"
                value={scrapUnit}
                onChangeText={setScrapUnit}
                className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
            </View>
            <TouchableOpacity onPress={() => setScrapCustomerKept(!scrapCustomerKept)} className="py-1">
              <Text className="text-zinc-400 text-xs">
                {scrapCustomerKept ? "✓ Customer is keeping the old part (noted on job card)" : "☐ Customer is keeping the old part"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRecordScrap}
              disabled={actionLoading}
              className="bg-amber-600 py-2 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-xs">Record Scrap Item</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Step 8 — Complete */}
      <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
        <Text className="text-emerald-400 text-[10px] uppercase font-bold mb-1">Step 8: Job Completion (Technician)</Text>
        {job.workDoneSummary ? (
          <View>
            <Text className="text-white text-xs">{job.workDoneSummary}</Text>
            <Text className="text-zinc-500 text-[10px] mt-1">
              Completed {formatDateTime(job.completedAt)}{job.completedBy ? ` by ${job.completedBy}` : ""}
            </Text>
          </View>
        ) : (
          <Text className="text-zinc-500 text-xs italic">Work not completed yet.</Text>
        )}

        {!job.workDoneSummary && !isClosed &&
          (workable ? (
            <>
              <TouchableOpacity
                onPress={() => setShowFinish(!showFinish)}
                className="mt-2.5 bg-emerald-600 py-2.5 rounded-xl items-center"
              >
                <Text className="text-white text-xs font-bold">Mark Work Completed</Text>
              </TouchableOpacity>
              {showFinish && (
                <View className="mt-3 p-3 bg-zinc-950 rounded-xl space-y-2 border border-zinc-800">
                  <TextInput
                    placeholder="Work Done Summary *"
                    placeholderTextColor="#71717A"
                    value={workDone}
                    onChangeText={setWorkDone}
                    multiline
                    className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
                  />
                  <TouchableOpacity
                    onPress={handleComplete}
                    disabled={actionLoading}
                    className="bg-emerald-600 py-2 rounded-lg items-center mt-1"
                  >
                    <Text className="text-white font-bold text-xs">Confirm Job Completion</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <Text className="text-amber-400/80 text-[11px] mt-2">
              Completion unlocks after Manager approval (current status: {job.status}).
            </Text>
          ))}
      </View>

      {/* Step 10 — Final check & close (Manager) */}
      {job.status === "Completed" && (
        <View className="bg-[#121215] border border-emerald-900 p-3.5 rounded-2xl mb-3">
          <Text className="text-emerald-400 text-[10px] uppercase font-bold mb-1">
            Step 10: Final Check & Close (Manager)
          </Text>
          <Text className="text-zinc-400 text-[11px]">
            Verify the work and material reconciliation, then close. The ERP blocks closing while
            requisitions are still pending at Store ({pendingReqs.length} pending) or tools are still
            checked out ({outstandingTools.length} out) — its message will be shown here if blocked.
          </Text>
          <View className="mt-3 space-y-2">
            <TextInput
              placeholder="Close notes (final check remarks)"
              placeholderTextColor="#71717A"
              value={closeNotes}
              onChangeText={setCloseNotes}
              className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
            />
            <View className="flex-row items-center gap-2">
              <Text className="text-zinc-400 text-xs">Delivery:</Text>
              {(
                [
                  { v: "ready_for_delivery", label: "Ready for Delivery" },
                  { v: "delivered", label: "Delivered" },
                ] as const
              ).map((o) => (
                <TouchableOpacity
                  key={o.v}
                  onPress={() => setDeliveryStatus(o.v)}
                  className={`px-3 py-1.5 rounded-lg ${deliveryStatus === o.v ? "bg-emerald-600" : "bg-zinc-800"}`}
                >
                  <Text className="text-white text-xs font-bold">{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {deliveryStatus === "delivered" && (
              <TextInput
                placeholder="Delivered to (name)"
                placeholderTextColor="#71717A"
                value={deliveredTo}
                onChangeText={setDeliveredTo}
                className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
              />
            )}
            <TouchableOpacity
              onPress={handleClose}
              disabled={actionLoading}
              className="bg-emerald-600 py-2.5 rounded-xl items-center"
            >
              <Text className="text-white text-xs font-bold">Close Job Card</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isClosed && (
        <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
          <Text className="text-zinc-300 text-xs font-bold">Job Card Closed</Text>
          <Text className="text-zinc-500 text-[11px] mt-1">
            Closed {formatDateTime(job.closedAt)}{job.closedBy ? ` by ${job.closedBy}` : ""}
            {job.deliveryStatus ? ` • Delivery: ${job.deliveryStatus}` : ""}
            {job.deliveredTo ? ` • To: ${job.deliveredTo}` : ""}
          </Text>
          {!!job.closeNotes && <Text className="text-zinc-400 text-xs mt-1">{job.closeNotes}</Text>}
        </View>
      )}

      {/* Status history */}
      {job.statusLogs && job.statusLogs.length > 0 && (
        <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-8">
          <Text className="text-zinc-400 text-[10px] uppercase font-bold mb-1.5">Job Status History</Text>
          {job.statusLogs.map((log: any) => (
            <View key={log.id} className="py-1.5 border-b border-zinc-800/60">
              <Text className="text-zinc-200 text-xs font-semibold">
                {log.fromStatus} → {log.toStatus}
                <Text className="text-zinc-500 font-normal"> • {formatDateTime(log.changedAt)}</Text>
              </Text>
              {!!log.notes && <Text className="text-zinc-500 text-[11px]">{log.notes}</Text>}
              {!!log.changedBy && <Text className="text-zinc-600 text-[10px]">by {log.changedBy}</Text>}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
