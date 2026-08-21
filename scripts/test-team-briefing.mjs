import assert from "node:assert/strict";
import test from "node:test";
import { currentAssignmentElapsedSeconds, deriveTeamWorkoutTiming } from "../lib/team-pacing.ts";
import { deriveTeamWorkoutState } from "../lib/team-workout-engine.ts";

const participants = [
  { id: "a", userId: "u-a", displayName: "A", role: "host", status: "joined" },
  { id: "b", userId: "u-b", displayName: "B", role: "athlete", status: "joined" },
];

const assignments = [
  { id: "warm", sequence: 0, blockId: "warm", blockTitle: "Závodní rozcvičení", stepId: "warm", stepName: "5 min lehce", stepDetail: "Warm-up", mode: "simultaneous", participantIds: ["a", "b"] },
  { id: "run", sequence: 1, blockId: "main", blockTitle: "Race", stepId: "run", stepName: "500 m běh", stepDetail: "Kontrolované tempo", exerciseId: "run", mode: "simultaneous", participantIds: ["a", "b"], targetDistanceMeters: 500 },
  { id: "cool", sequence: 2, blockId: "cool", blockTitle: "Zklidnění", stepId: "cool", stepName: "5 min volně", stepDetail: "Cooldown", mode: "simultaneous", participantIds: ["a", "b"] },
];

const events = [
  { id: "session", type: "session-started", participantId: "a", at: "2026-08-21T18:00:00.000Z" },
  { id: "warm-a", type: "participant-step-completed", participantId: "a", assignmentId: "warm", at: "2026-08-21T18:01:55.000Z" },
  { id: "warm-b", type: "participant-step-completed", participantId: "b", assignmentId: "warm", at: "2026-08-21T18:02:00.000Z" },
  { id: "ready-a", type: "workout-ready", participantId: "a", ready: true, at: "2026-08-21T18:02:20.000Z" },
  { id: "ready-b", type: "workout-ready", participantId: "b", ready: true, at: "2026-08-21T18:02:40.000Z" },
  { id: "workout", type: "workout-started", participantId: "a", at: "2026-08-21T18:03:00.000Z" },
  { id: "duration-a", type: "step-progress", participantId: "a", assignmentId: "run", durationSecondsDelta: 290, at: "2026-08-21T18:07:50.000Z" },
  { id: "run-a", type: "participant-step-completed", participantId: "a", assignmentId: "run", at: "2026-08-21T18:07:50.000Z" },
  { id: "duration-b", type: "step-progress", participantId: "b", assignmentId: "run", durationSecondsDelta: 300, at: "2026-08-21T18:08:00.000Z" },
  { id: "run-b", type: "participant-step-completed", participantId: "b", assignmentId: "run", at: "2026-08-21T18:08:00.000Z" },
];

test("briefing is part of the session but excluded from measured workout time", () => {
  const timing = deriveTeamWorkoutTiming(
    assignments,
    events,
    "2026-08-21T18:00:00.000Z",
    "2026-08-21T18:10:00.000Z",
    Date.parse("2026-08-21T18:10:00.000Z"),
  );
  assert.equal(timing.warmupSeconds, 120);
  assert.equal(timing.briefingSeconds, 60);
  assert.equal(timing.workoutSeconds, 300);
  assert.equal(timing.cooldownSeconds, 120);
  assert.equal(timing.sessionSeconds, 600);
});

test("first work segment starts from synchronized workout countdown, not warmup completion", () => {
  const elapsed = currentAssignmentElapsedSeconds(
    assignments,
    events,
    "2026-08-21T18:00:00.000Z",
    "run",
    Date.parse("2026-08-21T18:03:30.000Z"),
  );
  assert.equal(elapsed, 30);
});

test("explicit personal work duration keeps briefing wait out of tracked work", () => {
  const session = {
    version: 1,
    id: "ENG-BRIEF-TEST",
    joinCode: "ENG-BRIEF-TEST",
    workoutTemplateId: "briefing-test",
    workoutTemplate: {
      id: "briefing-test",
      title: "Briefing test",
      description: "Regression fixture",
      durationMinutes: 10,
      tags: ["test"],
      blocks: [],
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
    format: "doubles",
    hostUserId: "u-a",
    status: "running",
    participantLimit: 2,
    participants,
    assignments,
    createdAt: "2026-08-21T18:00:00.000Z",
    startedAt: "2026-08-21T18:00:00.000Z",
  };
  const state = deriveTeamWorkoutState(session, events);
  assert.equal(state.contributions.a.durationSeconds, 290);
  assert.equal(state.contributions.b.durationSeconds, 300);
});
