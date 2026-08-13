"use client";

import { useEffect, useState } from "react";
import {
  CLOUD_SYNC_EVENT,
  CLOUD_SYNC_STORAGE_KEY,
  loadCloudSyncState,
} from "@/lib/cloud-sync-state";
import type { CloudSyncState } from "@/lib/cloud-sync-state";

export function useCloudSyncState() {
  const [state, setState] = useState<CloudSyncState>({
    phase: "local",
    pending: false,
    pendingUserId: null,
    lastSyncedAt: null,
    error: null,
  });

  useEffect(() => {
    const refresh = () => setState(loadCloudSyncState());
    const onStorage = (event: StorageEvent) => {
      if (event.key === CLOUD_SYNC_STORAGE_KEY) refresh();
    };

    refresh();
    window.addEventListener(CLOUD_SYNC_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CLOUD_SYNC_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return state;
}
