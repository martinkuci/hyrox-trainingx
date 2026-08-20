import assert from "node:assert/strict";
import test from "node:test";
import { EXERCISE_LIBRARY, exerciseFitsEquipment, getExercise } from "../lib/exercise-catalog.ts";
import {
  buildRecoveryPlan,
  buildWorkoutRecoveryPlan,
  inferWorkoutRecoveryAreas,
} from "../lib/recovery-builder.ts";

test("3B.2 adds a meaningful recovery and prehab catalog", () => {
  const recoveryExercises = EXERCISE_LIBRARY.filter((exercise) =>
    ["warmup", "mobility", "compensation", "recovery"].includes(exercise.category),
  );
  assert.ok(recoveryExercises.length >= 25, `Expected at least 25 recovery-oriented exercises, got ${recoveryExercises.length}`);
  const ids = recoveryExercises.map((exercise) => exercise.id);
  assert.equal(new Set(ids).size, ids.length, "Recovery exercise ids must be unique");
});

test("no-equipment cooldown can always generate a short plan", () => {
  const plan = buildRecoveryPlan({
    equipment: ["none"],
    intent: "cooldown",
    area: "full-body",
    durationMinutes: 8,
    seed: "cooldown-test",
  });
  assert.equal(plan.exercises.length, 3);
  for (const item of plan.exercises) {
    const exercise = getExercise(item.exerciseId);
    assert.ok(exercise, `Missing ${item.exerciseId}`);
    assert.equal(exerciseFitsEquipment(exercise, ["none"]), true, `${item.name} requires unavailable equipment`);
  }
});

test("prehab builder respects selected gym equipment", () => {
  const equipment = ["none", "resistance-band", "mat"];
  const plan = buildRecoveryPlan({
    equipment,
    intent: "prehab",
    area: "shoulders",
    durationMinutes: 10,
    seed: "shoulder-prehab",
  });
  assert.ok(plan.exercises.length >= 3);
  for (const item of plan.exercises) {
    const exercise = getExercise(item.exerciseId);
    assert.ok(exercise);
    assert.equal(exerciseFitsEquipment(exercise, equipment), true);
  }
});

test("workout load inference identifies relevant recovery areas", () => {
  const template = {
    id: "recovery-test-workout",
    title: "Run + Wall Ball",
    description: "Synthetic recovery inference test",
    durationMinutes: 30,
    tags: ["test"],
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    blocks: [
      {
        id: "main",
        type: "manual",
        title: "Main",
        repeat: 1,
        steps: [
          { id: "run", name: "Běh", detail: "1000 m", exerciseId: "run" },
          { id: "wall-ball", name: "Wall Ball", detail: "30 opakování", exerciseId: "wall-ball" },
        ],
      },
    ],
  };
  const inferred = inferWorkoutRecoveryAreas(template);
  assert.ok(inferred.length > 0);
  assert.ok(inferred.some((item) => item.area === "ankles-calves" || item.area === "hips"));
});

test("workout-specific recovery plan uses inferred load and compatible exercises", () => {
  const template = {
    id: "recovery-test-strength",
    title: "Press + Pull",
    description: "Synthetic upper body test",
    durationMinutes: 40,
    tags: ["test"],
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    blocks: [
      {
        id: "main",
        type: "manual",
        title: "Main",
        repeat: 3,
        steps: [
          { id: "press", name: "Strict Press", detail: "8 reps", exerciseId: "barbell-strict-press" },
          { id: "pull", name: "Pull-up", detail: "8 reps", exerciseId: "pull-up" },
        ],
      },
    ],
  };
  const equipment = ["none", "resistance-band", "mat", "bench", "box"];
  const plan = buildWorkoutRecoveryPlan({ template, equipment, when: "after", durationMinutes: 8 });
  assert.equal(plan.intent, "cooldown");
  assert.ok(plan.exercises.length > 0);
  for (const item of plan.exercises) {
    const exercise = getExercise(item.exerciseId);
    assert.ok(exercise);
    assert.equal(exerciseFitsEquipment(exercise, equipment), true);
  }
});
