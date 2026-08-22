import assert from "node:assert/strict";
import test from "node:test";
import { deriveParticipantMovementTotals } from "../lib/team-result-metrics.ts";

const participants = [
  { id: "a", userId: "u-a", displayName: "A", role: "host", status: "joined" },
  { id: "b", userId: "u-b", displayName: "B", role: "athlete", status: "joined" },
];

function session(assignments) {
  return {
    version: 1,
    id: "ENG-RESULT-TEST",
    joinCode: "ENG-RESULT-TEST",
    workoutTemplateId: "result-test",
    workoutTemplate: {
      id: "result-test",
      title: "Result test",
      description: "",
      durationMinutes: 30,
      tags: [],
      blocks: [],
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z",
    },
    format: "doubles",
    hostUserId: "u-a",
    status: "running",
    participantLimit: 2,
    participants,
    assignments,
    createdAt: "2026-08-22T00:00:00.000Z",
    startedAt: "2026-08-22T10:00:00.000Z",
  };
}

test("simultaneous completed runs credit the prescribed distance to both athletes", () => {
  const assignments = Array.from({ length: 4 }, (_, index) => ({
    id: `run-${index + 1}`,
    sequence: index,
    blockId: "main",
    blockTitle: "Race",
    stepId: `run-${index + 1}`,
    stepName: "500 m běh",
    exerciseId: "run",
    mode: "simultaneous",
    participantIds: ["a", "b"],
    targetDistanceMeters: 500,
    round: index + 1,
    totalRounds: 4,
  }));
  const events = assignments.flatMap((assignment, index) => [
    { id: `duration-a-${index}`, type: "step-progress", participantId: "a", assignmentId: assignment.id, durationSecondsDelta: 120, at: `2026-08-22T10:0${index}:10.000Z` },
    { id: `duration-b-${index}`, type: "step-progress", participantId: "b", assignmentId: assignment.id, durationSecondsDelta: 125, at: `2026-08-22T10:0${index}:11.000Z` },
    { id: `done-a-${index}`, type: "participant-step-completed", participantId: "a", assignmentId: assignment.id, at: `2026-08-22T10:0${index}:12.000Z` },
    { id: `done-b-${index}`, type: "participant-step-completed", participantId: "b", assignmentId: assignment.id, at: `2026-08-22T10:0${index}:13.000Z` },
  ]);

  const totals = deriveParticipantMovementTotals(session(assignments), events);
  assert.equal(totals.a.distanceMeters, 2000);
  assert.equal(totals.b.distanceMeters, 2000);
});

test("shared stations use explicit distance and never double credit the target", () => {
  const assignments = [{
    id: "ski",
    sequence: 0,
    blockId: "main",
    blockTitle: "Race",
    stepId: "ski",
    stepName: "500 m SkiErg",
    exerciseId: "ski-erg",
    mode: "shared-distance",
    participantIds: ["a", "b"],
    targetDistanceMeters: 500,
  }];
  const events = [
    { id: "a-250", type: "step-progress", participantId: "a", assignmentId: "ski", distanceMetersDelta: 250, at: "2026-08-22T10:01:00.000Z" },
    { id: "b-250", type: "step-progress", participantId: "b", assignmentId: "ski", distanceMetersDelta: 250, at: "2026-08-22T10:02:00.000Z" },
  ];
  const totals = deriveParticipantMovementTotals(session(assignments), events);
  assert.equal(totals.a.distanceMeters, 250);
  assert.equal(totals.b.distanceMeters, 250);
});

test("partial explicit progress on automatic work is topped up only to the prescription", () => {
  const assignments = [{
    id: "run",
    sequence: 0,
    blockId: "main",
    blockTitle: "Race",
    stepId: "run",
    stepName: "500 m běh",
    exerciseId: "run",
    mode: "simultaneous",
    participantIds: ["a", "b"],
    targetDistanceMeters: 500,
  }];
  const events = [
    { id: "a-progress", type: "step-progress", participantId: "a", assignmentId: "run", distanceMetersDelta: 100, at: "2026-08-22T10:01:00.000Z" },
    { id: "a-done", type: "participant-step-completed", participantId: "a", assignmentId: "run", at: "2026-08-22T10:02:00.000Z" },
  ];
  const totals = deriveParticipantMovementTotals(session(assignments), events);
  assert.equal(totals.a.distanceMeters, 500);
  assert.equal(totals.b.distanceMeters, 0);
});
