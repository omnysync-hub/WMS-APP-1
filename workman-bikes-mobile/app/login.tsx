import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Bike, Lock, User } from "lucide-react-native";
import { useAuthStore } from "@/store/authStore";
import { apiErrorMessage, ERP_BASE_URL } from "@/services/api";

/**
 * Real ERP sign-in, same as the main Workman app:
 * POST /api/mobile/auth returns a signed Bearer <redacted> + the employee record.
 * The employee must have mobile access enabled in the ERP.
 */
export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError("Enter your username / phone / email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(identifier, password);
      // Root layout redirects to the tabs once the session is set.
    } catch (e: any) {
      setError(apiErrorMessage(e, "Login failed. Please check your credentials."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#09090B]"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-8">
          <View className="bg-[#121215] border border-[#27272A] p-4 rounded-3xl">
            <Bike color="#F59E0B" size={40} />
          </View>
          <Text className="text-white text-xl font-extrabold mt-4">Workman Bikes Workshop</Text>
          <Text className="text-zinc-400 text-xs mt-1 text-center">
            Sign in with your ERP account to work on bike job cards.
          </Text>
        </View>

        <View className="bg-[#121215] border border-[#27272A] p-4 rounded-2xl">
          <Text className="text-zinc-400 text-xs mb-1">Username, Phone or Email</Text>
          <View className="flex-row items-center bg-[#18181B] border border-[#27272A] rounded-xl px-3">
            <User color="#71717A" size={16} />
            <TextInput
              placeholder="e.g. 03001234567 or your username"
              placeholderTextColor="#71717A"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 text-white text-sm px-2 py-3"
            />
          </View>

          <Text className="text-zinc-400 text-xs mb-1 mt-4">Password</Text>
          <View className="flex-row items-center bg-[#18181B] border border-[#27272A] rounded-xl px-3">
            <Lock color="#71717A" size={16} />
            <TextInput
              placeholder="Your ERP password"
              placeholderTextColor="#71717A"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleLogin}
              className="flex-1 text-white text-sm px-2 py-3"
            />
          </View>

          {!!error && (
            <View className="bg-red-950/60 border border-red-900 rounded-xl px-3 py-2 mt-4">
              <Text className="text-red-300 text-xs">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={submitting}
            className="bg-amber-500 py-3.5 rounded-xl items-center mt-5"
          >
            {submitting ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Text className="text-black font-bold text-sm">Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text className="text-zinc-600 text-[10px] text-center mt-6">
          Server: {ERP_BASE_URL} • You can change the server URL later from the Profile tab.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
