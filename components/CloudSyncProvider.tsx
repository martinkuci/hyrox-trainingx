"use client";

import { useEffect, useRef } from "react";
import { AUTH_EVENT, downloadCloudData, loadCloudUser, uploadCloudData } from "@/lib/firebase-rest";
import { HYROX_DATA_EVENT, HYROX_STORAGE_KEY, loadHyroxData, saveHyroxData } from "@/lib/storage";

export default function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const syncingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    async function initialize() {
      if (!loadCloudUser() || syncingRef.current) return;
      syncingRef.current = true;
      try {
        const cloud = await downloadCloudData();
        if (cloud) saveHyroxData(cloud);
        else await uploadCloudData(loadHyroxData());
      } catch (error) {
        console.error("Cloud initialization failed", error);
      } finally {
        syncingRef.current = false;
      }
    }

    function queueUpload() {
      if (!loadCloudUser() || syncingRef.current) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(async () => {
        syncingRef.current = true;
        try {
          await uploadCloudData(loadHyroxData());
        } catch (error) {
          console.error("Cloud upload failed", error);
        } finally {
          syncingRef.current = false;
        }
      }, 700);
    }

    function onStorage(event: StorageEvent) {
      if (event.key === HYROX_STORAGE_KEY) queueUpload();
    }

    void initialize();
    window.addEventListener(AUTH_EVENT, initialize);
    window.addEventListener(HYROX_DATA_EVENT, queueUpload);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AUTH_EVENT, initialize);
      window.removeEventListener(HYROX_DATA_EVENT, queueUpload);
      window.removeEventListener("storage", onStorage);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return children;
}
