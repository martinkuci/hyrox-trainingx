import assert from "node:assert/strict";
import test from "node:test";
import { applyTrainingAdaptationDecision, buildTrainingAdaptation } from "../lib/training-adaptation.ts";

function template(id, difficulty, category = "strength") {
  return {
    id,
    title: `${category} ${difficulty}`,
    description: "",
    durationMinutes: 45,
    tags: [],
    metadata: {
      workoutCode: `${category}-${difficulty}`,
      templateVersion: 1,
      category,
      goal: "",
      targetRpeMin: 6,
      targetRpeMax: 7,
      expectedDurationMin: 40,
      expectedDurationMax: 50,
      runningTarget: "",
      primaryMetric: "",
      secondaryMetrics: [],
      progressionGroup: category,
      difficultyLevel: difficulty,
    },
    blocks: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function result(id, rpe, completedAt, templateId = "strength-2", scheduledWorkoutId = "done") {
  return {
    id,
    templateId,
    workoutTitle: "Síla",
    scheduledWorkoutId,
    completedAt,
    durationSeconds: 2700,
    rpe,
    weights: "",
    notes: "",
    splits: [],
  };
}

const templates = [template("strength-1", 1), template("strength-2", 2), template("strength-3", 3), template("run-1", 1, "base-engine")];
const schedules = [
  { id: "done", templateId: "strength-2", date: "2026-08-18", time: "18:00", status: "completed", programId: "program" },
  { id: "next-run", templateId: "run-1", date: "2026-08-20", time: "18:00", status: "planned", programId: "program" },
  { id: "next-strength", templateId: "strength-2", date: "2026-08-22", time: "18:00", status: "planned", programId: "program" },
];

test("one overly hard result proposes the next lighter workout in the same category", () => {
  const recommendation = buildTrainingAdaptation({
    results: [result("hard", 9, "2026-08-18T19:00:00.000Z")],
    templates,
    scheduledWorkouts: schedules,
  });

  assert.equal(recommendation.direction, "reduce");
  assert.equal(recommendation.targetScheduleId, "next-strength");
  assert.equal(recommendation.currentTemplateId, "strength-2");
  assert.equal(recommendation.recommendedTemplateId, "strength-1");
});

test("very hard block feedback can propose a lighter workout even when total RPE is on target", () => {
  const hardBlocks = {
    ...result("hard-blocks", 7, "2026-08-18T19:00:00.000Z"),
    blockFeedbacks: [
      { blockId: "one", rating: 1 },
      { blockId: "two", rating: 2 },
    ],
  };
  const recommendation = buildTrainingAdaptation({
    results: [hardBlocks],
    templates,
    scheduledWorkouts: schedules,
  });

  assert.equal(recommendation.direction, "reduce");
  assert.equal(recommendation.recommendedTemplateId, "strength-1");
});

test("one easy result does not increase difficulty", () => {
  const recommendation = buildTrainingAdaptation({
    results: [result("easy", 4, "2026-08-18T19:00:00.000Z")],
    templates,
    scheduledWorkouts: schedules,
  });

  assert.equal(recommendation.direction, "maintain");
  assert.equal(recommendation.recommendedTemplateId, undefined);
  assert.match(recommendation.rationale, /druhý podobný výsledek/);
});

test("two easy results propose one difficulty step up", () => {
  const recommendation = buildTrainingAdaptation({
    results: [
      result("latest", 4, "2026-08-18T19:00:00.000Z"),
      result("previous", 5, "2026-08-11T19:00:00.000Z", "strength-1", "older"),
    ],
    templates,
    scheduledWorkouts: schedules,
  });

  assert.equal(recommendation.direction, "increase");
  assert.equal(recommendation.recommendedTemplateId, "strength-3");
});

test("manual or shorter future unit is never overwritten", () => {
  const recommendation = buildTrainingAdaptation({
    results: [result("hard", 9, "2026-08-18T19:00:00.000Z")],
    templates,
    scheduledWorkouts: schedules.map((schedule) => schedule.id === "next-strength" ? { ...schedule, originalTemplateId: "strength-3" } : schedule),
  });

  assert.equal(recommendation.direction, "reduce");
  assert.equal(recommendation.targetScheduleId, undefined);
});

test("dismissed or accepted latest result does not create another recommendation", () => {
  const decided = {
    ...result("decided", 9, "2026-08-18T19:00:00.000Z"),
    adaptationDecision: {
      status: "dismissed",
      direction: "reduce",
      scheduleId: "next-strength",
      originalTemplateId: "strength-2",
      recommendedTemplateId: "strength-1",
      decidedAt: "2026-08-18T20:00:00.000Z",
    },
  };

  assert.equal(buildTrainingAdaptation({ results: [decided], templates, scheduledWorkouts: schedules }), null);
});

test("accepting a valid recommendation changes schedule and result atomically", () => {
  const sourceResult = result("hard", 9, "2026-08-18T19:00:00.000Z");
  const data = {
    version: 1,
    templates,
    scheduledWorkouts: schedules,
    results: [sourceResult],
    weeklyPlans: [],
    trainingPrograms: [],
  };
  const decision = {
    status: "accepted",
    direction: "reduce",
    scheduleId: "next-strength",
    originalTemplateId: "strength-2",
    recommendedTemplateId: "strength-1",
    decidedAt: "2026-08-18T20:00:00.000Z",
  };
  const applied = applyTrainingAdaptationDecision(data, sourceResult.id, decision);

  assert.equal(applied.ok, true);
  assert.equal(applied.data.scheduledWorkouts.find((item) => item.id === "next-strength").templateId, "strength-1");
  assert.equal(applied.data.scheduledWorkouts.find((item) => item.id === "next-strength").originalTemplateId, "strength-2");
  assert.deepEqual(applied.data.results[0].adaptationDecision, decision);
});

test("a stale recommendation cannot overwrite a manually changed schedule", () => {
  const sourceResult = result("hard", 9, "2026-08-18T19:00:00.000Z");
  const data = {
    version: 1,
    templates,
    scheduledWorkouts: schedules.map((schedule) => schedule.id === "next-strength" ? { ...schedule, templateId: "strength-1" } : schedule),
    results: [sourceResult],
    weeklyPlans: [],
    trainingPrograms: [],
  };
  const applied = applyTrainingAdaptationDecision(data, sourceResult.id, {
    status: "accepted",
    direction: "reduce",
    scheduleId: "next-strength",
    originalTemplateId: "strength-2",
    recommendedTemplateId: "strength-1",
    decidedAt: "2026-08-18T20:00:00.000Z",
  });

  assert.equal(applied.ok, false);
  assert.equal(applied.data, data);
});
