import test from "node:test";
import assert from "node:assert/strict";
import {
  applyWorkoutPacingToTemplate,
  buildWorkoutPacingPlan,
  classifyWorkoutPhase,
  deriveWorkoutTiming,
  pacingDeltaLabel,
  recommendedWorkoutTargetSeconds,
} from "../lib/workout-pacing.ts";

const template = {
  id: "pacing-test",
  title: "Race Simulation Test",
  description: "Test pacing flow.",
  durationMinutes: 30,
  tags: ["race"],
  metadata: {
    workoutCode: "TEST-PACE",
    templateVersion: 1,
    category: "race-simulation",
    goal: "Pacing",
    targetRpeMin: 7,
    targetRpeMax: 8,
    expectedDurationMin: 28,
    expectedDurationMax: 32,
    runningTarget: "Kontrolovaný začátek, poslední běh stejně rychlý jako první.",
    primaryMetric: "time",
    secondaryMetrics: [],
    progressionGroup: "test",
    difficultyLevel: 2,
  },
  blocks: [
    {
      id: "warm",
      type: "manual",
      title: "Závodní rozcvičení",
      repeat: 1,
      steps: [{ id: "warm-1", name: "10 min lehce", detail: "Běh a mobilita." }],
    },
    {
      id: "main",
      type: "manual",
      title: "Hlavní workout",
      repeat: 1,
      steps: [
        { id: "run", name: "1000 m běh", detail: "Rovnoměrně." },
        { id: "ski", name: "500 m SkiErg", detail: "Plynulý dlouhý záběr." },
        { id: "bbj", name: "30 m burpee broad jump", detail: "Bez zbytečného sprintu." },
      ],
    },
    {
      id: "cool",
      type: "manual",
      title: "Zklidnění",
      repeat: 1,
      steps: [{ id: "cool-1", name: "8 min volně", detail: "Chůze a mobilita." }],
    },
  ],
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
};

test("classifies warmup, work and cooldown independently", () => {
  assert.equal(classifyWorkoutPhase("Závodní rozcvičení", "10 min lehce"), "warmup");
  assert.equal(classifyWorkoutPhase("Hlavní workout", "500 m SkiErg"), "work");
  assert.equal(classifyWorkoutPhase("Zklidnění", "8 min volně"), "cooldown");
});

test("excludes warmup and cooldown from recommended benchmark target", () => {
  const target = recommendedWorkoutTargetSeconds(template);
  assert.ok(target >= 5 * 60);
  assert.ok(target < 30 * 60);
});

test("builds useful solo pacing cues including erg pace", () => {
  const plan = buildWorkoutPacingPlan(template);
  assert.ok(plan.steps["main:run"].targetSeconds > 0);
  assert.match(plan.steps["main:run"].cue, /Cíl úseku/);
  assert.match(plan.steps["main:ski"].paceLabel, /500 m/);
  assert.match(plan.steps["warm:warm-1"].cue, /nepočítá/);
  assert.match(plan.steps["cool:cool-1"].cue, /ne do výsledného workout času/);
});

test("injects pacing into the runner view without mutating the source template", () => {
  const paced = applyWorkoutPacingToTemplate(template);
  assert.notEqual(paced, template);
  assert.doesNotMatch(template.blocks[1].steps[1].detail, /Pacing/);
  assert.match(paced.description, /Orientační cíl pracovní části/);
  assert.match(paced.blocks[1].steps[1].detail, /Pacing/);
});

test("separates benchmark time from full solo session time", () => {
  const splits = [
    { blockId: "warm", stepId: "warm-1", round: 1, durationSeconds: 600, blockTitle: "Závodní rozcvičení", stepName: "10 min lehce", stepDetail: "Běh a mobilita." },
    { blockId: "main", stepId: "run", round: 1, durationSeconds: 300, blockTitle: "Hlavní workout", stepName: "1000 m běh", stepDetail: "Rovnoměrně." },
    { blockId: "main", stepId: "ski", round: 1, durationSeconds: 120, blockTitle: "Hlavní workout", stepName: "500 m SkiErg", stepDetail: "Plynulý dlouhý záběr." },
    { blockId: "main", stepId: "bbj", round: 1, durationSeconds: 180, blockTitle: "Hlavní workout", stepName: "30 m burpee broad jump", stepDetail: "Bez zbytečného sprintu." },
    { blockId: "cool", stepId: "cool-1", round: 1, durationSeconds: 480, blockTitle: "Zklidnění", stepName: "8 min volně", stepDetail: "Chůze a mobilita." },
  ];
  const timing = deriveWorkoutTiming(splits, 1680);
  assert.equal(timing.warmupSeconds, 600);
  assert.equal(timing.workoutSeconds, 600);
  assert.equal(timing.cooldownSeconds, 480);
  assert.equal(timing.sessionSeconds, 1680);
});

test("pacing delta uses a tolerance window", () => {
  assert.equal(pacingDeltaLabel(605, 600), "V cílovém pacing okně");
  assert.match(pacingDeltaLabel(700, 600), /pomaleji/);
  assert.match(pacingDeltaLabel(500, 600), /rychleji/);
});
