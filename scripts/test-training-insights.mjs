import assert from "node:assert/strict";
import test from "node:test";
import {
  buildComparableWorkouts,
  buildTrainingOverview,
  buildWeeklyActivity,
} from "../lib/training-insights.ts";

function result(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    templateId: overrides.templateId ?? "template-a",
    workoutTitle: overrides.workoutTitle ?? "Test workout",
    completedAt: overrides.completedAt ?? "2026-08-10T10:00:00.000Z",
    durationSeconds: overrides.durationSeconds ?? 3600,
    rpe: overrides.rpe ?? 7,
    weights: "",
    notes: "",
    splits: [],
    ...overrides,
  };
}

test("souhrn používá pouze posledních 28 dní a platné RPE", () => {
  const overview = buildTrainingOverview([
    result({ completedAt: "2026-08-10T10:00:00.000Z", durationSeconds: 1800, rpe: 6 }),
    result({ completedAt: "2026-07-20T10:00:00.000Z", durationSeconds: 2400, rpe: 8 }),
    result({ completedAt: "2026-07-01T10:00:00.000Z", durationSeconds: 9999, rpe: 10 }),
    result({ completedAt: "invalid", durationSeconds: 500, rpe: 99 }),
  ], [], new Date("2026-08-13T12:00:00.000Z"));

  assert.deepEqual(overview, {
    sessionCount: 2,
    durationSeconds: 4200,
    averageRpe: 7,
    targetRpeMatches: 0,
    targetRpeCount: 0,
  });
});

test("soulad RPE používá snapshot a metadata šablony jako fallback", () => {
  const metadata = { targetRpeMin: 6, targetRpeMax: 8 };
  const templates = [{ id: "template-a", metadata }];
  const overview = buildTrainingOverview([
    result({ rpe: 7 }),
    result({ id: "second", rpe: 9, metadataSnapshot: { ...metadata, targetRpeMin: 8, targetRpeMax: 9 } }),
  ], templates, new Date("2026-08-13T12:00:00.000Z"));

  assert.equal(overview.targetRpeMatches, 2);
  assert.equal(overview.targetRpeCount, 2);
});

test("týdenní aktivita zachová i týdny bez výsledků", () => {
  const weeks = buildWeeklyActivity([
    result({ completedAt: "2026-08-11T10:00:00.000Z", durationSeconds: 1200 }),
    result({ id: "older", completedAt: "2026-07-22T10:00:00.000Z", durationSeconds: 1800 }),
  ], new Date("2026-08-13T12:00:00.000Z"));

  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks.map((week) => week.sessionCount), [0, 1, 0, 0, 1]);
  assert.equal(weeks.at(-1)?.current, true);
});

test("stejný kód porovná výsledky i přes změnu šablony", () => {
  const comparisons = buildComparableWorkouts([
    result({ id: "old", templateId: "v1", workoutCode: "HYX-01", completedAt: "2026-08-01T10:00:00.000Z", durationSeconds: 3600, rpe: 8 }),
    result({ id: "new", templateId: "v2", workoutCode: "HYX-01", completedAt: "2026-08-10T10:00:00.000Z", durationSeconds: 3300, rpe: 7 }),
  ]);

  assert.equal(comparisons.length, 1);
  assert.equal(comparisons[0].durationChangePercent, -8.3);
  assert.deepEqual(comparisons[0].attempts.map((attempt) => attempt.id), ["old", "new"]);
});

test("stejný název nestačí ke srovnání rozdílných tréninků", () => {
  const comparisons = buildComparableWorkouts([
    result({ templateId: "template-a", workoutTitle: "Stejný název" }),
    result({ id: "other", templateId: "template-b", workoutTitle: "Stejný název" }),
  ]);

  assert.equal(comparisons.length, 0);
});

test("neplatný čas nevytvoří procentní změnu", () => {
  const comparisons = buildComparableWorkouts([
    result({ durationSeconds: 0 }),
    result({ id: "other", durationSeconds: Number.NaN }),
  ]);

  assert.equal(comparisons.length, 0);
});
