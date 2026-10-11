import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, AlertCircle, Info } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToastStore } from "@/store/toastStore";
import { colors } from "@/constants/theme";
import { haptic } from "@/lib/haptics";

export function ToastHost() {
  const { visible, message, tone } = useToastStore();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (visible) {
      if (tone === "success") void haptic.success();
      else if (tone === "error") void haptic.error();
      else void haptic.tap();
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, tone, opacity, translateY]);

  if (!visible && !message) return null;

  const bg =
    tone === "success"
      ? "#065F46"
      : tone === "error"
        ? "#9F1239"
        : colors.surfaceElevated;
  const Icon =
    tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : Info;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
      <Animated.View
        style={{
          position: "absolute",
          top: insets.top + 10,
          left: 16,
          right: 16,
          opacity,
          transform: [{ translateY }],
          backgroundColor: bg,
          borderRadius: 16,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
        }}
      >
        <Icon size={22} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, flex: 1 }}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}
