import assert from "node:assert/strict";
import test from "node:test";
import {
  findFinisherExercises,
  getExerciseForStep,
  inferExerciseFromText,
} from "../lib/exercise-catalog.ts";
import { applyExerciseOverrides } from "../lib/exercise-substitution.ts";
import { planTrainingLocationChange } from "../lib/training-location-change.ts";

function template(id, steps) {
  return {
    id,
    title: "HYROX mixed",
    description: "",
    durationMinutes: 45,
    tags: [],
    metadata: {
      workoutCode: id,
      templateVersion: 1,
      category: "mixed",
      goal: "",
      targetRpeMin: 6,
      targetRpeMax: 8,
      expectedDurationMin: 40,
      expectedDurationMax: 50,
      runningTarget: "",
      primaryMetric: "",
      secondaryMetrics: [],
      progressionGroup: "mixed",
      difficultyLevel: 2,
    },
    blocks: [{
      id: `${id}-block`,
      type: "manual",
      title: "Main",
      repeat: 1,
      steps: steps.map((name, index) => ({ id: `${id}-step-${index}`, name, detail: "" })),
    }],
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

test("legacy text step is linked to a single catalog exercise", () => {
  assert.equal(inferExerciseFromText("500 m SkiErg")?.id, "ski-erg");
  assert.equal(getExerciseForStep({ name: "20 Wall Balls", detail: "", exerciseId: undefined })?.id, "wall-ball");
});

test("legacy OR step remains an equipment alternative instead of being collapsed", () => {
  assert.equal(inferExerciseFromText("500 m SkiErg nebo veslo"), undefined);
  assert.equal(inferExerciseFromText("5 min run or row"), undefined);
});

test("location change keeps workout identity and replaces only unavailable exercises", () => {
  const workout = template("mixed", ["500 m SkiErg", "20 Wall Balls", "10 Burpee Broad Jumps"]);
  const gym = {
    id: "location-basic-gym",
    name: "Basic gym",
    equipment: ["rower", "dumbbell"],
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
  const schedule = {
    id: "schedule-1",
    templateId: workout.id,
    date: "2026-08-20",
    time: "18:00",
    status: "planned",
  };

  const plan = planTrainingLocationChange({
    schedule,
    currentTemplate: workout,
    templates: [workout],
    location: gym.id,
    customLocations: [gym],
  });

  assert.equal(plan.outcome, "adapted-exercises");
  assert.equal(plan.updates.templateId, workout.id);
  assert.equal(plan.updates.originalTemplateId, undefined);
  assert.equal(plan.updates.exerciseOverrides?.length, 2);

  const adapted = applyExerciseOverrides(workout, plan.updates.exerciseOverrides);
  const names = adapted.blocks[0].steps.map((step) => step.name);
  assert.ok(names.includes("Veslo"));
  assert.ok(names.includes("Dumbbell Thruster"));
  assert.ok(names.includes("Burpee Broad Jumps"));
});

test("core finisher suggestions respect available equipment", () => {
  const bodyweight = findFinisherExercises({ equipment: [], focus: "core", limit: 20 });
  assert.ok(bodyweight.length > 0);
  assert.ok(bodyweight.some((exercise) => exercise.id === "plank" || exercise.id === "v-up"));
  assert.equal(bodyweight.some((exercise) => exercise.id === "cable-crunch"), false);

  const cableGym = findFinisherExercises({ equipment: ["cable-machine", "ab-wheel"], focus: "core", limit: 30 });
  assert.ok(cableGym.some((exercise) => exercise.id === "cable-crunch"));
  assert.ok(cableGym.some((exercise) => exercise.id === "ab-wheel-rollout"));
});
