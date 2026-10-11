import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Kept for Requests tab — real watch/ringtone runs globally from app/_layout.
 * This only refreshes the inbox list on an interval.
 */
export function useLiveRequestsStream(employeeId?: string | null, enabled = true) {
  const qc = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (!employeeId || !enabled) return;
    started.current = true;
    const poll = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["requests", employeeId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    }, 12_000);
    return () => clearInterval(poll);
  }, [employeeId, enabled, qc]);
}
