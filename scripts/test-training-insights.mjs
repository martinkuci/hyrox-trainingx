import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCategoryInsights,
  buildComparableWorkouts,
  buildTrainingPeriodComparison,
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

test("srovnávaná období jsou stejně dlouhá, nepřekrývají se a ignorují budoucnost", () => {
  const comparison = buildTrainingPeriodComparison([
    result({ id: "current-start", completedAt: "2026-07-16T12:00:00.000Z", durationSeconds: 1200, rpe: 6 }),
    result({ id: "current", completedAt: "2026-08-01T12:00:00.000Z", durationSeconds: 1800, rpe: 8 }),
    result({ id: "previous", completedAt: "2026-07-01T12:00:00.000Z", durationSeconds: 2400, rpe: 7 }),
    result({ id: "boundary", completedAt: "2026-07-16T11:59:59.999Z", durationSeconds: 600, rpe: 5 }),
    result({ id: "future", completedAt: "2026-08-14T12:00:00.001Z", durationSeconds: 9999, rpe: 10 }),
    result({ id: "invalid", completedAt: "invalid", durationSeconds: 9999, rpe: 10 }),
  ], [], new Date("2026-08-13T12:00:00.000Z"), 4);

  assert.equal(comparison.current.sessionCount, 2);
  assert.equal(comparison.current.durationSeconds, 3000);
  assert.equal(comparison.current.averageRpe, 7);
  assert.equal(comparison.previous.sessionCount, 2);
  assert.equal(comparison.previous.durationSeconds, 3000);
  assert.equal(comparison.previous.averageRpe, 6);
  assert.equal(comparison.currentStartDate, comparison.previousEndDate);
});

test("kategorie používají snapshot, šablonu i bezpečnou skupinu Ostatní", () => {
  const metadata = {
    category: "strength",
    targetRpeMin: 6,
    targetRpeMax: 8,
  };
  const categories = buildCategoryInsights([
    result({ id: "snapshot", durationSeconds: 1800, rpe: 7, metadataSnapshot: { ...metadata, category: "base-engine" } }),
    result({ id: "template", durationSeconds: 1200, rpe: 9 }),
    result({ id: "other", templateId: "missing", durationSeconds: 600, rpe: Number.NaN }),
  ], [{ id: "template-a", metadata }], new Date("2026-08-13T12:00:00.000Z"), 4);

  assert.deepEqual(categories.map((item) => item.category), ["base-engine", "strength", "other"]);
  assert.equal(categories[0].targetRpeMatches, 1);
  assert.equal(categories[1].targetRpeMatches, 0);
  assert.equal(categories[2].averageRpe, null);
  assert.equal(categories.reduce((sum, item) => sum + item.sessionCount, 0), 3);
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
