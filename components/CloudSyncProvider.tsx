"use client";

import { useEffect, useRef } from "react";
import {
  CLOUD_SYNC_RETRY_EVENT,
  loadCloudSyncState,
  updateCloudSyncState,
} from "@/lib/cloud-sync-state";
import { decideCloudInitialization, hasNewerLocalChanges } from "@/lib/cloud-sync-policy";
import { AUTH_EVENT, downloadCloudData, loadCloudUser, uploadCloudData } from "@/lib/firebase-rest";
import { HYROX_DATA_EVENT, HYROX_STORAGE_KEY, loadHyroxData, saveHyroxData } from "@/lib/storage";

export default function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const syncingRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const changeSequenceRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;

    function isOnline() {
      return navigator.onLine !== false;
    }

    function clearUploadTimer() {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function queueUpload(delay = 700) {
      clearUploadTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void uploadPendingData();
      }, delay);
    }

    async function uploadPendingData() {
      if (syncingRef.current || disposed) return;
      const user = loadCloudUser();
      if (!user) {
        updateCloudSyncState({ phase: "local", error: null });
        return;
      }
      if (!isOnline()) {
        updateCloudSyncState({ phase: "offline", pending: true, pendingUserId: user.uid });
        return;
      }

      const startedAtSequence = changeSequenceRef.current;
      syncingRef.current = true;
      updateCloudSyncState({
        phase: "syncing",
        pending: true,
        pendingUserId: user.uid,
        error: null,
      });

      try {
        const uploaded = await uploadCloudData(loadHyroxData());
        if (!uploaded) throw new Error("Cloud session expired before upload.");
        if (disposed) return;
        const hasNewerChanges = hasNewerLocalChanges(
          startedAtSequence,
          changeSequenceRef.current,
        );
        updateCloudSyncState({
          phase: hasNewerChanges ? "pending" : "synced",
          pending: hasNewerChanges,
          pendingUserId: hasNewerChanges ? user.uid : null,
          lastSyncedAt: new Date().toISOString(),
          error: null,
        });
        if (hasNewerChanges) queueUpload(0);
      } catch (error) {
        if (disposed) return;
        console.error("Cloud upload failed", error);
        const stillSignedIn = Boolean(loadCloudUser());
        updateCloudSyncState({
          phase: stillSignedIn ? (isOnline() ? "error" : "offline") : "local",
          pending: true,
          pendingUserId: user.uid,
          error: stillSignedIn
            ? "Změny zůstaly v zařízení. Synchronizaci zkusíme znovu."
            : null,
        });
      } finally {
        syncingRef.current = false;
      }
    }

    async function initialize() {
      if (syncingRef.current || disposed) return;
      clearUploadTimer();
      const user = loadCloudUser();
      const storedState = loadCloudSyncState();
      const action = decideCloudInitialization({
        userId: user?.uid ?? null,
        online: isOnline(),
        pending: storedState.pending,
        pendingUserId: storedState.pendingUserId,
      });
      if (action === "local") {
        updateCloudSyncState({ phase: "local", error: null });
        return;
      }
      if (action === "offline") {
        updateCloudSyncState({ phase: "offline", error: null });
        return;
      }
      if (action === "upload") {
        await uploadPendingData();
        return;
      }
      if (action === "blocked") {
        updateCloudSyncState({
          phase: "error",
          error: "V zařízení čekají změny pro jiný účet. Přihlas se k původnímu účtu, aby se bezpečně odeslaly.",
        });
        return;
      }
      if (!user) return;

      syncingRef.current = true;
      updateCloudSyncState({ phase: "syncing", pending: false, error: null });
      try {
        const cloud = await downloadCloudData();
        if (disposed) return;
        if (!loadCloudUser()) throw new Error("Cloud session expired during initialization.");
        if (cloud) {
          applyingRemoteRef.current = true;
          saveHyroxData(cloud);
          applyingRemoteRef.current = false;
        } else {
          const uploaded = await uploadCloudData(loadHyroxData());
          if (!uploaded) throw new Error("Cloud session expired before initial upload.");
        }
        updateCloudSyncState({
          phase: "synced",
          pending: false,
          pendingUserId: null,
          lastSyncedAt: new Date().toISOString(),
          error: null,
        });
      } catch (error) {
        applyingRemoteRef.current = false;
        if (disposed) return;
        console.error("Cloud initialization failed", error);
        const stillSignedIn = Boolean(loadCloudUser());
        updateCloudSyncState({
          phase: stillSignedIn ? (isOnline() ? "error" : "offline") : "local",
          error: stillSignedIn
            ? "Cloud teď není dostupný. Lokální data zůstávají v bezpečí."
            : null,
        });
      } finally {
        syncingRef.current = false;
      }
    }

    function onDataChange() {
      if (applyingRemoteRef.current) return;
      const user = loadCloudUser();
      if (!user) {
        updateCloudSyncState({ phase: "local", error: null });
        return;
      }

      changeSequenceRef.current += 1;
      updateCloudSyncState({
        phase: isOnline() ? "pending" : "offline",
        pending: true,
        pendingUserId: user.uid,
        error: null,
      });
      if (isOnline()) queueUpload();
    }

    function onStorage(event: StorageEvent) {
      if (event.key === HYROX_STORAGE_KEY) onDataChange();
    }

    function onOnline() {
      const state = loadCloudSyncState();
      if (state.pending) void uploadPendingData();
      else void initialize();
    }

    function onOffline() {
      clearUploadTimer();
      updateCloudSyncState({ phase: "offline", error: null });
    }

    function onRetry() {
      const state = loadCloudSyncState();
      if (state.pending) void uploadPendingData();
      else void initialize();
    }

    void initialize();
    window.addEventListener(AUTH_EVENT, initialize);
    window.addEventListener(HYROX_DATA_EVENT, onDataChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(CLOUD_SYNC_RETRY_EVENT, onRetry);
    return () => {
      disposed = true;
      window.removeEventListener(AUTH_EVENT, initialize);
      window.removeEventListener(HYROX_DATA_EVENT, onDataChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(CLOUD_SYNC_RETRY_EVENT, onRetry);
      clearUploadTimer();
    };
  }, []);

  return children;
}
