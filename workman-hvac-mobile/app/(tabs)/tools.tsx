import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { Wrench } from "lucide-react-native";
import { WorkshopHvacApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import OptionPicker, { type PickerOption } from "@/components/OptionPicker";
import { formatDateTime } from "@/components/jobUi";

const RETURN_CONDITIONS = ["Operational", "Damaged", "Under Repair", "Lost"] as const;
type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export default function HvacToolsScreen() {
  const employee = useAuthStore((s) => s.employee);
  const techName = employee?.name || "Technician";
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Register form
  const [showCreate, setShowCreate] = useState(false);
  const [toolCode, setToolCode] = useState("");
  const [toolName, setToolName] = useState("");
  const [toolCategory, setToolCategory] = useState("");
  const [toolQty, setToolQty] = useState("1");
  const [toolLocation, setToolLocation] = useState("");

  // Issue: optional job card link
  const [jobOptions, setJobOptions] = useState<PickerOption[]>([]);
  const [issueJob, setIssueJob] = useState<Record<string, PickerOption | null>>({});

  // Return panel state per issue
  const [returnOpen, setReturnOpen] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState<ReturnCondition>("Operational");
  const [returnNotes, setReturnNotes] = useState("");

  // Monthly audit
  const [showAudit, setShowAudit] = useState(false);
  const [auditCounted, setAuditCounted] = useState("");
  const [auditDiscrepancies, setAuditDiscrepancies] = useState("0");
  const [auditVerifiedBy, setAuditVerifiedBy] = useState("");
  const [auditNotes, setAuditNotes] = useState("");
  const [audits, setAudits] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [toolsRes, jobsRes, auditsRes] = await Promise.all([
        WorkshopHvacApi.getTools(),
        WorkshopHvacApi.getJobs({ status: "In Progress" }),
        WorkshopHvacApi.getToolAudits().catch(() => null),
      ]);
      if (toolsRes.success) setTools(toolsRes.data || []);
      if (jobsRes?.success) {
        setJobOptions(
          (jobsRes.data || []).map((j: any) => ({
            id: j.id,
            label: `${j.jobNumber} — ${j.brandModel}`,
            sub: j.customerSite || j.customerName || "",
          }))
        );
      }
      if (auditsRes?.success) setAudits(auditsRes.data || []);
    } catch (e: any) {
      setError(e?.message || "Could not load the tools register");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const run = async (fn: () => Promise<any>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res && res.success === false) {
        Alert.alert("Blocked", res.error || "Action rejected by the server.");
        return false;
      }
      Alert.alert("Done", successMsg);
      await loadAll();
      return true;
    } catch (e: any) {
      Alert.alert("Blocked", e?.message || "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!toolCode.trim() || !toolName.trim() || !toolCategory.trim()) {
      Alert.alert("Required", "Tool Code, Name, and Category are required to register a tool.");
      return;
    }
    const ok = await run(
      () =>
        WorkshopHvacApi.createTool({
          toolCode: toolCode.trim(),
          name: toolName.trim(),
          category: toolCategory.trim(),
          totalQuantity: Number(toolQty) || 1,
          location: toolLocation.trim() || undefined,
        }),
      `${toolName.trim()} added to the HVAC tools register.`
    );
    if (ok) {
      setShowCreate(false);
      setToolCode("");
      setToolName("");
      setToolCategory("");
      setToolQty("1");
      setToolLocation("");
    }
  };

  const handleIssue = async (tool: any) => {
    if (tool.availableQuantity <= 0) {
      Alert.alert("Unavailable", "Equipment is currently checked out.");
      return;
    }
    const job = issueJob[tool.id];
    await run(
      () => WorkshopHvacApi.issueTool(tool.id, techName, 1, job?.id, { staffId: employee?.id }),
      job
        ? `${tool.name} checked out to ${techName} against ${job.label.split(" — ")[0]}`
        : `${tool.name} checked out to ${techName} for the day`
    );
  };

  const handleReturn = async (issueId: string) => {
    if (returnCondition !== "Operational" && !returnNotes.trim()) {
      Alert.alert("Reason Required", "Damaged / Under Repair / Lost returns need a note explaining what happened.");
      return;
    }
    const ok = await run(
      () => WorkshopHvacApi.returnTool(issueId, returnCondition, returnNotes.trim() || undefined),
      returnCondition === "Operational"
        ? "Equipment returned in operational condition."
        : `Return recorded as ${returnCondition}. The register has been updated.`
    );
    if (ok) {
      setReturnOpen(null);
      setReturnCondition("Operational");
      setReturnNotes("");
    }
  };

  const auditMonth = new Date().toISOString().slice(0, 7);
  const handleAudit = async () => {
    if (!auditCounted || Number(auditCounted) < 0) {
      Alert.alert("Required", "Enter how many tools were physically counted this month.");
      return;
    }
    const ok = await run(
      () =>
        WorkshopHvacApi.auditTools({
          auditMonth,
          totalToolsCounted: Number(auditCounted),
          discrepancyCount: Number(auditDiscrepancies) || 0,
          verifiedBy: auditVerifiedBy.trim() || undefined,
          notes: auditNotes.trim() || undefined,
        }),
      `Monthly tool audit for ${auditMonth} recorded.`
    );
    if (ok) setShowAudit(false);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#09090B] items-center justify-center">
        <ActivityIndicator color="#06B6D4" size="large" />
        <Text className="text-zinc-500 text-xs mt-2">Loading tools register…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-white text-base font-extrabold mb-1">HVAC Specialized Equipment Register</Text>
          <Text className="text-zinc-400 text-xs mb-3">
            Vacuum pumps, manifold gauges, recovery units — issued against a job card or for the
            day, signed for by {techName}, returned with a condition check.
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowCreate(!showCreate)} className="bg-cyan-500 px-3 py-2 rounded-xl">
          <Text className="text-black text-xs font-bold">+ Register</Text>
        </TouchableOpacity>
      </View>

      {showCreate && (
        <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3 space-y-2">
          <Text className="text-white text-xs font-bold">Register New Tool / Equipment</Text>
          <View className="flex-row gap-2">
            <TextInput placeholder="Tool Code * (e.g. HVAC-VP-01)" placeholderTextColor="#71717A" value={toolCode} onChangeText={setToolCode} autoCapitalize="characters" className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg font-mono" />
            <TextInput placeholder="Qty *" placeholderTextColor="#71717A" value={toolQty} onChangeText={setToolQty} keyboardType="numeric" className="w-20 bg-[#18181B] text-white text-xs p-2 rounded-lg" />
          </View>
          <TextInput placeholder="Name * (e.g. Vacuum Pump 2-Stage)" placeholderTextColor="#71717A" value={toolName} onChangeText={setToolName} className="bg-[#18181B] text-white text-xs p-2 rounded-lg" />
          <TextInput placeholder="Category * (e.g. Testing / Recovery / Hand Tools)" placeholderTextColor="#71717A" value={toolCategory} onChangeText={setToolCategory} className="bg-[#18181B] text-white text-xs p-2 rounded-lg" />
          <TextInput placeholder="Location (e.g. Bench Rig #1 Shelf)" placeholderTextColor="#71717A" value={toolLocation} onChangeText={setToolLocation} className="bg-[#18181B] text-white text-xs p-2 rounded-lg" />
          <TouchableOpacity onPress={handleCreate} disabled={busy} className="bg-cyan-500 py-2 rounded-lg items-center">
            <Text className="text-black font-bold text-xs">Add to Register</Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-400 text-xs text-center">{error}</Text>
          <TouchableOpacity onPress={loadAll} className="bg-cyan-500 px-4 py-2 rounded-xl mt-3">
            <Text className="text-black text-xs font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tools}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#06B6D4" />}
          ListEmptyComponent={
            <View className="py-12 items-center justify-center border border-dashed border-zinc-800 rounded-2xl">
              <Wrench color="#71717A" size={32} />
              <Text className="text-zinc-500 text-xs mt-2">No tools in the HVAC register yet</Text>
              <Text className="text-zinc-600 text-[10px] mt-1">Use “+ Register” to add the first tool.</Text>
            </View>
          }
          ListFooterComponent={
            <View className="mt-2 mb-6">
              <TouchableOpacity onPress={() => { setAuditCounted(String(tools.reduce((s, t) => s + (t.totalQuantity || 0), 0))); setShowAudit(!showAudit); }} className="bg-[#121215] border border-[#27272A] py-2.5 rounded-xl items-center">
                <Text className="text-zinc-200 text-xs font-bold">Monthly Count / Audit ({auditMonth})</Text>
              </TouchableOpacity>
              {showAudit && (
                <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mt-2 space-y-2">
                  <View className="flex-row gap-2">
                    <TextInput placeholder="Tools counted *" placeholderTextColor="#71717A" value={auditCounted} onChangeText={setAuditCounted} keyboardType="numeric" className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg" />
                    <TextInput placeholder="Discrepancies" placeholderTextColor="#71717A" value={auditDiscrepancies} onChangeText={setAuditDiscrepancies} keyboardType="numeric" className="flex-1 bg-[#18181B] text-white text-xs p-2 rounded-lg" />
                  </View>
                  <TextInput placeholder="Verified by (Manager name)" placeholderTextColor="#71717A" value={auditVerifiedBy} onChangeText={setAuditVerifiedBy} className="bg-[#18181B] text-white text-xs p-2 rounded-lg" />
                  <TextInput placeholder="Notes (missing/damaged items…)" placeholderTextColor="#71717A" value={auditNotes} onChangeText={setAuditNotes} className="bg-[#18181B] text-white text-xs p-2 rounded-lg" />
                  <TouchableOpacity onPress={handleAudit} disabled={busy} className="bg-cyan-500 py-2 rounded-lg items-center">
                    <Text className="text-black font-bold text-xs">Record Audit</Text>
                  </TouchableOpacity>
                </View>
              )}
              {audits.length > 0 && (
                <View className="mt-3">
                  <Text className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Recent Audits</Text>
                  {audits.slice(0, 3).map((a) => (
                    <Text key={a.id} className="text-zinc-400 text-[11px]">
                      {a.auditMonth} • counted {a.totalToolsCounted} • discrepancies {a.discrepancyCount} • by {a.countedBy}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-cyan-400 font-mono text-xs font-bold">{item.toolCode}</Text>
                <Text className={`text-xs font-bold ${item.condition === "Operational" ? "text-emerald-400" : "text-amber-400"}`}>
                  {item.condition}
                </Text>
              </View>

              <Text className="text-white text-sm font-bold mt-1">{item.name}</Text>
              <Text className="text-zinc-500 text-xs">{item.category} • Location: {item.location || "—"}</Text>
              {!!item.conditionNotes && item.condition !== "Operational" && (
                <Text className="text-amber-400/80 text-[11px] mt-0.5">{item.conditionNotes}</Text>
              )}

              <View className="flex-row justify-between bg-[#18181B] p-2 rounded-xl mt-3">
                <Text className="text-zinc-400 text-xs">Total: {item.totalQuantity}</Text>
                <Text className="text-emerald-400 text-xs font-bold">Available: {item.availableQuantity}</Text>
              </View>

              {/* Active issues */}
              {item.issues && item.issues.length > 0 && (
                <View className="mt-2.5 pt-2 border-t border-zinc-800">
                  <Text className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Active Check-Outs:</Text>
                  {item.issues.map((iss: any) => (
                    <View key={iss.id} className="bg-zinc-950 p-2 rounded-lg mb-1.5">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-2">
                          <Text className="text-white text-xs">{iss.staffName} (Qty: {iss.quantity})</Text>
                          <Text className="text-zinc-500 text-[10px]">
                            {formatDateTime(iss.issuedAt)}
                            {iss.jobCard?.jobNumber ? ` • Job ${iss.jobCard.jobNumber}` : " • For the day"}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => { setReturnOpen(returnOpen === iss.id ? null : iss.id); setReturnCondition("Operational"); setReturnNotes(""); }}
                          className="bg-zinc-800 px-2.5 py-1.5 rounded-lg"
                        >
                          <Text className="text-zinc-300 text-[10px] font-bold">Return</Text>
                        </TouchableOpacity>
                      </View>
                      {returnOpen === iss.id && (
                        <View className="mt-2 space-y-2">
                          <View className="flex-row flex-wrap gap-1.5">
                            {RETURN_CONDITIONS.map((c) => (
                              <TouchableOpacity
                                key={c}
                                onPress={() => setReturnCondition(c)}
                                className={`px-2.5 py-1.5 rounded-lg ${returnCondition === c ? (c === "Operational" ? "bg-emerald-600" : "bg-red-600") : "bg-zinc-800"}`}
                              >
                                <Text className="text-white text-[10px] font-bold">{c}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TextInput
                            placeholder={returnCondition === "Operational" ? "Return notes (optional)" : "Reason * (what happened)"}
                            placeholderTextColor="#71717A"
                            value={returnNotes}
                            onChangeText={setReturnNotes}
                            className="bg-[#18181B] text-white text-xs p-2 rounded-lg"
                          />
                          <TouchableOpacity onPress={() => handleReturn(iss.id)} disabled={busy} className="bg-cyan-600 py-2 rounded-lg items-center">
                            <Text className="text-white text-xs font-bold">Confirm Return — {returnCondition}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <View className="mt-3">
                <OptionPicker
                  label="Issue against Job Card (optional)"
                  placeholder="For the day (no job card)"
                  options={jobOptions}
                  value={issueJob[item.id] || null}
                  onChange={(opt) => setIssueJob((m) => ({ ...m, [item.id]: opt }))}
                />
              </View>

              <TouchableOpacity
                onPress={() => handleIssue(item)}
                disabled={item.availableQuantity <= 0 || busy}
                className={`mt-3 py-2 rounded-xl items-center ${
                  item.availableQuantity > 0 ? "bg-cyan-500" : "bg-zinc-800 opacity-40"
                }`}
              >
                <Text className="text-black font-bold text-xs">Check Out Equipment</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}
