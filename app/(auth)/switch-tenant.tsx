import { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Button } from "@/components/ui/Button";
import { DEFAULT_ERP_BASE_URL, ERP_BASE_URL, setErpBaseUrl } from "@/services/api";
import { colors } from "@/constants/theme";
import { useAuthStore } from "@/store/authStore";

const PRESETS = [
  { label: "Android Emulator → localhost", url: "http://10.0.2.2:3001" },
  { label: "iOS Simulator → localhost", url: "http://localhost:3001" },
  { label: "Production", url: "https://erp.workmanservices.pk" },
];

export default function SwitchTenantScreen() {
  const [url, setUrl] = useState(ERP_BASE_URL);

  async function save(next: string) {
    try {
      const parsed = new URL(next.trim());
      if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
        throw new Error("Enter only the server address, without a path, login, query, or fragment.");
      }

      const host = parsed.hostname.toLowerCase();
      const isPrivateIpv4 =
        /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
      const isLocalDevHost = host === "localhost" || host === "127.0.0.1" || host === "10.0.2.2" || isPrivateIpv4;
      const configuredProductionOrigin = (() => {
        try {
          const origin = new URL(DEFAULT_ERP_BASE_URL).origin;
          return origin.startsWith("https://") ? origin : "https://erp.workmanservices.pk";
        } catch {
          return "https://erp.workmanservices.pk";
        }
      })();

      if (__DEV__) {
        if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalDevHost)) {
          throw new Error("Use HTTPS, or an HTTP localhost/private-LAN address while developing.");
        }
      } else if (parsed.protocol !== "https:" || parsed.origin !== configuredProductionOrigin) {
        throw new Error("Production builds can connect only to the configured Workman server.");
      }

      const cleaned = parsed.origin;
      if (cleaned !== ERP_BASE_URL) {
        // Never carry a signed session to a different host.
        await useAuthStore.getState().logout();
      }
      await SecureStore.setItemAsync("wms_api_url", cleaned);
      setErpBaseUrl(cleaned);
      setUrl(cleaned);
      Alert.alert("Saved", `API base URL set to:\n${cleaned}`);
    } catch (error) {
      Alert.alert("Invalid server address", error instanceof Error ? error.message : "Enter a valid URL.");
    }
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
