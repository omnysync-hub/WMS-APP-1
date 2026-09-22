import { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Button } from "@/components/ui/Button";
import { ERP_BASE_URL, setErpBaseUrl } from "@/services/api";
import { colors } from "@/constants/theme";

const PRESETS = [
  { label: "Android Emulator → localhost", url: "http://10.0.2.2:3001" },
  { label: "iOS Simulator → localhost", url: "http://localhost:3001" },
  { label: "Production", url: "https://erp.workmanservices.pk" },
];

export default function SwitchTenantScreen() {
  const [url, setUrl] = useState(ERP_BASE_URL);

  async function save(next: string) {
    const cleaned = next.replace(/\/$/, "");
    await SecureStore.setItemAsync("wms_api_url", cleaned);
    setErpBaseUrl(cleaned);
    setUrl(cleaned);
    Alert.alert("Saved", `API base URL set to:\n${cleaned}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
      <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
        Point the companion at your ERP host. Physical devices need your LAN IP (e.g. http://192.168.x.x:3001).
      </Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 12,
          color: colors.text,
          padding: 14,
          marginBottom: 12,
        }}
      />
      <Button title="Save Custom URL" onPress={() => save(url)} />
      <View style={{ marginTop: 20, gap: 10 }}>
        {PRESETS.map((p) => (
          <Button
            key={p.url}
            title={p.label}
            variant="secondary"
            onPress={() => save(p.url)}
          />
        ))}
      </View>
    </View>
  );
}
