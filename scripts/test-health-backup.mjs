import assert from "node:assert/strict";
import test from "node:test";
import { parseHyroxBackupText, serializeHyroxBackup } from "../lib/data-backup.ts";

function baseData() {
  return {
    version: 1,
    catalogVersion: 1,
    templates: [{
      id: "template-health-test",
      title: "Health test",
      description: "",
      durationMinutes: 30,
      tags: [],
      blocks: [],
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
    }],
    scheduledWorkouts: [],
    results: [],
    weeklyPlans: [],
    trainingPrograms: [],
  };
}

const stravaActivity = {
  id: "health-strava-42",
  provider: "strava",
  externalId: "42",
  title: "Evening workout",
  sportType: "Workout",
  startedAt: "2026-08-19T18:00:00.000Z",
  durationSeconds: 3600,
  averageHeartRate: 148,
  maxHeartRate: 181,
  importedAt: "2026-08-20T00:10:00.000Z",
};

test("preserves provider-neutral health data in version 1 backups", () => {
  const data = {
    ...baseData(),
    healthData: {
      activities: [stravaActivity],
      samples: [],
      lastSyncedAt: { strava: "2026-08-20T00:10:00.000Z" },
    },
  };

  const restored = parseHyroxBackupText(serializeHyroxBackup(data));
  assert.deepEqual(restored.backup.data.healthData, data.healthData);
});

test("keeps older backups without health data backward compatible", () => {
  const data = baseData();
  const restored = parseHyroxBackupText(serializeHyroxBackup(data));
  assert.equal(restored.backup.data.healthData, undefined);
});

test("rejects malformed imported health activities in a backup", () => {
  const data = {
    ...baseData(),
    healthData: {
      activities: [{ ...stravaActivity, provider: "unknown-provider" }],
      samples: [],
      lastSyncedAt: {},
    },
  };

  assert.throws(
    () => parseHyroxBackupText(serializeHyroxBackup(data)),
    /Health & Activity data/,
  );
});
