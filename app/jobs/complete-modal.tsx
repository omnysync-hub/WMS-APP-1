import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  Modal,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Banknote, Camera, Check, CheckCircle2, ImagePlus, Minus, Plus, Search, Wrench, X } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { addJobServices, fetchCatalogServices, fetchJob, returnJobStock, transitionJob } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors, radius, space, tapMin, type } from "@/constants/theme";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";
import { formatMoney, parseJobLine, calculateJobBilling } from "@/lib/jobLineFormat";
import { noCollectionCopy, technicianCollects } from "@/lib/jobCollection";
import type { JobItem } from "@/types";

const PAYMENTS = [
  { id: "cash", label: "Cash" },
  { id: "online", label: "Online" },
  { id: "cheque", label: "Cheque" },
  { id: "unmarked", label: "No payment" },
] as const;

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 2_000_000;
const MAX_ENCODED_PHOTO_CHARS = 8_000_000;

async function uriToDataUrl(uri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists && typeof info.size === "number" && info.size > MAX_PHOTO_BYTES) {
    throw new Error("A photo is too large. Choose a smaller image or retake it.");
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const lower = uri.toLowerCase();
  const mime = lower.includes(".png")
    ? "image/png"
    : lower.includes(".webp")
      ? "image/webp"
      : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

export default function CompleteModal() {
  const { jobId, itemsJson } = useLocalSearchParams<{
    jobId: string;
    itemsJson?: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const actor = employee?.name ?? "Technician";

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    enabled: Boolean(jobId),
    queryFn: () => fetchJob(jobId!),
  });
  const [items, setItems] = useState<JobItem[]>([]);
  const [remarks, setRemarks] = useState("");
  const [paymentMeans, setPaymentMeans] =
    useState<(typeof PAYMENTS)[number]["id"]>("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [unusedReason, setUnusedReason] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const itemsInitializedRef = useRef(false);
  const catalogQuery = useQuery({
    queryKey: ["catalog-services"],
    queryFn: fetchCatalogServices,
  });
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedServices, setSelectedServices] = useState<
    Array<{ id: string; name: string; unitPrice: number; qty: number }>
  >([]);

  const openServicePicker = () => {
    setSelectedServices([]);
    setServiceSearch("");
    setShowServicePicker(true);
  };

  const toggleSelectCatalogService = (svc: { id: string; name: string; unitPrice?: number }) => {
    void haptic.select();
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === svc.id);
      if (exists) {
        return prev.filter((s) => s.id !== svc.id);
      }
      return [
        ...prev,
        {
          id: svc.id,
          name: svc.name,
          unitPrice: Number(svc.unitPrice) || 0,
          qty: 1,
        },
      ];
    });
  };

  const updateSelectedServiceQty = (svcId: string, delta: number) => {
    void haptic.select();
    setSelectedServices((prev) =>
      prev.map((s) => {
        if (s.id !== svcId) return s;
        return { ...s, qty: Math.max(1, s.qty + delta) };
      })
    );
  };

  const handleConfirmSelectedServices = () => {
    if (selectedServices.length === 0) {
      setShowServicePicker(false);
      return;
    }
    const newItems: JobItem[] = selectedServices.map((svc) => ({
      id: `srv_local_${svc.id}_${Date.now()}`,
      name: svc.name,
      description: `[Service] ${svc.name}`,
      quantityPlanned: svc.qty,
      quantityActual: svc.qty,
      unitRate: svc.unitPrice,
      unitPrice: svc.unitPrice,
      isService: true,
    }));
    setItems((prev) => [...prev, ...newItems]);
    setShowServicePicker(false);
    toast(`${selectedServices.length} service(s) added`, "success");
  };

  useEffect(() => {
    if (!itemsInitializedRef.current) {
      if (itemsJson) {
        try {
          const parsed = JSON.parse(itemsJson) as JobItem[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
            itemsInitializedRef.current = true;
            return;
          }
        } catch {
          /* fallback to query */
        }
      }
      if (jobQuery.fetchStatus === "idle" && jobQuery.data?.items) {
        setItems(jobQuery.data.items);
        itemsInitializedRef.current = true;
      }
    }
  }, [itemsJson, jobQuery.data?.items, jobQuery.fetchStatus]);

  const billingSummary = useMemo(() => {
    return calculateJobBilling(jobQuery.data ?? {}, items);
  }, [items, jobQuery.data]);

  // FOC / office-collected jobs: technician collects nothing (cash entry hidden, server enforces too)
  const collects = technicianCollects(jobQuery.data);
  const numericReceived = Number(paymentAmount) || 0;
  const paymentDiff = numericReceived - billingSummary.netTotal;

  const mutation = useMutation({
    mutationFn: async () => {
      if (photoUris.length === 0) {
        throw new Error("Add at least one proof photo of the finished work.");
      }
      let hasUnused = false;
      for (const it of items) {
        const line = parseJobLine(it);
        if (line.isService) continue;
        const planned = Number(it.quantityPlanned ?? 0);
        const actual = Number(it.quantityActual ?? 0);
        if (!Number.isFinite(actual) || actual < 0 || actual > planned) {
          throw new Error(`${line.title}: used quantity must be between 0 and ${planned}.`);
        }
        const unused = Math.max(0, planned - actual);
        if (unused > 0) {
          hasUnused = true;
          if (!employee?.id) throw new Error("Not signed in");
          if (!unusedReason.trim()) {
            throw new Error("Say why leftover parts weren’t used");
          }
          await returnJobStock(jobId!, {
            technicianId: employee.id,
            item: `${line.title} [Unused: ${unused} — ${unusedReason.trim()}]`,
            qtyReturned: unused,
            // ERP resolves the warehouse product from this line's "(SKU)" (required to restock)
            jobItemId: it.id,
          });
        }
      }

      const photos: string[] = [];
      let encodedChars = 0;
      for (const uri of photoUris) {
        const photo = await uriToDataUrl(uri);
        encodedChars += photo.length;
        if (encodedChars > MAX_ENCODED_PHOTO_CHARS) {
          throw new Error("The selected photos are too large together. Remove one and try again.");
        }
        photos.push(photo);
      }

      // Sync any newly added local services to ERP
      const newLocalServices = items.filter((it) => it.id.startsWith("srv_local_"));
      if (newLocalServices.length > 0) {
        await addJobServices(
          jobId!,
          newLocalServices.map((it) => ({
            description: it.name || it.description || "Service",
            quantity: Number(it.quantityActual ?? it.quantityPlanned ?? 1),
            unitRate: Number(it.unitRate ?? it.unitPrice ?? 0),
          })),
          actor
        );
      }

      return transitionJob(jobId!, {
        action: "complete",
        actualItems: items.map((it) => {
          const line = parseJobLine(it);
          return {
            id: it.id,
            description: it.description,
            quantityActual: line.isService
              ? Number(it.quantityActual ?? it.quantityPlanned ?? 1)
              : Number(it.quantityActual ?? 0),
            unitRate: line.isEquipment ? 0 : Number(it.unitRate ?? it.unitPrice ?? 0),
          };
        }),
        completionDetails: {
          workingRemarks: remarks,
          paymentMeans: collects ? paymentMeans : "unmarked",
          paymentAmount:
            !collects || paymentMeans === "unmarked" ? 0 : Number(paymentAmount) || 0,
          paymentNotes: "",
          unusedReason: hasUnused ? unusedReason.trim() : undefined,
          photos,
          technicianEmployeeId: employee?.id,
        },
        actor: actor,
        technicianId: employee?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast(
        `Job finished · ${photoUris.length} photo${photoUris.length === 1 ? "" : "s"} saved`,
        "success"
      );
      router.back();
    },
    onError: (e: Error) => {
      toast(e.message, "error");
      Alert.alert("Couldn't finish", e.message);
    },
  });

  async function addFromCamera() {
    if (photoUris.length >= MAX_PHOTOS) {
      Alert.alert("Photo limit", `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera blocked", "Allow camera access to take job photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.45,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    void haptic.press();
    setPhotoUris((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
  }

  async function addFromLibrary() {
    if (photoUris.length >= MAX_PHOTOS) {
      Alert.alert("Photo limit", `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos blocked", "Allow photo access to attach job pictures.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.45,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photoUris.length,
    });
    if (result.canceled || !result.assets?.length) return;
    void haptic.press();
    setPhotoUris((prev) =>
      [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS)
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        title="Finish job"
        subtitle="Add proof photos, payment, then submit."
      />

      {jobQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginBottom: space.lg }} />
      ) : jobQuery.isError ? (
        <View style={{ marginBottom: space.lg }}>
          <InlineBanner
            title="Couldn't load the latest job"
            detail="Your parts list may be out of date. Refresh before finishing."
            tone="error"
          />
          <Button title="Try again" variant="secondary" onPress={() => void jobQuery.refetch()} />
        </View>
      ) : null}

      <Text style={{ color: colors.textDim, marginBottom: space.sm, ...type.label }}>
        Proof of work photos
      </Text>
      <Text style={{ color: colors.textMuted, marginBottom: space.md, ...type.subtitle }}>
        Take clear pictures of the finished work. They will be attached to this job.
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md }}>
        {photoUris.map((uri) => (
          <View key={uri} style={{ width: 88, height: 88 }}>
            <Image
              source={{ uri }}
              style={{
                width: 88,
                height: 88,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
              }}
            />
            <Pressable
              onPress={() => {
                void haptic.select();
                setPhotoUris((prev) => prev.filter((u) => u !== uri));
              }}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "rgba(0,0,0,0.7)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.xl }}>
        <Button
          title="Take photo"
          variant="secondary"
          size="md"
          icon={<Camera size={18} color={colors.text} />}
          onPress={() => void addFromCamera()}
          style={{ flex: 1 }}
        />
        <Button
          title="From gallery"
          variant="secondary"
          size="md"
          icon={<ImagePlus size={18} color={colors.text} />}
          onPress={() => void addFromLibrary()}
          style={{ flex: 1 }}
        />
      </View>

      {/* Services Performed Section */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17, marginBottom: 4 }}>
          Services performed
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 12 }}>
          Verify, edit rates/quantities, or add services before finishing.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add service from ERP"
          onPress={() => {
            void haptic.tap();
            openServicePicker();
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: "#2563EB",
            borderWidth: 1.5,
            borderColor: "#3B82F6",
            borderRadius: radius.md,
            paddingVertical: 12,
            paddingHorizontal: 16,
            minHeight: 46,
            marginBottom: 14,
          }}
        >
          <Plus size={18} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>
            + Add service from ERP
          </Text>
        </Pressable>

        {items.filter((it) => parseJobLine(it).isService && !parseJobLine(it).isEquipment).length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textDim, fontSize: 13 }}>No billable services on this job.</Text>
          </View>
        ) : (
          items
            .filter((it) => parseJobLine(it).isService && !parseJobLine(it).isEquipment)
            .map((it) => {
              const line = parseJobLine(it);
              const qty = Number(it.quantityActual ?? it.quantityPlanned ?? 1);
              const rate = Number(it.unitRate ?? it.unitPrice ?? 0);
              return (
                <View
                  key={it.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", flex: 1, fontSize: 14 }}>
                      {line.title}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove service ${line.title}`}
                      onPress={() => {
                        void haptic.tap();
                        setItems((prev) => prev.filter((row) => row.id !== it.id));
                      }}
                      style={{
                        padding: 6,
                        borderRadius: 6,
                        backgroundColor: colors.surfaceElevated,
                      }}
                    >
                      <X size={14} color={colors.danger} />
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    {/* Rate edit */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: colors.textDim, fontSize: 12 }}>Rate:</Text>
                      <TextInput
                        keyboardType="decimal-pad"
                        value={String(rate)}
                        onChangeText={(t) => {
                          const newRate = Number(t.replace(/[^0-9.]/g, "")) || 0;
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === it.id ? { ...row, unitRate: newRate, unitPrice: newRate } : row
                            )
                          );
                        }}
                        style={[
                          field,
                          {
                            width: 80,
                            minHeight: 32,
                            paddingVertical: 2,
                            paddingHorizontal: 8,
                            textAlign: "center",
                            fontSize: 13,
                            fontWeight: "700",
                          },
                        ]}
                      />
                    </View>

                    {/* Quantity controls */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: colors.textDim, fontSize: 12 }}>Qty:</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Decrease service quantity"
                        onPress={() => {
                          void haptic.select();
                          const next = Math.max(1, qty - 1);
                          setItems((prev) =>
                            prev.map((row) => (row.id === it.id ? { ...row, quantityActual: next, quantityPlanned: next } : row))
                          );
                        }}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: radius.sm,
                          backgroundColor: colors.surfaceElevated,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Minus size={13} color={colors.text} />
                      </Pressable>

                      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14, minWidth: 20, textAlign: "center" }}>
                        {qty}
                      </Text>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Increase service quantity"
                        onPress={() => {
                          void haptic.select();
                          const next = qty + 1;
                          setItems((prev) =>
                            prev.map((row) => (row.id === it.id ? { ...row, quantityActual: next, quantityPlanned: next } : row))
                          );
                        }}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: radius.sm,
                          backgroundColor: colors.surfaceElevated,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Plus size={13} color={colors.text} />
                      </Pressable>
                    </View>

                    {/* Line total */}
                    <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>
                      {formatMoney(rate * qty)}
                    </Text>
                  </View>
                </View>
              );
            })
        )}
      </View>

      {items.filter((it) => !parseJobLine(it).isService).length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.text, marginBottom: 4, fontWeight: "800", fontSize: 16 }}>
            Parts used
          </Text>
          <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 12 }}>
            Confirm actual quantity of materials used on this job.
          </Text>
          {items
            .filter((it) => !parseJobLine(it).isService)
            .map((it) => {
              const line = parseJobLine(it);
              return (
                <View
                  key={it.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>{line.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {line.unitRate != null ? (
                        <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>
                          {formatMoney(line.unitRate)} / unit
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <View>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        Planned: {it.quantityPlanned ?? 0}
                      </Text>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12, marginTop: 2 }}>
                        Line: {formatMoney(line.lineTotal)}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: colors.textDim, fontSize: 12 }}>Used:</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Decrease used quantity"
                        onPress={() => {
                          void haptic.select();
                          const planned = Number(it.quantityPlanned ?? 0);
                          const cur = Number(it.quantityActual ?? 0);
                          const next = Math.max(0, cur - 1);
                          setItems((prev) =>
                            prev.map((row) => (row.id === it.id ? { ...row, quantityActual: next } : row))
                          );
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.sm,
                          backgroundColor: colors.surfaceElevated,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Minus size={14} color={colors.text} />
                      </Pressable>

                      <TextInput
                        keyboardType="decimal-pad"
                        value={String(it.quantityActual ?? 0)}
                        onChangeText={(t) => {
                          const planned = Number(it.quantityPlanned ?? 0);
                          const raw = Number(t.replace(/[^0-9.]/g, "")) || 0;
                          const next = Math.min(planned, Math.max(0, raw));
                          setItems((prev) =>
                            prev.map((row) => (row.id === it.id ? { ...row, quantityActual: next } : row))
                          );
                        }}
                        style={[field, { width: 56, minHeight: 36, paddingVertical: 4, textAlign: "center", fontWeight: "700" }]}
                      />

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Increase used quantity"
                        onPress={() => {
                          void haptic.select();
                          const planned = Number(it.quantityPlanned ?? 0);
                          const cur = Number(it.quantityActual ?? 0);
                          const next = Math.min(planned, cur + 1);
                          setItems((prev) =>
                            prev.map((row) => (row.id === it.id ? { ...row, quantityActual: next } : row))
                          );
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.sm,
                          backgroundColor: colors.surfaceElevated,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Plus size={14} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Quick buttons None / All */}
                  {Number(it.quantityPlanned ?? 0) > 0 && (
                    <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Set used to 0"
                        onPress={() => {
                          void haptic.select();
                          setItems((prev) =>
                            prev.map((row) => (row.id === it.id ? { ...row, quantityActual: 0 } : row))
                          );
                        }}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: radius.sm,
                          backgroundColor: (it.quantityActual ?? 0) === 0 ? colors.primaryMuted : colors.surfaceElevated,
                          borderWidth: 1,
                          borderColor: (it.quantityActual ?? 0) === 0 ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ color: (it.quantityActual ?? 0) === 0 ? colors.primary : colors.textDim, fontSize: 11, fontWeight: "700" }}>
                          None (0)
                        </Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Set used to all ${it.quantityPlanned}`}
                        onPress={() => {
                          void haptic.select();
                          setItems((prev) =>
                            prev.map((row) => (row.id === it.id ? { ...row, quantityActual: it.quantityPlanned } : row))
                          );
                        }}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: radius.sm,
                          backgroundColor: it.quantityActual === it.quantityPlanned ? colors.primaryMuted : colors.surfaceElevated,
                          borderWidth: 1,
                          borderColor: it.quantityActual === it.quantityPlanned ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ color: it.quantityActual === it.quantityPlanned ? colors.primary : colors.textDim, fontSize: 11, fontWeight: "700" }}>
                          All ({it.quantityPlanned})
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          <Text
            style={{
              color:
                items.some(
                  (it) =>
                    !parseJobLine(it).isService &&
                    Number(it.quantityPlanned ?? 0) - Number(it.quantityActual ?? 0) > 0
                ) && !unusedReason.trim()
                  ? colors.high
                  : colors.textDim,
              marginTop: 6,
              marginBottom: 6,
              fontWeight: "700",
              fontSize: 13,
            }}
          >
            Leftover parts reason{" "}
            {items.some(
              (it) =>
                !parseJobLine(it).isService &&
                Number(it.quantityPlanned ?? 0) - Number(it.quantityActual ?? it.quantityPlanned ?? 0) > 0
            ) && !unusedReason.trim()
              ? "* (Required)"
              : "(if any)"}
          </Text>
          <TextInput
            value={unusedReason}
            onChangeText={setUnusedReason}
            placeholder="Returned to store / not needed"
            placeholderTextColor={colors.textDim}
            style={field}
          />
        </View>
      )}

      {/* Money to Collect Section */}
      <View
        style={{
          backgroundColor: colors.surfaceElevated,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: colors.primary,
          padding: 16,
          marginBottom: 20,
          gap: 12,
        }}
      >
        {/* Header: Title + Big Net Amount */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(16, 185, 129, 0.3)",
            }}
          >
            <Banknote size={20} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textDim, fontWeight: "800", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>
              {collects ? "Money to Collect" : "Money to Collect (none)"}
            </Text>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 24, marginTop: 2 }}>
              {formatMoney(collects ? billingSummary.netTotal : 0)}
            </Text>
          </View>
        </View>

        {/* Breakdown */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 12,
            gap: 8,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Materials (Parts used)</Text>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
              {formatMoney(billingSummary.materialsTotal)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Services & Labor</Text>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
              {formatMoney(billingSummary.servicesTotal)}
            </Text>
          </View>
          {billingSummary.discountsTotal > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#FBBF24", fontSize: 13, fontWeight: "600" }}>Approved Discount</Text>
              <Text style={{ color: "#FBBF24", fontWeight: "700", fontSize: 13 }}>
                - {formatMoney(billingSummary.discountsTotal)}
              </Text>
            </View>
          )}
          {billingSummary.taxAmount > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>{billingSummary.taxLabel}</Text>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                {billingSummary.taxInclusive ? "" : "+ "}{formatMoney(billingSummary.taxAmount)}
              </Text>
            </View>
          )}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>Total Expected Bill</Text>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              {formatMoney(billingSummary.netTotal)}
            </Text>
          </View>
        </View>

        {!collects ? (
          <InlineBanner
            title={noCollectionCopy(jobQuery.data).title}
            detail={noCollectionCopy(jobQuery.data).detail}
            tone="info"
          />
        ) : (
        <>
        {/* Quick Fill Button */}
        {billingSummary.netTotal > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Collect full ${formatMoney(billingSummary.netTotal)}`}
            onPress={() => {
              void haptic.press();
              setPaymentAmount(String(billingSummary.netTotal));
              if (paymentMeans === "unmarked") setPaymentMeans("cash");
            }}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 46,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
              Collect Full {formatMoney(billingSummary.netTotal)}
            </Text>
          </Pressable>
        )}

        <Text style={{ color: colors.textDim, marginTop: 4, fontWeight: "700", fontSize: 13 }}>
          Payment method
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {PAYMENTS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                void haptic.select();
                setPaymentMeans(p.id);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: paymentMeans === p.id ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: paymentMeans === p.id ? colors.primary : colors.border,
                minWidth: "46%",
                flex: 1,
                alignItems: "center",
                minHeight: tapMin,
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: paymentMeans === p.id ? "#fff" : colors.text,
                  fontWeight: "700",
                }}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {paymentMeans !== "unmarked" && (
          <View style={{ marginTop: 4 }}>
            <Text style={{ color: colors.textDim, marginBottom: 6, fontWeight: "600", fontSize: 13 }}>
              Amount received (PKR)
            </Text>
            <TextInput
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textDim}
              style={[field, { fontSize: 20, fontWeight: "800", backgroundColor: colors.surface }]}
            />
          </View>
        )}

        {/* Live Balance / Payment feedback */}
        <View
          style={{
            padding: 12,
            borderRadius: 10,
            backgroundColor:
              paymentMeans === "unmarked"
                ? colors.surface
                : paymentDiff === 0 && numericReceived > 0
                  ? "rgba(16, 185, 129, 0.15)"
                  : paymentDiff < 0
                    ? "rgba(245, 158, 11, 0.12)"
                    : colors.surface,
            borderWidth: 1,
            borderColor:
              paymentMeans === "unmarked"
                ? colors.border
                : paymentDiff === 0 && numericReceived > 0
                  ? colors.success
                  : paymentDiff < 0
                    ? colors.high
                    : colors.border,
          }}
        >
          {paymentMeans === "unmarked" ? (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Customer not paying now · Uncollected balance: {formatMoney(billingSummary.netTotal)}
            </Text>
          ) : paymentDiff === 0 && numericReceived > 0 ? (
            <Text style={{ color: colors.success, fontWeight: "800", fontSize: 13 }}>
              ✓ Full payment collected ({formatMoney(numericReceived)})
            </Text>
          ) : paymentDiff < 0 ? (
            <Text style={{ color: colors.high, fontWeight: "700", fontSize: 13 }}>
              ⚠️ Partial collection: {formatMoney(numericReceived)} · Remaining balance: {formatMoney(Math.abs(paymentDiff))}
            </Text>
          ) : paymentDiff > 0 ? (
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
              ℹ️ Received: {formatMoney(numericReceived)} · Return change: {formatMoney(paymentDiff)}
            </Text>
          ) : (
            <Text style={{ color: colors.textDim, fontSize: 12 }}>
              Enter the amount collected from customer
            </Text>
          )}
        </View>
        </>
        )}
      </View>

      <Text style={{ color: colors.textDim, marginBottom: 6, fontWeight: "700" }}>
        What did you do?
      </Text>
      <TextInput
        value={remarks}
        onChangeText={setRemarks}
        multiline
        style={[field, { minHeight: 88, textAlignVertical: "top" }]}
        placeholderTextColor={colors.textDim}
        placeholder="Short note for the office"
      />

      <Button
        title={
          photoUris.length
            ? `Submit & close · ${photoUris.length} photo${photoUris.length === 1 ? "" : "s"}`
            : "Add a photo to submit"
        }
        loading={mutation.isPending}
        style={{ marginTop: 22 }}
        onPress={() => {
          if (!remarks.trim()) {
            Alert.alert("Add a short work note", "Please write a brief summary of what work was completed.");
            return;
          }
          const hasLeftover = items.some((it) => {
            const line = parseJobLine(it);
            if (line.isService) return false;
            const planned = Number(it.quantityPlanned ?? 0);
            const actual = Number(it.quantityActual ?? 0);
            return planned - actual > 0;
          });
          if (hasLeftover && !unusedReason.trim()) {
            Alert.alert(
              "Leftover reason required",
              "You have unused parts. Please state why they were not used before submitting."
            );
            return;
          }
          if (collects && paymentMeans !== "unmarked" && !paymentAmount) {
            Alert.alert("Enter amount received", "Or choose “No payment”.");
            return;
          }
          if (
            collects &&
            paymentMeans !== "unmarked" &&
            (!Number.isFinite(Number(paymentAmount)) || Number(paymentAmount) < 0 || (billingSummary.netTotal > 0 && Number(paymentAmount) <= 0))
          ) {
            Alert.alert("Check the amount", "Enter a valid payment amount greater than zero, or select “No payment”.");
            return;
          }
          if (photoUris.length === 0) {
            // Proof photo is mandatory (ERP rejects completion without one)
            Alert.alert(
              "Photo required",
              "Take or attach at least one proof photo of the finished work before submitting."
            );
            return;
          }
          mutation.mutate();
        }}
        disabled={photoUris.length === 0 || jobQuery.isLoading || jobQuery.isError}
      />

      {/* ERP Service Selection Modal */}
      <Modal
        visible={showServicePicker}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowServicePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 24 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <View>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>Select Services</Text>
              <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 2 }}>From Workman ERP Catalog</Text>
            </View>
            <Pressable
              onPress={() => setShowServicePicker(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surfaceElevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Search bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 16,
            }}
          >
            <Search size={18} color={colors.textDim} />
            <TextInput
              value={serviceSearch}
              onChangeText={setServiceSearch}
              placeholder="Search labor / service..."
              placeholderTextColor={colors.textDim}
              style={{ flex: 1, color: colors.text, fontSize: 15 }}
            />
            {serviceSearch.length > 0 && (
              <Pressable onPress={() => setServiceSearch("")}>
                <X size={16} color={colors.textDim} />
              </Pressable>
            )}
          </View>

          {/* List */}
          {catalogQuery.isLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.textDim, marginTop: 12, fontSize: 13 }}>Loading ERP services...</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {((catalogQuery.data ?? []).filter((svc) => {
                const q = serviceSearch.trim().toLowerCase();
                if (!q) return true;
                return (svc.name || "").toLowerCase().includes(q) || (svc.sku || "").toLowerCase().includes(q);
              })).length === 0 ? (
                <View style={{ padding: 32, alignItems: "center" }}>
                  <Wrench size={36} color={colors.textDim} />
                  <Text style={{ color: colors.textDim, marginTop: 12, fontSize: 14 }}>No services found in ERP.</Text>
                </View>
              ) : (
                (catalogQuery.data ?? [])
                  .filter((svc) => {
                    const q = serviceSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (svc.name || "").toLowerCase().includes(q) || (svc.sku || "").toLowerCase().includes(q);
                  })
                  .map((svc) => {
                    const selected = selectedServices.find((s) => s.id === svc.id);
                    return (
                      <Pressable
                        key={svc.id}
                        onPress={() => toggleSelectCatalogService(svc)}
                        style={{
                          backgroundColor: selected ? "rgba(16, 185, 129, 0.08)" : colors.surface,
                          borderWidth: 1.5,
                          borderColor: selected ? colors.primary : colors.border,
                          borderRadius: radius.md,
                          padding: 14,
                          marginBottom: 10,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{svc.name}</Text>
                          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "800", marginTop: 4 }}>
                            {formatMoney(Number(svc.unitPrice) || 0)}
                          </Text>
                        </View>

                        {selected ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            {/* Qty +/- */}
                            <Pressable
                              onPress={() => updateSelectedServiceQty(svc.id, -1)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                backgroundColor: colors.surfaceElevated,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Minus size={13} color={colors.text} />
                            </Pressable>
                            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14, minWidth: 18, textAlign: "center" }}>
                              {selected.qty}
                            </Text>
                            <Pressable
                              onPress={() => updateSelectedServiceQty(svc.id, 1)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                backgroundColor: colors.surfaceElevated,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Plus size={13} color={colors.text} />
                            </Pressable>
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: colors.primary,
                                alignItems: "center",
                                justifyContent: "center",
                                marginLeft: 4,
                              }}
                            >
                              <Check size={14} color="#FFFFFF" />
                            </View>
                          </View>
                        ) : (
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              borderWidth: 2,
                              borderColor: colors.border,
                            }}
                          />
                        )}
                      </Pressable>
                    );
                  })
              )}
            </ScrollView>
          )}

          {/* Bottom Confirmation Bar */}
          <View style={{ paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
            <Button
              title={
                selectedServices.length > 0
                  ? `Add ${selectedServices.length} Selected Service${selectedServices.length > 1 ? "s" : ""} · OK`
                  : "Cancel / Close"
              }
              size="lg"
              onPress={handleConfirmSelectedServices}
              style={{ backgroundColor: selectedServices.length > 0 ? colors.primary : colors.surfaceElevated }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const field = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  color: colors.text,
  padding: 12,
  minHeight: 48,
} as const;
