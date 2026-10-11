import { View } from "react-native";
import { CheckCircle2, PauseCircle, Play, ThumbsUp, RotateCcw } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { colors } from "@/constants/theme";
import type { JobStatus } from "@/types";

export function JobActionToolbar({
  status,
  loading,
  onAccept,
  onStart,
  onResume,
  onPause,
  onComplete,
}: {
  status: JobStatus;
  loading?: boolean;
  onAccept: () => void;
  onStart: () => void;
  onResume: () => void;
  onPause: () => void;
  onComplete: () => void;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: 16,
        paddingBottom: 28,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 10,
      }}
    >
      {status === "Assigned" && (
        <Button
          title="Accept this job"
          size="lg"
          loading={loading}
          onPress={onAccept}
          icon={<ThumbsUp size={20} color="#fff" />}
        />
      )}
      {status === "Accepted" && (
        <Button
          title="I'm on site — start"
          size="lg"
          loading={loading}
          onPress={onStart}
          icon={<Play size={20} color="#fff" />}
        />
      )}
      {status === "Paused" && (
        <Button
          title="Resume work"
          size="lg"
          loading={loading}
          onPress={onResume}
          icon={<RotateCcw size={20} color="#fff" />}
        />
      )}
      {status === "InProgress" && (
        <>
          <Button
            title="Finish & take payment"
            size="lg"
            loading={loading}
            onPress={onComplete}
            icon={<CheckCircle2 size={20} color="#fff" />}
          />
          <Button
            title="Pause for today"
            variant="secondary"
            loading={loading}
            onPress={onPause}
            icon={<PauseCircle size={18} color={colors.text} />}
          />
        </>
      )}
    </View>
  );
}
