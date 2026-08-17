import assert from "node:assert/strict";
import test from "node:test";
import { flattenWorkoutTemplate } from "../lib/workout-runner-steps.ts";

function templateWith(block) {
  return {
    id: "template-1",
    title: "Režimy",
    description: "",
    durationMinutes: 30,
    tags: [],
    blocks: [block],
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
  };
}

const exercises = [
  { id: "ski", name: "SkiErg", detail: "250 m" },
  { id: "burpees", name: "Burpee broad jumps", detail: "8 opakování" },
];

test("For Time přidá strukturovaný odpočinek jen mezi koly", () => {
  const steps = flattenWorkoutTemplate(templateWith({
    id: "for-time",
    type: "for-time",
    title: "For Time",
    rounds: 3,
    restSeconds: 60,
    steps: exercises,
  }));

  assert.deepEqual(steps.map((step) => [step.stepId, step.round, step.durationSeconds, step.kind, step.mode]), [
    ["ski", 1, undefined, "work", "for-time"],
    ["burpees", 1, undefined, "work", "for-time"],
    ["for-time-rest", 1, 60, "rest", "for-time"],
    ["ski", 2, undefined, "work", "for-time"],
    ["burpees", 2, undefined, "work", "for-time"],
    ["for-time-rest", 2, 60, "rest", "for-time"],
    ["ski", 3, undefined, "work", "for-time"],
    ["burpees", 3, undefined, "work", "for-time"],
  ]);
});

test("interval automaticky střídá práci a odpočinek", () => {
  const steps = flattenWorkoutTemplate(templateWith({
    id: "interval",
    type: "interval",
    title: "Intervaly",
    rounds: 3,
    workSeconds: 45,
    restSeconds: 15,
    steps: exercises,
  }));

  assert.deepEqual(steps.map((step) => [step.stepId, step.durationSeconds, step.kind]), [
    ["ski", 45, "work"],
    ["interval-rest", 15, "rest"],
    ["burpees", 45, "work"],
    ["interval-rest", 15, "rest"],
    ["ski", 45, "work"],
  ]);
});

test("TABATA používá vlastní nastavené časy a nevloží poslední pauzu", () => {
  const steps = flattenWorkoutTemplate(templateWith({
    id: "tabata",
    type: "tabata",
    title: "TABATA",
    rounds: 2,
    workSeconds: 20,
    restSeconds: 10,
    steps: exercises,
  }));

  assert.deepEqual(steps.map((step) => [step.mode, step.durationSeconds, step.kind]), [
    ["tabata", 20, "work"],
    ["tabata", 10, "rest"],
    ["tabata", 20, "work"],
  ]);
});

test("AMRAP vytvoří jediný odpočet celého bloku s cíli cviků", () => {
  const [step] = flattenWorkoutTemplate(templateWith({
    id: "amrap",
    type: "amrap",
    title: "AMRAP 12",
    minutes: 12,
    steps: exercises,
  }));

  assert.equal(step.mode, "amrap");
  assert.equal(step.durationSeconds, 720);
  assert.match(step.detail, /SkiErg \(250 m\)/);
  assert.match(step.detail, /Burpee broad jumps \(8 opakování\)/);
});

test("EMOM zůstává minutový a střídá cviky", () => {
  const steps = flattenWorkoutTemplate(templateWith({
    id: "emom",
    type: "emom",
    title: "EMOM",
    minutes: 3,
    steps: exercises,
  }));

  assert.deepEqual(steps.map((step) => [step.stepId, step.durationSeconds, step.emomMinute, step.mode]), [
    ["ski", 60, 1, "emom"],
    ["burpees", 60, 2, "emom"],
    ["ski", 60, 3, "emom"],
  ]);
});
