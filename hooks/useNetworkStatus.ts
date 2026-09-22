import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { processSyncQueue } from "@/services/syncService";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      if (online) void processSyncQueue();
    });
    return () => unsub();
  }, []);

  return { isOnline };
}
