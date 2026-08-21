import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptiveProgressOptions,
  buildTeamPacingPlan,
  classifyTeamWorkoutPhase,
  deriveTeamWorkoutTiming,
  recommendedWorkoutTargetSeconds,
} from "../lib/team-pacing.ts";

const template = {
  id: "race-test",
  title: "Race test",
  description: "",
  durationMinutes: 35,
  tags: [],
  metadata: {
    workoutCode: "TEST",
    templateVersion: 1,
    category: "race-simulation",
    goal: "",
    targetRpeMin: 7,
    targetRpeMax: 8,
    expectedDurationMin: 34,
    expectedDurationMax: 36,
    runningTarget: "Kontrolované závodní tempo.",
    primaryMetric: "time",
    secondaryMetrics: [],
    progressionGroup: "test",
    difficultyLevel: 1,
  },
  blocks: [
    { id: "warm", type: "manual", title: "Závodní rozcvičení", repeat: 1, steps: [{ id: "w1", name: "10 min lehce", detail: "" }] },
    { id: "main", type: "manual", title: "Race", repeat: 1, steps: [{ id: "s1", name: "500 m SkiErg", detail: "" }, { id: "s2", name: "30 m Burpee Broad Jump", detail: "" }] },
    { id: "cool", type: "manual", title: "Zklidnění", repeat: 1, steps: [{ id: "c1", name: "8 min volně", detail: "" }] },
  ],
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
};

const assignments = [
  { id: "warm:w1:0", sequence: 0, blockId: "warm", blockTitle: "Závodní rozcvičení", stepId: "w1", stepName: "10 min lehce", stepDetail: "", mode: "simultaneous", participantIds: ["a", "b"] },
  { id: "main:s1:1", sequence: 1, blockId: "main", blockTitle: "Race", stepId: "s1", stepName: "500 m SkiErg", stepDetail: "", exerciseId: "ski-erg", mode: "shared-distance", participantIds: ["a", "b"], activeParticipantId: "a", targetDistanceMeters: 500 },
  { id: "main:s2:2", sequence: 2, blockId: "main", blockTitle: "Race", stepId: "s2", stepName: "30 m Burpee Broad Jump", stepDetail: "", exerciseId: "burpee-broad-jump", mode: "shared-distance", participantIds: ["a", "b"], activeParticipantId: "a", targetDistanceMeters: 30 },
  { id: "cool:c1:3", sequence: 3, blockId: "cool", blockTitle: "Zklidnění", stepId: "c1", stepName: "8 min volně", stepDetail: "", mode: "simultaneous", participantIds: ["a", "b"] },
];

test("warm-up and cooldown are recognized as non-work phases", () => {
  assert.equal(classifyTeamWorkoutPhase("Závodní rozcvičení", "10 min lehce", ""), "warmup");
  assert.equal(classifyTeamWorkoutPhase("Zklidnění", "8 min volně", ""), "cooldown");
  assert.equal(classifyTeamWorkoutPhase("Race", "500 m SkiErg", ""), "work");
});

test("workout target excludes explicit warm-up and cooldown minutes", () => {
  assert.equal(recommendedWorkoutTargetSeconds(template), 17 * 60);
});

test("adaptive progress offers include the natural half split", () => {
  assert.deepEqual(adaptiveProgressOptions(500, 0, "distance"), [125, 250, 375]);
  assert.ok(adaptiveProgressOptions(30, 0, "distance").includes(15));
  assert.deepEqual(adaptiveProgressOptions(100, 0, "reps"), [30, 50, 70]);
});

test("doubles pacing includes a split suggestion", () => {
  const plan = buildTeamPacingPlan({ assignments, targetWorkoutSeconds: 17 * 60, participantCount: 2, runningTarget: "Kontrolované tempo", format: "doubles" });
  assert.match(plan["main:s1:1"].splitSuggestion, /250 m/);
  assert.equal(plan["warm:w1:0"].targetSeconds, undefined);
  assert.equal(plan["cool:c1:3"].targetSeconds, undefined);
});

test("timing freezes workout at last work segment and keeps cooldown separate", () => {
  const events = [
    { id: "w-a", type: "participant-step-completed", participantId: "a", assignmentId: "warm:w1:0", at: "2026-08-21T10:10:00.000Z" },
    { id: "w-b", type: "participant-step-completed", participantId: "b", assignmentId: "warm:w1:0", at: "2026-08-21T10:10:00.000Z" },
    { id: "ski-a", type: "step-progress", participantId: "a", assignmentId: "main:s1:1", distanceMetersDelta: 250, at: "2026-08-21T10:12:00.000Z" },
    { id: "ski-b", type: "step-progress", participantId: "b", assignmentId: "main:s1:1", distanceMetersDelta: 250, at: "2026-08-21T10:14:00.000Z" },
    { id: "bbj-a", type: "step-progress", participantId: "a", assignmentId: "main:s2:2", distanceMetersDelta: 15, at: "2026-08-21T10:16:00.000Z" },
    { id: "bbj-b", type: "step-progress", participantId: "b", assignmentId: "main:s2:2", distanceMetersDelta: 15, at: "2026-08-21T10:20:00.000Z" },
    { id: "c-a", type: "participant-step-completed", participantId: "a", assignmentId: "cool:c1:3", at: "2026-08-21T10:28:00.000Z" },
    { id: "c-b", type: "participant-step-completed", participantId: "b", assignmentId: "cool:c1:3", at: "2026-08-21T10:28:00.000Z" },
  ];
  const timing = deriveTeamWorkoutTiming(assignments, events, "2026-08-21T10:00:00.000Z", "2026-08-21T10:28:00.000Z", Date.parse("2026-08-21T10:28:00.000Z"));
  assert.equal(timing.warmupSeconds, 600);
  assert.equal(timing.workoutSeconds, 600);
  assert.equal(timing.cooldownSeconds, 480);
  assert.equal(timing.sessionSeconds, 1680);
});
