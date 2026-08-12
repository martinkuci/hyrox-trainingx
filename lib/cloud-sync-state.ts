export const CLOUD_SYNC_STORAGE_KEY = "hyrox-cloud-sync-v1";
export const CLOUD_SYNC_EVENT = "hyrox-cloud-sync-state";
export const CLOUD_SYNC_RETRY_EVENT = "hyrox-cloud-sync-retry";

export type CloudSyncPhase =
  | "local"
  | "offline"
  | "pending"
  | "syncing"
  | "synced"
  | "error";

export type CloudSyncState = {
  phase: CloudSyncPhase;
  pending: boolean;
  pendingUserId: string | null;
  lastSyncedAt: string | null;
  error: string | null;
};

const DEFAULT_STATE: CloudSyncState = {
  phase: "local",
  pending: false,
  pendingUserId: null,
  lastSyncedAt: null,
  error: null,
};

function stateStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function normalize(value: unknown): CloudSyncState {
  if (!value || typeof value !== "object") return { ...DEFAULT_STATE };
  const stored = value as Partial<CloudSyncState>;
  const phases: CloudSyncPhase[] = [
    "local",
    "offline",
    "pending",
    "syncing",
    "synced",
    "error",
  ];
  const pending = stored.pending === true;
  const phase = phases.includes(stored.phase as CloudSyncPhase)
    ? (stored.phase as CloudSyncPhase)
    : pending
      ? "pending"
      : "local";

  return {
    phase,
    pending,
    pendingUserId:
      typeof stored.pendingUserId === "string" ? stored.pendingUserId : null,
    lastSyncedAt:
      typeof stored.lastSyncedAt === "string" &&
      Number.isFinite(Date.parse(stored.lastSyncedAt))
        ? stored.lastSyncedAt
        : null,
    error: typeof stored.error === "string" ? stored.error : null,
  };
}

export function loadCloudSyncState(): CloudSyncState {
  const storage = stateStorage();
  if (!storage) return { ...DEFAULT_STATE };
  try {
    return normalize(JSON.parse(storage.getItem(CLOUD_SYNC_STORAGE_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveCloudSyncState(state: CloudSyncState): CloudSyncState {
  const normalized = normalize(state);
  const storage = stateStorage();
  if (storage) {
    try {
      storage.setItem(CLOUD_SYNC_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Synchronizace nesmí zablokovat lokální práci ani při nedostupném úložišti.
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<CloudSyncState>(CLOUD_SYNC_EVENT, { detail: normalized }),
    );
  }
  return normalized;
}

export function updateCloudSyncState(
  updates: Partial<CloudSyncState>,
): CloudSyncState {
  return saveCloudSyncState({ ...loadCloudSyncState(), ...updates });
}

export function requestCloudSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLOUD_SYNC_RETRY_EVENT));
  }
}
