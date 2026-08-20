import assert from "node:assert/strict";
import test from "node:test";
import { exerciseFitsEquipment, getExercise } from "../lib/exercise-catalog.ts";
import { TRAINING_LOCATION_PRESETS } from "../lib/training-context.ts";
import { buildGeneratedWorkout } from "../lib/workout-composer.ts";

const goals = ["hyrox", "engine", "strength", "mixed", "recovery"];

test("generated workouts contain real catalog exercises compatible with the selected gym", () => {
  const equipment = TRAINING_LOCATION_PRESETS["standard-gym"].equipment;
  for (const goal of goals) {
    const workout = buildGeneratedWorkout({
      equipment,
      goal,
      durationMinutes: 45,
      seed: `standard-${goal}`,
      locationLabel: "Běžné fitko",
    });
    const steps = workout.blocks.flatMap((block) => block.steps);
    assert.ok(steps.length > 0, `${goal} should contain exercises`);
    for (const step of steps) {
      assert.ok(step.exerciseId, `${step.name} is missing exerciseId`);
      const exercise = getExercise(step.exerciseId);
      assert.ok(exercise, `Missing exercise ${step.exerciseId}`);
      assert.equal(exerciseFitsEquipment(exercise, equipment), true, `${exercise.name} does not fit standard gym`);
    }
  }
});

test("generated workout does not duplicate the same exercise across blocks", () => {
  const workout = buildGeneratedWorkout({
    equipment: TRAINING_LOCATION_PRESETS["hybrid-gym"].equipment,
    goal: "mixed",
    durationMinutes: 60,
    seed: "unique-mixed",
  });
  const ids = workout.blocks.flatMap((block) => block.steps.map((step) => step.exerciseId));
  assert.equal(new Set(ids).size, ids.length);
});

test("outdoor generator stays within outdoor equipment", () => {
  const equipment = TRAINING_LOCATION_PRESETS.outdoor.equipment;
  const workout = buildGeneratedWorkout({
    equipment,
    goal: "engine",
    durationMinutes: 30,
    seed: "outdoor-engine",
    locationLabel: "Venku",
  });
  const steps = workout.blocks.flatMap((block) => block.steps);
  assert.ok(steps.length > 0);
  for (const step of steps) {
    const exercise = getExercise(step.exerciseId);
    assert.ok(exercise);
    assert.equal(exerciseFitsEquipment(exercise, equipment), true);
  }
});

test("generated metadata keeps requested duration and goal identity", () => {
  const workout = buildGeneratedWorkout({
    equipment: TRAINING_LOCATION_PRESETS.home.equipment,
    goal: "strength",
    durationMinutes: 20,
    seed: "home-strength",
  });
  assert.equal(workout.durationMinutes, 20);
  assert.equal(workout.metadata?.goal, "Síla");
  assert.equal(workout.metadata?.category, "strength");
  assert.ok(workout.tags.includes("enginn-generated"));
});
