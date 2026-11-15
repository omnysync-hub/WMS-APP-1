import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Wrench, AlertCircle } from "lucide-react-native";
import { WorkshopBikesApi, apiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { SearchPicker, type PickerItem } from "@/components/SearchPicker";
import { canDo, formatDateTime } from "@/lib/workshop";

const RETURN_CONDITIONS = ["Operational", "Damaged", "Under Repair", "Lost"] as const;

/**
 * Workshop Tools Register (SOP):
 * register tools, issue to a mechanic (against a job card or for the day),
 * return with a condition check, damaged/lost recorded with a reason,
 * and a monthly count / audit.
 */
export default function BikeToolsScreen() {
  const employee = useAuthStore((s) => s.employee);
  const role = useAuthStore((s) => s.workshopRole);
  const myName = employee?.name || "Workshop User";

  const [tools, setTools] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [jobs, setJobs] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Register tool form
  const [showCreate, setShowCreate] = useState(false);
  const [toolCode, setToolCode] = useState("");
  const [toolName, setToolName] = useState("");
  const [toolCategory, setToolCategory] = useState("Hand Tools");
  const [toolQty, setToolQty] = useState("1");
  const [toolLocation, setToolLocation] = useState("");

  // Issue form (per tool): optional job link
  const [issueJob, setIssueJob] = useState<Record<string, string | null>>({});

  // Return form (per issue): condition + notes
  const [returnState, setReturnState] = useState<Record<string, { condition: string; notes: string; open: boolean }>>({});

  // Audit form
  const [showAudit, setShowAudit] = useState(false);
  const [auditCounted, setAuditCounted] = useState("");
  const [auditDiscrepancy, setAuditDiscrepancy] = useState("0");
  const [auditVerifiedBy, setAuditVerifiedBy] = useState("");
  const [auditNotes, setAuditNotes] = useState("");

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [toolsRes, auditsRes, jobsRes] = await Promise.all([
        WorkshopBikesApi.getTools(),
        WorkshopBikesApi.getToolAudits().catch(() => null),
        WorkshopBikesApi.getJobs({ status: undefined }).catch(() => null),
      ]);
      if (toolsRes.success) setTools(toolsRes.data || []);
      else setError(toolsRes.error || "Failed to load tools.");
      if (auditsRes?.success) setAudits(auditsRes.data || []);
      if (jobsRes?.success) {
        setJobs(
          (jobsRes.data || [])
            .filter((j: any) => !["Closed", "Rejected"].includes(j.status))
            .map((j: any) => ({
              id: j.id,
              label: `${j.jobNumber} — ${j.bikeRegNo || ""}`,
              sub: j.customerName || undefined,
            }))
        );
      }
    } catch (e: any) {
      setError(apiErrorMessage(e, "Failed to load tools."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const totalToolQty = tools.reduce((sum, t) => sum + (t.totalQuantity || 0), 0);

  const handleIssue = async (tool: any) => {
    if (tool.availableQuantity <= 0) {
      Alert.alert("Unavailable", "No units of this tool are available in the register.");
      return;
    }
    setBusy(`issue-${tool.id}`);
    try {
      const res = await WorkshopBikesApi.issueTool(
        tool.id,
        myName,
        1,
        issueJob[tool.id] || undefined,
        employee?.id
      );
      if (res.success) {
        Alert.alert("Checked Out", `${tool.name} issued to ${myName}${issueJob[tool.id] ? " against the selected job card" : " for the day"}.`);
        loadAll();
      } else {
        Alert.alert("Server Message", res.error || "Could not issue this tool.");
      }
    } catch (e: any) {
      Alert.alert("Server Message", apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const handleReturn = async (issue: any) => {
    const state = returnState[issue.id] || { condition: "Operational", notes: "", open: false };
    if (state.condition !== "Operational" && !state.notes.trim()) {
      Alert.alert("Reason Required", "For Damaged / Under Repair / Lost returns, enter the reason in the notes.");
      return;
    }
    setBusy(`return-${issue.id}`);
    try {
      const res = await WorkshopBikesApi.returnTool(issue.id, state.condition, state.notes.trim() || undefined);
      if (res.success) {
        Alert.alert("Checked In", `Tool returned with condition: ${state.condition}.`);
        loadAll();
      } else {
        Alert.alert("Server Message", res.error || "Could not return this tool.");
      }
    } catch (e: any) {
      Alert.alert("Server Message", apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = async () => {
    if (!toolCode.trim() || !toolName.trim() || !toolCategory.trim()) {
      Alert.alert("Required", "Tool Code, Name and Category are required.");
      return;
    }
    setBusy("create");
    try {
      const res = await WorkshopBikesApi.createTool({
        toolCode: toolCode.trim(),
        name: toolName.trim(),
        category: toolCategory.trim(),
        totalQuantity: Number(toolQty) || 1,
        location: toolLocation.trim() || undefined,
      });
      if (res.success) {
        Alert.alert("Registered", `${res.data.toolCode} added to the tool register.`);
        setShowCreate(false);
        setToolCode("");
        setToolName("");
        loadAll();
      } else {
        Alert.alert("Server Message", res.error || "Could not register this tool.");
      }
    } catch (e: any) {
      Alert.alert("Server Message", apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const handleAudit = async () => {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    setBusy("audit");
    try {
      const res = await WorkshopBikesApi.auditTools({
        auditMonth: month,
        totalToolsCounted: Number(auditCounted) || 0,
        discrepancyCount: Number(auditDiscrepancy) || 0,
        verifiedBy: auditVerifiedBy.trim() || undefined,
        notes: auditNotes.trim() || undefined,
      });
      if (res.success) {
        Alert.alert("Audit Recorded", `Monthly tool count for ${month} saved.`);
        setShowAudit(false);
        loadAll();
      } else {
        Alert.alert("Server Message", res.error || "Could not record the audit.");
      }
    } catch (e: any) {
      Alert.alert("Server Message", apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="flex-1 bg-[#09090B] p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-white text-base font-extrabold mb-1">Bike Workshop Tool Register</Text>
          <Text className="text-zinc-400 text-xs mb-3">
            Check tools out against a job card or for the day. Returns need a condition check.
          </Text>
        </View>
        {canDo(role, "tool_create") && (
          <TouchableOpacity onPress={() => setShowCreate(!showCreate)} className="bg-[#0D7A5F] px-3 py-2 rounded-xl">
            <Text className="text-white text-xs font-bold">+ Register</Text>
          </TouchableOpacity>
        )}
      </View>

      {showCreate && (
        <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
          <Text className="text-white text-sm font-bold mb-2">Register New Tool</Text>
          <View className="flex-row gap-2">
            <TextInput placeholder="Tool Code *" placeholderTextColor="#71717A" value={toolCode} onChangeText={setToolCode} autoCapitalize="characters" className="flex-1 bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl" />
            <TextInput placeholder="Qty" placeholderTextColor="#71717A" value={toolQty} onChangeText={setToolQty} keyboardType="numeric" className="w-16 bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl" />
          </View>
          <TextInput placeholder="Tool Name *" placeholderTextColor="#71717A" value={toolName} onChangeText={setToolName} className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl mt-2" />
          <View className="flex-row gap-2 mt-2">
            <TextInput placeholder="Category *" placeholderTextColor="#71717A" value={toolCategory} onChangeText={setToolCategory} className="flex-1 bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl" />
            <TextInput placeholder="Location" placeholderTextColor="#71717A" value={toolLocation} onChangeText={setToolLocation} className="flex-1 bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl" />
          </View>
          <TouchableOpacity onPress={handleCreate} disabled={busy === "create"} className="bg-amber-500 py-2.5 rounded-xl items-center mt-3">
            <Text className="text-black font-bold text-xs">{busy === "create" ? "Saving..." : "Add to Register"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {canDo(role, "tool_audit") && (
        <TouchableOpacity onPress={() => { setAuditCounted(String(totalToolQty)); setShowAudit(!showAudit); }} className="bg-[#121215] border border-[#27272A] py-2.5 rounded-xl items-center mb-3">
          <Text className="text-zinc-200 text-xs font-bold">Monthly Tool Count / Audit</Text>
        </TouchableOpacity>
      )}
      {showAudit && (
        <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
          <Text className="text-white text-sm font-bold mb-1">Tool Audit — {new Date().toISOString().slice(0, 7)}</Text>
          <Text className="text-zinc-500 text-[11px] mb-2">Counted by {myName}. Register total: {totalToolQty} units across {tools.length} tools.</Text>
          <View className="flex-row gap-2">
            <TextInput placeholder="Total counted" placeholderTextColor="#71717A" value={auditCounted} onChangeText={setAuditCounted} keyboardType="numeric" className="flex-1 bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl" />
            <TextInput placeholder="Discrepancies" placeholderTextColor="#71717A" value={auditDiscrepancy} onChangeText={setAuditDiscrepancy} keyboardType="numeric" className="flex-1 bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl" />
          </View>
          <TextInput placeholder="Verified by (name)" placeholderTextColor="#71717A" value={auditVerifiedBy} onChangeText={setAuditVerifiedBy} className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl mt-2" />
          <TextInput placeholder="Notes (missing / damaged items...)" placeholderTextColor="#71717A" value={auditNotes} onChangeText={setAuditNotes} className="bg-[#18181B] border border-[#27272A] text-white text-xs px-3 py-2 rounded-xl mt-2" />
          <TouchableOpacity onPress={handleAudit} disabled={busy === "audit"} className="bg-amber-500 py-2.5 rounded-xl items-center mt-3">
            <Text className="text-black font-bold text-xs">{busy === "audit" ? "Saving..." : "Save Audit"}</Text>
          </TouchableOpacity>
          {audits.length > 0 && (
            <View className="mt-3 pt-2 border-t border-zinc-800">
              <Text className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Previous Audits</Text>
              {audits.slice(0, 3).map((a) => (
                <Text key={a.id} className="text-zinc-400 text-[11px]">
                  {a.auditMonth} • Counted {a.totalToolsCounted} • Discrepancies {a.discrepancyCount} • by {a.countedBy}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F59E0B" size="large" />
          <Text className="text-zinc-500 text-xs mt-2">Loading tool register...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <AlertCircle color="#F87171" size={32} />
          <Text className="text-red-300 text-sm font-bold mt-3 text-center">Could not load tools</Text>
          <Text className="text-zinc-500 text-xs mt-1 text-center">{error}</Text>
          <TouchableOpacity onPress={loadAll} className="bg-amber-500 px-4 py-2 rounded-xl mt-4">
            <Text className="text-black text-xs font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tools}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#F59E0B" />}
          ListEmptyComponent={
            <View className="py-12 items-center justify-center border border-dashed border-zinc-800 rounded-2xl">
              <Wrench color="#71717A" size={32} />
              <Text className="text-zinc-500 text-xs mt-2">No tools in the register yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl mb-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-amber-400 font-mono text-xs font-bold">{item.toolCode}</Text>
                <Text className={`text-xs font-bold ${item.condition === "Operational" ? "text-emerald-400" : "text-red-400"}`}>
                  {item.condition}
                </Text>
              </View>

              <Text className="text-white text-sm font-bold mt-1">{item.name}</Text>
              <Text className="text-zinc-500 text-xs">
                {item.category} • Location: {item.location || "Workshop"}
              </Text>

              <View className="flex-row justify-between bg-[#18181B] p-2 rounded-xl mt-3">
                <Text className="text-zinc-400 text-xs">Total: {item.totalQuantity}</Text>
                <Text className="text-emerald-400 text-xs font-bold">Available: {item.availableQuantity}</Text>
              </View>

              {/* Active issues with condition-checked returns */}
              {item.issues && item.issues.length > 0 && (
                <View className="mt-2.5 pt-2 border-t border-zinc-800">
                  <Text className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Active Check-Outs:</Text>
                  {item.issues.map((iss: any) => {
                    const rs = returnState[iss.id] || { condition: "Operational", notes: "", open: false };
                    return (
                      <View key={iss.id} className="bg-zinc-950 p-2 rounded-lg mb-1.5">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-white text-xs flex-1 pr-2">
                            {iss.staffName} (Qty: {iss.quantity})
                            {iss.jobCard ? ` • ${iss.jobCard.jobNumber}` : " • for the day"}
                          </Text>
                          <TouchableOpacity
                            onPress={() =>
                              setReturnState((s) => ({ ...s, [iss.id]: { ...rs, open: !rs.open } }))
                            }
                            className="bg-zinc-800 px-2.5 py-1 rounded-lg"
                          >
                            <Text className="text-zinc-300 text-[10px] font-bold">Return</Text>
                          </TouchableOpacity>
                        </View>
                        <Text className="text-zinc-600 text-[10px] mt-0.5">
                          Issued {formatDateTime(iss.issuedAt)} by {iss.issuedBy || "-"}
                        </Text>
                        {rs.open && (
                          <View className="mt-2">
                            <View className="flex-row flex-wrap gap-1.5">
                              {RETURN_CONDITIONS.map((c) => (
                                <TouchableOpacity
                                  key={c}
                                  onPress={() =>
                                    setReturnState((s) => ({ ...s, [iss.id]: { ...rs, condition: c } }))
                                  }
                                  className={`px-2 py-1 rounded-lg ${rs.condition === c ? "bg-amber-500" : "bg-zinc-800"}`}
                                >
                                  <Text className={`text-[10px] font-bold ${rs.condition === c ? "text-black" : "text-zinc-300"}`}>
                                    {c}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            <TextInput
                              placeholder={rs.condition === "Operational" ? "Notes (optional)" : "Reason (required for Damaged / Under Repair / Lost)"}
                              placeholderTextColor="#71717A"
                              value={rs.notes}
                              onChangeText={(t) =>
                                setReturnState((s) => ({ ...s, [iss.id]: { ...rs, notes: t } }))
                              }
                              className="bg-[#18181B] text-white text-xs p-2 rounded-lg mt-2"
                            />
                            <TouchableOpacity
                              onPress={() => handleReturn(iss)}
                              disabled={busy === `return-${iss.id}`}
                              className="bg-emerald-600 py-2 rounded-lg items-center mt-2"
                            >
                              <Text className="text-white font-bold text-xs">
                                {busy === `return-${iss.id}` ? "Returning..." : "Confirm Return"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Issue: optional job link + checkout */}
              <View className="mt-3">
                <SearchPicker
                  placeholder="Link to a job card (optional)..."
                  items={jobs}
                  selectedId={issueJob[item.id] || null}
                  emptyText="No active job cards"
                  onSelect={(picked) =>
                    setIssueJob((s) => ({ ...s, [item.id]: s[item.id] === picked.id ? null : picked.id }))
                  }
                />
              </View>
              <TouchableOpacity
                onPress={() => handleIssue(item)}
                disabled={item.availableQuantity <= 0 || busy === `issue-${item.id}`}
                className={`mt-2.5 py-2 rounded-xl items-center ${
                  item.availableQuantity > 0 ? "bg-amber-500" : "bg-zinc-800 opacity-40"
                }`}
              >
                <Text className="text-black font-bold text-xs">
                  {busy === `issue-${item.id}` ? "Checking Out..." : `Check Out to ${myName.split(" ")[0]}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}
