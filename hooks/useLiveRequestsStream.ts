import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ERP_BASE_URL } from "@/services/api";

/**
 * Lightweight SSE client for React Native (fetch + ReadableStream where available).
 * Falls back to polling invalidation every 25s if stream unsupported.
 */
export function useLiveRequestsStream(employeeId?: string | null, enabled = true) {
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!employeeId || !enabled) return;

    let cancelled = false;
    const poll = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["requests", employeeId] });
    }, 25_000);

    async function connect() {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(
          `${ERP_BASE_URL}/api/mobile/stream?employeeId=${employeeId}`,
          {
            headers: { Accept: "text/event-stream" },
            signal: ac.signal,
          }
        );
        if (!res.ok || !res.body || cancelled) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            if (chunk.includes("NEW_APP_REQUEST") || chunk.includes("REQUEST_RESPONDED")) {
              qc.invalidateQueries({ queryKey: ["requests", employeeId] });
              qc.invalidateQueries({ queryKey: ["jobs"] });
            }
          }
        }
      } catch {
        // RN fetch streams vary by platform — polling covers the gap
      }
    }

    void connect();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      clearInterval(poll);
    };
  }, [employeeId, enabled, qc]);
}
