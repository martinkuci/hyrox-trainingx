import assert from "node:assert/strict";
import test from "node:test";
import {
  findLocationAlternatives,
  requiredEquipmentForTemplate,
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

test("outdoor preset rejects machine workouts and accepts running/bodyweight", () => {
  const machine = template("machine", "Engine", "base-engine", ["500 m veslo", "500 m SkiErg"]);
  const outdoor = template("outdoor", "Outdoor", "base-engine", ["2 km běh", "10 burpee broad jumps"]);
  assert.equal(templateFitsLocation(machine, "outdoor"), false);
  assert.equal(templateFitsLocation(outdoor, "outdoor"), true);
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
