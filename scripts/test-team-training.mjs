import assert from "node:assert/strict";
import test from "node:test";
import { createTeamJoinCode, isValidTeamJoinCode, normalizeTeamJoinCode } from "../lib/team-join-code.ts";
import { buildWorkoutBenchmarks } from "../lib/training-insights.ts";
import {
  buildTeamAssignments,
  buildTeamResult,
  canParticipantWork,
  canStartTeamSession,
  deriveTeamWorkoutState,
} from "../lib/team-workout-engine.ts";

const participants = [
  { id: "a", userId: "u-a", displayName: "A", role: "host", status: "joined" },
  { id: "b", userId: "u-b", displayName: "B", role: "athlete", status: "joined" },
];

const template = {
  id: "team-test",
  title: "Team HYROX",
  description: "Synthetic multiplayer test",
  durationMinutes: 30,
  tags: ["test"],
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
  blocks: [
    {
      id: "main",
      type: "manual",
      title: "Main",
      repeat: 1,
      steps: [
        { id: "ski", name: "2000 m SkiErg", detail: "", exerciseId: "ski-erg" },
        { id: "wall", name: "100 Wall Balls", detail: "", exerciseId: "wall-ball" },
        { id: "run", name: "Běh", detail: "1000 m", exerciseId: "run" },
      ],
    },
  ],
};

function session(format, assignments = buildTeamAssignments({ template, participants, format })) {
  return {
    version: 1,
    id: "ENG-7K2M-9Q4P",
    joinCode: "ENG-7K2M-9Q4P",
    workoutTemplateId: template.id,
    workoutTemplate: template,
    format,
    hostUserId: "u-a",
    status: "lobby",
    participantLimit: format === "relay" ? 4 : 2,
    participants,
    assignments,
    createdAt: "2026-08-20T18:00:00.000Z",
  };
}

test("join code uses readable high-entropy Enginn multiplayer format", () => {
  const code = createTeamJoinCode(() => 0.25);
  assert.equal(isValidTeamJoinCode(code), true);
  assert.match(code, /^ENG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeTeamJoinCode(code.replaceAll("-", "")), code);
});

test("doubles turns SkiErg and Wall Balls into shared targets", () => {
  const assignments = buildTeamAssignments({ template, participants, format: "doubles" });
  assert.equal(assignments[0].mode, "shared-distance");
  assert.equal(assignments[0].targetDistanceMeters, 2000);
  assert.equal(assignments[0].activeParticipantId, "a");
  assert.equal(assignments[1].mode, "shared-reps");
  assert.equal(assignments[1].targetReps, 100);
  assert.equal(assignments[1].activeParticipantId, "a");
});

test("shared workout keeps both athletes on the same steps", () => {
  const assignments = buildTeamAssignments({ template, participants, format: "shared" });
  assert.deepEqual(assignments[2].participantIds, ["a", "b"]);
  assert.equal(assignments[2].mode, "simultaneous");
});

test("relay rotates work between athletes", () => {
  const assignments = buildTeamAssignments({ template, participants, format: "relay" });
  assert.deepEqual(assignments.map((item) => item.participantIds[0]), ["a", "b", "a"]);
  assert.ok(assignments.every((item) => item.mode === "relay"));
});

test("lobby starts only when all joined athletes are ready", () => {
  const current = session("shared");
  const oneReady = deriveTeamWorkoutState(current, [{ id: "r1", type: "participant-ready", participantId: "a", ready: true, at: "2026-08-20T18:00:01.000Z" }]);
  assert.equal(canStartTeamSession(current, oneReady), false);
  const allReady = deriveTeamWorkoutState(current, [
    { id: "r1", type: "participant-ready", participantId: "a", ready: true, at: "2026-08-20T18:00:01.000Z" },
    { id: "r2", type: "participant-ready", participantId: "b", ready: true, at: "2026-08-20T18:00:02.000Z" },
  ]);
  assert.equal(canStartTeamSession(current, allReady), true);
});

