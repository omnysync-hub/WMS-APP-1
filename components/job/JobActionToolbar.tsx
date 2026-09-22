import { View } from "react-native";
import { Button } from "@/components/ui/Button";
import { colors } from "@/constants/theme";
import type { JobStatus } from "@/types";

export function JobActionToolbar({
  status,
  loading,
  onAccept,
  onStart,
  onPause,
  onComplete,
}: {
  status: JobStatus;
  loading?: boolean;
  onAccept: () => void;
  onStart: () => void;
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
        gap: 8,
      }}
    >
      {status === "Assigned" && (
        <Button title="Accept Work Order" loading={loading} onPress={onAccept} />
      )}
      {(status === "Accepted" || status === "Paused") && (
        <Button title="Start Job (Clock In Site GPS)" loading={loading} onPress={onStart} />
      )}
      {status === "InProgress" && (
        <>
          <Button title="Complete Job" loading={loading} onPress={onComplete} />
          <Button title="Pause Work for Today" variant="secondary" loading={loading} onPress={onPause} />
        </>
      )}
    </View>
  );
}
