import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_TRAINING_EQUIPMENT,
  findLocationAlternatives,
  requiredEquipmentForTemplate,
  resolveTrainingLocation,
  templateFitsLocation,
} from "../lib/training-context.ts";

function template(id, title, category, steps, durationMinutes = 45) {
  return {
    id,
    title,
    description: "",
    durationMinutes,
    tags: [],
    metadata: {
      workoutCode: id,
      templateVersion: 1,
      category,
      goal: "",
      targetRpeMin: 5,
      targetRpeMax: 7,
      expectedDurationMin: durationMinutes - 5,
      expectedDurationMax: durationMinutes + 5,
      runningTarget: "",
      primaryMetric: "",
      secondaryMetrics: [],
      progressionGroup: category,
      difficultyLevel: 2,
    },
    blocks: [{
      id: `${id}-block`,
      type: "manual",
      title: "Main",
      repeat: 1,
      steps: steps.map((name, index) => ({ id: `${id}-${index}`, name, detail: "" })),
    }],
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
}

test("equipment inference only returns equipment actually named by the workout", () => {
  const workout = template("mixed", "Mixed", "mixed", ["600 m běh", "500 m SkiErg", "12 wall balls"]);
  assert.deepEqual(requiredEquipmentForTemplate(workout).sort(), ["running", "ski-erg", "wall-ball"].sort());
});

test("medicine ball and wall ball remain distinct equipment", () => {
  const workout = template("balls", "Balls", "strength", ["10 medicine ball slams", "15 wall balls"]);
  assert.deepEqual(requiredEquipmentForTemplate(workout).sort(), ["medicine-ball", "wall-ball"].sort());
});

test("complete equipment checklist contains general gym and hybrid equipment", () => {
  for (const equipment of ["dumbbell", "kettlebell", "medicine-ball", "ski-erg", "rower", "sled", "treadmill", "rack"]) {
    assert.ok(ALL_TRAINING_EQUIPMENT.includes(equipment));
  }
});

test("outdoor preset rejects machine workouts and accepts running/bodyweight", () => {
  const machine = template("machine", "Engine", "base-engine", ["500 m veslo", "500 m SkiErg"]);
  const outdoor = template("outdoor", "Outdoor", "base-engine", ["2 km běh", "10 burpee broad jumps"]);
  assert.equal(templateFitsLocation(machine, "outdoor"), false);
  assert.equal(templateFitsLocation(outdoor, "outdoor"), true);
});

test("custom location uses only equipment the user kept checked", () => {
  const location = {
    id: "location-test-gym",
    name: "Test gym",
    equipment: ["dumbbell", "kettlebell", "rower"],
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
  const rowWorkout = template("row", "Row", "base-engine", ["1000 m veslo"]);
  const skiWorkout = template("ski", "Ski", "base-engine", ["1000 m SkiErg"]);

  assert.equal(resolveTrainingLocation(location.id, [location])?.label, "Test gym");
  assert.equal(templateFitsLocation(rowWorkout, location.id, [location]), true);
  assert.equal(templateFitsLocation(skiWorkout, location.id, [location]), false);
});

test("location alternatives preserve category before unrelated workouts", () => {
  const current = template("current", "Hybrid", "mixed", ["500 m SkiErg", "10 wall balls"], 45);
  const sameCategory = template("same", "Outdoor mixed", "mixed", ["1 km běh", "10 burpee broad jumps"], 40);
  const otherCategory = template("other", "Outdoor engine", "base-engine", ["3 km běh"], 45);
  const alternatives = findLocationAlternatives({
    current,
    templates: [current, otherCategory, sameCategory],
    location: "outdoor",
  });
  assert.equal(alternatives[0]?.id, "same");
});