test("single-station doubles handoff changes who can work", () => {
  const current = session("doubles");
  const started = deriveTeamWorkoutState(current, [{ id: "s", type: "session-started", participantId: "a", at: "2026-08-20T18:00:00.000Z" }]);
  assert.equal(canParticipantWork(current.assignments[0], "a", started), true);
  assert.equal(canParticipantWork(current.assignments[0], "b", started), false);
  const handed = deriveTeamWorkoutState(current, [
    { id: "s", type: "session-started", participantId: "a", at: "2026-08-20T18:00:00.000Z" },
    { id: "h", type: "handoff", participantId: "a", nextParticipantId: "b", assignmentId: current.assignments[0].id, at: "2026-08-20T18:01:00.000Z" },
  ]);
  assert.equal(canParticipantWork(current.assignments[0], "a", handed), false);
  assert.equal(canParticipantWork(current.assignments[0], "b", handed), true);
});

test("shared distance aggregates event deltas into team progress", () => {
  const current = session("doubles");
  const assignmentId = current.assignments[0].id;
  const state = deriveTeamWorkoutState(current, [
    { id: "p1", type: "step-progress", participantId: "a", assignmentId, distanceMetersDelta: 500, at: "2026-08-20T18:01:00.000Z" },
    { id: "h1", type: "handoff", participantId: "a", nextParticipantId: "b", assignmentId, at: "2026-08-20T18:02:00.000Z" },
    { id: "p2", type: "step-progress", participantId: "b", assignmentId, distanceMetersDelta: 1500, at: "2026-08-20T18:04:00.000Z" },
  ]);
  assert.equal(state.assignmentProgress[assignmentId].distanceMeters, 2000);
  assert.equal(state.assignmentProgress[assignmentId].teamCompleted, true);
  assert.equal(state.contributions.a.distanceMeters, 500);
  assert.equal(state.contributions.b.distanceMeters, 1500);
});

test("team result keeps aggregate time separate from personal contributions", () => {
  const current = session("shared");
  const events = [
    { id: "start", type: "session-started", participantId: "a", at: "2026-08-20T18:00:00.000Z" },
    { id: "done", type: "session-completed", participantId: "a", at: "2026-08-20T18:30:00.000Z" },
    { id: "finish-a", type: "participant-finished", participantId: "a", durationSeconds: 1800, rpe: 8, at: "2026-08-20T18:30:05.000Z" },
  ];
  const result = buildTeamResult(current, events);
  assert.equal(result.teamDurationSeconds, 1800);
  assert.equal(result.participants.find((item) => item.participantId === "a")?.finish?.rpe, 8);
});

test("solo and team results never share the same benchmark identity", () => {
  const base = {
    templateId: "benchmark-workout",
    workoutTitle: "Benchmark",
    workoutCode: "EGN-TEAM-TEST",
    templateVersion: 1,
    rpe: 8,
    weights: "",
    notes: "",
    splits: [],
    source: "runner",
  };
  const results = [
    { ...base, id: "solo-1", completedAt: "2026-08-01T10:00:00.000Z", durationSeconds: 1800 },
    { ...base, id: "solo-2", completedAt: "2026-08-08T10:00:00.000Z", durationSeconds: 1750 },
    { ...base, id: "team-1", completedAt: "2026-08-02T10:00:00.000Z", durationSeconds: 1500, source: "team", teamFormat: "doubles", teamSessionId: "s1" },
    { ...base, id: "team-2", completedAt: "2026-08-09T10:00:00.000Z", durationSeconds: 1450, source: "team", teamFormat: "doubles", teamSessionId: "s2" },
  ];
  const benchmarks = buildWorkoutBenchmarks(results, 10);
  assert.equal(benchmarks.length, 2);
  assert.ok(benchmarks.some((benchmark) => benchmark.key.includes(":team:doubles")));
  assert.ok(benchmarks.some((benchmark) => !benchmark.key.includes(":team:")));
});
