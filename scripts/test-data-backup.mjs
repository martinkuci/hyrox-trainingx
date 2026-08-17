import assert from "node:assert/strict";
import test from "node:test";
import {
  HYROX_BACKUP_FORMAT,
  MAX_BACKUP_FILE_BYTES,
  assertBackupFileSize,
  backupFileName,
  parseHyroxBackupText,
  serializeHyroxBackup,
} from "../lib/data-backup.ts";
import {
  TRAINING_CATALOG,
  TRAINING_CATALOG_VERSION,
} from "../lib/training-catalog.ts";

function createData() {
  return {
    version: 1,
    catalogVersion: 1,
    templates: [
      {
        id: "template-1",
        title: "Test workout",
        description: "",
        durationMinutes: 30,
        tags: ["test"],
        blocks: [],
        createdAt: "2026-08-01T10:00:00.000Z",
        updatedAt: "2026-08-01T10:00:00.000Z",
      },
    ],
    scheduledWorkouts: [],
    results: [],
    weeklyPlans: [],
    trainingPrograms: [],
  };
}

test("exports and restores a complete versioned backup", () => {
  const data = createData();
  const exportedAt = "2026-08-13T10:30:00.000Z";
  const text = serializeHyroxBackup(data, exportedAt);
  const parsedJson = JSON.parse(text);
  const restored = parseHyroxBackupText(text);

  assert.equal(parsedJson.format, HYROX_BACKUP_FORMAT);
  assert.equal(restored.backup.exportedAt, exportedAt);
  assert.deepEqual(restored.backup.data, data);
  assert.equal(restored.summary.templates, data.templates.length);
  assert.equal(restored.legacy, false);
});

test("accepts the complete built-in training catalog", () => {
  const data = {
    ...createData(),
    catalogVersion: TRAINING_CATALOG_VERSION,
    templates: TRAINING_CATALOG,
  };
  const restored = parseHyroxBackupText(serializeHyroxBackup(data));

  assert.equal(restored.summary.templates, TRAINING_CATALOG.length);
  assert.deepEqual(restored.backup.data.templates, TRAINING_CATALOG);
});

test("accepts every structured workout mode", () => {
  const data = createData();
  const step = { id: "step-1", name: "SkiErg", detail: "250 m" };
  data.templates[0].blocks = [
    { id: "manual", type: "manual", title: "Manual", repeat: 1, steps: [step] },
    { id: "for-time", type: "for-time", title: "For Time", rounds: 3, restSeconds: 60, steps: [step] },
    { id: "interval", type: "interval", title: "Interval", rounds: 6, workSeconds: 45, restSeconds: 15, steps: [step] },
    { id: "tabata", type: "tabata", title: "TABATA", rounds: 8, workSeconds: 20, restSeconds: 10, steps: [step] },
    { id: "emom", type: "emom", title: "EMOM", minutes: 8, steps: [step] },
    { id: "amrap", type: "amrap", title: "AMRAP", minutes: 12, steps: [step] },
  ];

  const restored = parseHyroxBackupText(serializeHyroxBackup(data));
  assert.equal(restored.backup.data.templates[0].blocks.length, 6);
});

test("accepts the older direct hyrox-data-v1 object", () => {
  const data = createData();
  const restored = parseHyroxBackupText(JSON.stringify(data));

  assert.equal(restored.legacy, true);
  assert.deepEqual(restored.backup.data, data);
});

test("rejects malformed JSON and missing collections", () => {
  assert.throws(() => parseHyroxBackupText("{"), /platný JSON/);

  const incomplete = { ...createData() };
  delete incomplete.results;
  assert.throws(
    () => parseHyroxBackupText(JSON.stringify(incomplete)),
    /chybí kolekce/,
  );
});

test("rejects unsupported backup versions and invalid items", () => {
  const data = createData();
  assert.throws(
    () =>
      parseHyroxBackupText(
        JSON.stringify({
          format: HYROX_BACKUP_FORMAT,
          backupVersion: 2,
          exportedAt: "2026-08-13T10:30:00.000Z",
          data,
        }),
      ),
    /není podporovaná/,
  );

  data.results.push({ id: "broken" });
  assert.throws(
    () => parseHyroxBackupText(JSON.stringify(data)),
    /neplatná nebo neúplná/,
  );
});

test("rejects a malformed nested workout before restore", () => {
  const data = createData();
  data.templates[0].blocks.push({
    id: "broken-block",
    type: "manual",
    title: "Broken",
    repeat: 1,
    steps: [null],
  });

  assert.throws(
    () => parseHyroxBackupText(JSON.stringify(data)),
    /neplatná nebo neúplná/,
  );
});

test("limits backup uploads to five megabytes", () => {
  assert.doesNotThrow(() => assertBackupFileSize(MAX_BACKUP_FILE_BYTES));
  assert.throws(
    () => assertBackupFileSize(MAX_BACKUP_FILE_BYTES + 1),
    /Maximální velikost/,
  );
});

test("uses an unambiguous dated filename", () => {
  assert.equal(
    backupFileName(new Date("2026-08-13T21:15:00.000Z")),
    "hyrox-training-zaloha-2026-08-13.json",
  );
});
