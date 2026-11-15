import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Snowflake, Lock, User } from "lucide-react-native";
import { useAuthStore } from "@/store/authStore";
import { ERP_BASE_URL, getStoredApiUrl, setStoredApiUrl } from "@/services/api";

export default function HvacLoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverUrl, setServerUrl] = useState(ERP_BASE_URL);
  const [showServerInput, setShowServerInput] = useState(false);

  useEffect(() => {
    getStoredApiUrl().then(setServerUrl).catch(() => {});
  }, []);

  const handleSaveServerUrl = async (val: string) => {
    const trimmed = val.trim();
    setServerUrl(trimmed);
    if (trimmed) {
      await setStoredApiUrl(trimmed);
    }
  };

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert("Required", "Enter your username, phone number, or email.");
      return;
    }
    if (!password) {
      Alert.alert("Required", "Enter your password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(identifier, password);
      // Root layout's Stack.Protected guard swaps to the tabs automatically.
    } catch (e: any) {
      Alert.alert("Sign-in failed", e?.message || "Could not sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-[#09090B] justify-center px-6"
    >
      <View className="items-center mb-8">
        <View className="bg-cyan-950/80 border border-cyan-800 p-4 rounded-3xl mb-3">
          <Snowflake color="#06B6D4" size={36} />
        </View>
        <Text className="text-white text-xl font-extrabold">Workman HVAC Workshop</Text>
        <Text className="text-zinc-400 text-xs mt-1 text-center">
          Sign in with your ERP mobile account to open bench job cards.
        </Text>
      </View>

      <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl space-y-3">
        <View>
          <Text className="text-zinc-400 text-xs mb-1">Username / Phone / Email</Text>
          <View className="flex-row items-center bg-[#18181B] border border-[#27272A] rounded-xl px-3">
            <User color="#71717A" size={16} />
            <TextInput
              placeholder="e.g. khurram.shahzad or 03001234567"
              placeholderTextColor="#71717A"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 text-white text-sm px-2 py-3"
            />
          </View>
        </View>

        <View>
          <Text className="text-zinc-400 text-xs mb-1">Password</Text>
          <View className="flex-row items-center bg-[#18181B] border border-[#27272A] rounded-xl px-3">
            <Lock color="#71717A" size={16} />
            <TextInput
              placeholder="Your mobile password"
              placeholderTextColor="#71717A"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              className="flex-1 text-white text-sm px-2 py-3"
              onSubmitEditing={handleLogin}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={submitting}
          className="bg-cyan-500 py-3 rounded-xl items-center mt-1"
        >
          {submitting ? (
            <ActivityIndicator color="#000000" size="small" />
          ) : (
            <Text className="text-black font-bold text-sm">Sign In</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowServerInput(!showServerInput)}
          className="mt-4 py-1"
        >
          <Text className="text-zinc-500 text-[11px] text-center">
            Server: <Text className="text-cyan-400 font-mono underline">{serverUrl}</Text> (Tap to change)
          </Text>
        </TouchableOpacity>

        {showServerInput && (
          <View className="bg-[#121215] border border-[#27272A] p-3 rounded-xl mt-2">
            <Text className="text-zinc-400 text-xs mb-1">Custom Server URL</Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={serverUrl}
                onChangeText={handleSaveServerUrl}
                placeholder="https://... or http://192.168.18.36:3001"
                placeholderTextColor="#71717A"
                className="flex-1 bg-[#18181B] border border-[#27272A] rounded-lg px-2.5 py-2 text-white text-xs font-mono"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowServerInput(false)}
                className="bg-zinc-800 px-3 py-2 rounded-lg"
              >
                <Text className="text-zinc-200 text-xs font-bold">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Text className="text-zinc-600 text-[10px] text-center mt-6">
        No mobile login yet? Ask HR to enable mobile access and set your password in the ERP.
        One account stays signed in on one device at a time.
      </Text>
    </KeyboardAvoidingView>
  );
}
