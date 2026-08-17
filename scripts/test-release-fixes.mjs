import assert from "node:assert/strict";
import test from "node:test";
import { listProgramCalendarChoices } from "../lib/calendar-planning.ts";
import {
  countdownCueSecond,
  flattenWorkoutTemplate,
  timedRestDurationSeconds,
} from "../lib/workout-runner-steps.ts";
import { TRAINING_CATALOG } from "../lib/training-catalog.ts";

function templateWith(block) {
  return {
    id: "template-1",
    title: "HYX002 Engine Builder",
    description: "",
    durationMinutes: 30,
    tags: [],
    blocks: [block],
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
  };
}

test("časovaný odpočinek se po pracovním kole odpočítává automaticky", () => {
  const steps = flattenWorkoutTemplate(templateWith({
    id: "finisher",
    type: "manual",
    title: "Finisher",
    repeat: 3,
    steps: [
      { id: "work", name: "SkiErg", detail: "250 m" },
      { id: "rest", name: "60 s odpočinek", detail: "Připrav se na další kolo." },
    ],
  }));

  assert.deepEqual(steps.map((step) => [step.stepId, step.round, step.durationSeconds, step.kind]), [
    ["work", 1, undefined, "work"],
    ["rest", 1, 60, "rest"],
    ["work", 2, undefined, "work"],
    ["rest", 2, 60, "rest"],
    ["work", 3, undefined, "work"],
  ]);
});

test("délku odpočinku načte ze sekund i minut", () => {
  assert.equal(timedRestDurationSeconds({ id: "1", name: "Odpočinek", detail: "90 sekund" }), 90);
  assert.equal(timedRestDurationSeconds({ id: "2", name: "2 min pauza", detail: "" }), 120);
  assert.equal(timedRestDurationSeconds({ id: "3", name: "2 min svižná chůze", detail: "" }), undefined);
});

test("časuje také aktivní zotavení v intervalových blocích", () => {
  assert.equal(timedRestDurationSeconds({ id: "1", name: "90 s lehký klus", detail: "Srovnej dech." }), 90);
  assert.equal(timedRestDurationSeconds({ id: "2", name: "2 min lehký klus", detail: "Aktivní zotavení." }), 120);
  assert.equal(timedRestDurationSeconds({ id: "3", name: "90 s easy", detail: "Recovery." }), 90);
});

test("všechny časované pauzy a zotavení v katalogu používají strukturovaný režim", () => {
  const expected = new Map([
    ["catalog-base-engine-01", 120],
    ["catalog-strength-01", 90],
    ["catalog-strength-02", 120],
    ["catalog-strength-03", 180],
    ["catalog-threshold-01", 90],
    ["catalog-threshold-02", 120],
    ["catalog-threshold-03", 90],
  ]);

  for (const [templateId, durationSeconds] of expected) {
    const template = TRAINING_CATALOG.find((item) => item.id === templateId);
    assert.ok(template, `Chybí šablona ${templateId}`);
    const mainBlock = template.blocks.find((block) => block.id.endsWith("-main"));
    assert.ok(mainBlock?.type === "for-time" || mainBlock?.type === "interval", `Chybí strukturovaný hlavní blok ${templateId}`);
    const rests = flattenWorkoutTemplate(template).filter(
      (step) => step.blockId === mainBlock.id && step.kind === "rest",
    );
    assert.equal(rests.length, mainBlock.rounds - 1, templateId);
    assert.ok(rests.every((step) => step.durationSeconds === durationSeconds), templateId);
  }
});

test("zvukový signál se aktivuje jen v posledních třech sekundách", () => {
  assert.equal(countdownCueSecond(60, 56_000), undefined);
  assert.equal(countdownCueSecond(60, 56_500), 3);
  assert.equal(countdownCueSecond(60, 57_200), 2);
  assert.equal(countdownCueSecond(60, 58_100), 1);
  assert.equal(countdownCueSecond(60, 60_000), undefined);
});

test("běžný manuální blok se nezmění", () => {
  const steps = flattenWorkoutTemplate(templateWith({
    id: "continuous",
    type: "manual",
    title: "Plynulá kola",
    repeat: 2,
    steps: [{ id: "run", name: "Běh", detail: "400 m" }],
  }));

  assert.equal(steps.length, 2);
  assert.ok(steps.every((step) => step.durationSeconds === undefined && step.kind === "work"));
});

test("kalendář nabídne program odvozený z naplánovaných jednotek", () => {
  const schedules = [{
    id: "schedule-1",
    templateId: "template-1",
    date: "2026-08-20",
    time: "18:00",
    status: "planned",
    programId: "missing-program",
  }];

  assert.deepEqual(listProgramCalendarChoices([], schedules), [{
    id: "missing-program",
    name: "Program v kalendáři",
    stored: false,
  }]);
});

test("kalendář neduplikuje existující program", () => {
  const programs = [{
    id: "program-1",
    code: "P1",
    name: "Můj program",
    description: "",
    weeks: [],
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
  }];
  const schedules = [{
    id: "schedule-1",
    templateId: "template-1",
    date: "2026-08-20",
    time: "18:00",
    status: "planned",
    programId: "program-1",
  }];

  assert.deepEqual(listProgramCalendarChoices(programs, schedules), [{
    id: "program-1",
    name: "Můj program",
    stored: true,
  }]);
});
