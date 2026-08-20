import assert from "node:assert/strict";
import test from "node:test";
import { buildEnginnExtra } from "../lib/enginn-extra.ts";
import { exerciseFitsEquipment, getExercise } from "../lib/exercise-catalog.ts";

test("Enginn Extra keeps requested duration and focus", () => {
  const plan = buildEnginnExtra({
    equipment: ["none"],
    focus: "core",
    durationMinutes: 8,
    seed: "core-test",
  });
  assert.equal(plan.focus, "core");
  assert.equal(plan.durationMinutes, 8);
  assert.equal(plan.exercises.length, 3);
});

test("Enginn Extra uses only exercises compatible with available equipment", () => {
  const equipment = ["none", "dumbbell", "kettlebell", "mat"];
  const plan = buildEnginnExtra({
    equipment,
    focus: "legs",
    durationMinutes: 10,
    seed: "equipment-test",
  });
  assert.ok(plan.exercises.length > 0);
  for (const item of plan.exercises) {
    const exercise = getExercise(item.exerciseId);
    assert.ok(exercise, `Missing exercise ${item.exerciseId}`);
    assert.equal(exerciseFitsEquipment(exercise, equipment), true, `${item.name} does not fit equipment`);
  }
});

test("Enginn Extra does not duplicate exercises inside one block", () => {
  const plan = buildEnginnExtra({
    equipment: ["none", "running", "treadmill", "rower", "air-bike", "bike-erg", "jump-rope"],
    focus: "cardio",
    durationMinutes: 10,
    seed: "cardio-test",
  });
  const ids = plan.exercises.map((exercise) => exercise.exerciseId);
  assert.equal(new Set(ids).size, ids.length);
});

test("mobility and recovery can generate a no-equipment Extra", () => {
  for (const focus of ["mobility", "recovery"]) {
    const plan = buildEnginnExtra({ equipment: ["none"], focus, durationMinutes: 5, seed: focus });
    assert.ok(plan.exercises.length > 0, `${focus} should have at least one no-equipment option`);
  }
});
