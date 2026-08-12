import assert from "node:assert/strict";
import test from "node:test";
import {
  decideCloudInitialization,
  hasNewerLocalChanges,
} from "../lib/cloud-sync-policy.ts";
import {
  loadCloudSyncState,
  saveCloudSyncState,
} from "../lib/cloud-sync-state.ts";

const storedValues = new Map();
globalThis.window = {
  dispatchEvent() {},
  localStorage: {
    getItem(key) {
      return storedValues.get(key) ?? null;
    },
    setItem(key, value) {
      storedValues.set(key, value);
    },
  },
};

test("odhlášený uživatel zůstává pouze v lokálním režimu", () => {
  assert.equal(
    decideCloudInitialization({
      userId: null,
      online: true,
      pending: false,
      pendingUserId: null,
    }),
    "local",
  );
});

test("offline režim nikdy nestahuje ani neodesílá data", () => {
  assert.equal(
    decideCloudInitialization({
      userId: "user-a",
      online: false,
      pending: true,
      pendingUserId: "user-a",
    }),
    "offline",
  );
});

test("neodeslaná lokální kopie má přednost před stažením cloudu", () => {
  assert.equal(
    decideCloudInitialization({
      userId: "user-a",
      online: true,
      pending: true,
      pendingUserId: "user-a",
    }),
    "upload",
  );
});

test("změny jiného účtu se nesmí automaticky přepsat", () => {
  assert.equal(
    decideCloudInitialization({
      userId: "user-b",
      online: true,
      pending: true,
      pendingUserId: "user-a",
    }),
    "blocked",
  );
});

test("bez čekajících změn se může načíst cloudová kopie", () => {
  assert.equal(
    decideCloudInitialization({
      userId: "user-a",
      online: true,
      pending: false,
      pendingUserId: null,
    }),
    "download",
  );
});

test("změna provedená během uploadu zůstane ve frontě", () => {
  assert.equal(hasNewerLocalChanges(3, 4), true);
  assert.equal(hasNewerLocalChanges(4, 4), false);
});

test("čekající stav přežije nové načtení aplikace", () => {
  saveCloudSyncState({
    phase: "offline",
    pending: true,
    pendingUserId: "user-a",
    lastSyncedAt: null,
    error: null,
  });
  assert.deepEqual(loadCloudSyncState(), {
    phase: "offline",
    pending: true,
    pendingUserId: "user-a",
    lastSyncedAt: null,
    error: null,
  });
});

test("průběh synchronizace je dostupný pro živý indikátor", () => {
  saveCloudSyncState({
    phase: "syncing",
    pending: true,
    pendingUserId: "user-a",
    lastSyncedAt: null,
    error: null,
  });
  assert.equal(loadCloudSyncState().phase, "syncing");
});
