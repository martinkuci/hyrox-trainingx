import assert from "node:assert/strict";
import test from "node:test";
import {
  inferDisciplineIdsFromText,
  inferTemplateDisciplineIds,
} from "../lib/training-domain.ts";
import { getSessionBlueprints } from "../lib/program-generation-policy.ts";
import { buildProgramWeeks, phaseForWeek } from "../lib/program-generator.ts";

function template(id, category, difficulty, stepName) {
  return {
    id,
    title: id,
    description: "",
    durationMinutes: 45,
    tags: [],
    metadata: {
      workoutCode: id,
      templateVersion: 1,
      category,
      goal: "",
      targetRpeMin: 5,
      targetRpeMax: 7,
      expectedDurationMin: 40,
      expectedDurationMax: 50,
      runningTarget: "",
      primaryMetric: "",
      secondaryMetrics: [],
      progressionGroup: category,
      difficultyLevel: difficulty,
    },
    blocks: [
      {
        id: `${id}-block`,
        type: "manual",
        title: "Main",
        repeat: 1,
        steps: [{ id: `${id}-step`, name: stepName, detail: "" }],
      },
    ],
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
}

test("discipline inference recognizes Enginn and HYROX movement names", () => {
  assert.deepEqual(inferDisciplineIdsFromText("1 km běh + 50 m Sled Push"), [
    "run",
    "sled-push",
  ]);
  assert.deepEqual(inferDisciplineIdsFromText("100 Wall Balls"), ["wall-ball"]);
});

test("template discipline inference reads workout blocks without changing template schema", () => {
  const workout = template(
    "hybrid",
    "mixed",
    2,
    "600 m běh + 12 wall balls + 250 m veslo",
  );

  assert.deepEqual(inferTemplateDisciplineIds(workout), [
    "run",
    "row",
    "wall-ball",
  ]);
});

test("race-specific policy exposes concrete target disciplines", () => {
  const [session] = getSessionBlueprints("race", "specific", 3);
  assert.equal(session.category, "race-simulation");
  assert.equal(session.focus, "race-specific");
  assert.ok(session.preferredDisciplines.includes("sled-push"));
  assert.ok(session.preferredDisciplines.includes("wall-ball"));
});

test("program phases remain backward compatible", () => {
  assert.equal(phaseForWeek(1, 12), "base");
  assert.equal(phaseForWeek(4, 12), "deload");
  assert.equal(phaseForWeek(7, 12), "build");
  assert.equal(phaseForWeek(9, 12), "specific");
  assert.equal(phaseForWeek(12, 12), "taper");
});

test("generator prefers a discipline match inside the requested category", () => {
  const templates = [
    template("base-row", "base-engine", 1, "1000 m veslo"),
    template("base-run", "base-engine", 1, "30 min běh"),
    template("strength", "strength", 1, "Goblet squat"),
    template("builder", "base-builder", 1, "Lehký běh"),
  ];
  let session = 0;
  const [week] = buildProgramWeeks({
    templates,
    duration: 2,
    frequency: 1,
    goal: "race",
    level: 1,
    days: [1],
    makeSessionId: () => `session-${++session}`,
  });

  assert.equal(week.phase, "base");
  assert.equal(week.sessions[0].templateId, "base-run");
  assert.equal(week.sessions[0].weekday, 1);
});
