import assert from "node:assert/strict";
import test from "node:test";
import { buildStructuredTeamAssignments } from "../lib/team-assignment-builder.ts";
import { buildStructuredTeamPacingPlan } from "../lib/team-pacing-v2.ts";

const participants = [
  { id: "a", userId: "u-a", displayName: "A", role: "host", status: "joined" },
  { id: "b", userId: "u-b", displayName: "B", role: "athlete", status: "joined" },
];

const repeatedTemplate = {
  id: "repeat-four",
  title: "4 kola",
  description: "Regression fixture",
  durationMinutes: 40,
  tags: ["test"],
  blocks: [
    { id: "warm", type: "manual", title: "Rozcvičení", repeat: 1, steps: [{ id: "warm-run", name: "5 min lehký klus", detail: "Plynule." }] },
    { id: "main", type: "manual", title: "4 kola bez zastavení", repeat: 4, steps: [
      { id: "run", name: "6 min běh", detail: "Z2, kontrolované dýchání.", exerciseId: "run" },
      { id: "ski", name: "500 m SkiErg", detail: "Plynulý záběr.", exerciseId: "ski-erg" },
    ] },
    { id: "cool", type: "manual", title: "Zklidnění", repeat: 1, steps: [{ id: "cool", name: "5 min velmi lehce", detail: "Vychození." }] },
  ],
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
};

test("manual repeat expands into every real team-workout round", () => {
  const assignments = buildStructuredTeamAssignments({ template: repeatedTemplate, participants, format: "doubles" });
  const main = assignments.filter((assignment) => assignment.blockId === "main");
  assert.equal(main.length, 8);
  assert.deepEqual(main.map((assignment) => assignment.round), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.ok(main.every((assignment) => assignment.totalRounds === 4));
});

test("timed running prescription is not misread as repetitions", () => {
  const assignments = buildStructuredTeamAssignments({ template: repeatedTemplate, participants, format: "doubles" });
  const run = assignments.find((assignment) => assignment.stepId === "run");
  assert.equal(run?.targetReps, undefined);
  assert.equal(run?.targetDistanceMeters, undefined);
});

test("structured pacing keeps a six-minute prescription near its real duration", () => {
  const assignments = buildStructuredTeamAssignments({ template: repeatedTemplate, participants, format: "doubles" });
  const plan = buildStructuredTeamPacingPlan({ assignments, targetWorkoutSeconds: 40 * 60, participantCount: 2, format: "doubles" });
  const runs = assignments.filter((assignment) => assignment.stepId === "run");
  assert.ok(runs.every((assignment) => (plan[assignment.id]?.movementTargetSeconds ?? 0) === 360));
  const ski = assignments.find((assignment) => assignment.stepId === "ski");
  assert.ok((plan[ski.id]?.targetSeconds ?? 0) < 10 * 60);
});
