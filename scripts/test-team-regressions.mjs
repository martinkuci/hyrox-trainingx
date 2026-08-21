import assert from "node:assert/strict";
import test from "node:test";
import { buildTeamPacingPlan, pacingDeltaBeforeAssignment } from "../lib/team-pacing.ts";
import { buildTeamAssignments, deriveTeamWorkoutState } from "../lib/team-workout-engine.ts";

const participants = [
  { id: "a", userId: "u-a", displayName: "A", role: "host", status: "joined" },
  { id: "b", userId: "u-b", displayName: "B", role: "athlete", status: "joined" },
];

const relayTemplate = {
  id: "relay-contribution-regression",
  title: "Relay regression",
  description: "Regression fixture",
  durationMinutes: 30,
  tags: ["test"],
  blocks: [{
    id: "main",
    type: "manual",
    title: "Hlavní workout",
    repeat: 1,
    steps: [
      { id: "run", name: "1 km běh", detail: "Rovnoměrně.", exerciseId: "run" },
      { id: "wall", name: "100 Wall Balls", detail: "Plynule.", exerciseId: "wall-ball" },
    ],
  }],
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
};

function relaySession(assignments) {
  return {
    version: 1,
    id: "ENG-TEST-1234",
    joinCode: "ENG-TEST-1234",
    workoutTemplateId: relayTemplate.id,
    workoutTemplate: relayTemplate,
    format: "relay",
    hostUserId: "u-a",
    status: "running",
    participantLimit: 2,
    participants,
    assignments,
    createdAt: "2026-08-21T18:00:00.000Z",
    startedAt: "2026-08-21T18:00:00.000Z",
  };
}

test("relay keeps prescribed distance and reps for automatic contribution tracking", () => {
  const assignments = buildTeamAssignments({ template: relayTemplate, participants, format: "relay" });
  assert.equal(assignments[0].mode, "relay");
  assert.equal(assignments[0].targetDistanceMeters, 1000);
  assert.equal(assignments[0].targetReps, undefined);
  assert.equal(assignments[1].targetReps, 100);
  assert.equal(assignments[1].targetDistanceMeters, undefined);
});

test("relay completion automatically credits prescribed work and tracked time", () => {
  const assignments = buildTeamAssignments({ template: relayTemplate, participants, format: "relay" });
  const session = relaySession(assignments);
  const events = [
    { id: "start", type: "session-started", participantId: "a", at: "2026-08-21T18:00:00.000Z" },
    { id: "done-run", type: "participant-step-completed", participantId: "a", assignmentId: assignments[0].id, at: "2026-08-21T18:05:00.000Z" },
    { id: "done-wall", type: "participant-step-completed", participantId: "b", assignmentId: assignments[1].id, at: "2026-08-21T18:08:00.000Z" },
  ];
  const state = deriveTeamWorkoutState(session, events);
  assert.equal(state.contributions.a.distanceMeters, 1000);
  assert.equal(state.contributions.a.durationSeconds, 300);
  assert.equal(state.contributions.b.reps, 100);
  assert.equal(state.contributions.b.durationSeconds, 180);
});

test("activity-aware pacing gives different targets and honours the selected total target", () => {
  const assignments = [
    { id: "run", sequence: 0, blockId: "main", blockTitle: "Race", stepId: "run", stepName: "1000 m běh", exerciseId: "run", mode: "shared-distance", participantIds: ["a", "b"], targetDistanceMeters: 1000 },
    { id: "ski", sequence: 1, blockId: "main", blockTitle: "Race", stepId: "ski", stepName: "1000 m SkiErg", exerciseId: "ski-erg", mode: "shared-distance", participantIds: ["a", "b"], targetDistanceMeters: 1000 },
    { id: "sled", sequence: 2, blockId: "main", blockTitle: "Race", stepId: "sled", stepName: "50 m Sled Push", exerciseId: "sled-push", mode: "shared-distance", participantIds: ["a", "b"], targetDistanceMeters: 50 },
    { id: "bbj", sequence: 3, blockId: "main", blockTitle: "Race", stepId: "bbj", stepName: "80 m Burpee Broad Jumps", exerciseId: "burpee-broad-jump", mode: "shared-distance", participantIds: ["a", "b"], targetDistanceMeters: 80 },
    { id: "wall", sequence: 4, blockId: "main", blockTitle: "Race", stepId: "wall", stepName: "100 Wall Balls", exerciseId: "wall-ball", mode: "shared-reps", participantIds: ["a", "b"], targetReps: 100 },
  ];
  const target = 3600;
  const plan = buildTeamPacingPlan({ assignments, targetWorkoutSeconds: target, participantCount: 2, format: "doubles" });
  const sum = assignments.reduce((total, assignment) => total + (plan[assignment.id].targetSeconds ?? 0), 0);
  assert.ok(Math.abs(sum - target) <= assignments.length);
  assert.notEqual(plan.run.targetSeconds, plan.ski.targetSeconds);
  assert.notEqual(plan.ski.targetSeconds, plan.sled.targetSeconds);
  assert.match(plan.run.paceLabel ?? "", /\/ km/);
  assert.match(plan.ski.paceLabel ?? "", /\/ 500 m/);
});

test("live pacing delta reports completed work ahead of the plan", () => {
  const assignments = [
    { id: "first", sequence: 0, blockId: "main", blockTitle: "Race", stepId: "first", stepName: "1000 m běh", exerciseId: "run", mode: "relay", participantIds: ["a"], targetDistanceMeters: 1000 },
    { id: "second", sequence: 1, blockId: "main", blockTitle: "Race", stepId: "second", stepName: "1000 m SkiErg", exerciseId: "ski-erg", mode: "relay", participantIds: ["b"], targetDistanceMeters: 1000 },
  ];
  const events = [
    { id: "done-first", type: "participant-step-completed", participantId: "a", assignmentId: "first", at: "2026-08-21T18:04:50.000Z" },
  ];
  const delta = pacingDeltaBeforeAssignment(assignments, events, "2026-08-21T18:00:00.000Z", "second", {
    first: { assignmentId: "first", targetSeconds: 300, cue: "" },
    second: { assignmentId: "second", targetSeconds: 300, cue: "" },
  });
  assert.equal(delta, -10);
});
