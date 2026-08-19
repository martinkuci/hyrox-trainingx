import assert from "node:assert/strict";
import test from "node:test";
import {
  planRemainingProgramLocationChange,
  planTrainingLocationChange,
} from "../lib/training-location-change.ts";

function template(id, category, steps, durationMinutes = 45) {
  return {
    id,
    title: id,
    description: "",
    durationMinutes,
    tags: [],
    metadata: {
      workoutCode: id,
      templateVersion: 1,
      category,
      goal: "",
      targetRpeMin: 4,
      targetRpeMax: 6,
      expectedDurationMin: durationMinutes - 5,
      expectedDurationMax: durationMinutes + 5,
      runningTarget: "",
      primaryMetric: "",
      secondaryMetrics: [],
      progressionGroup: category,
      difficultyLevel: 1,
    },
    blocks: [{
      id: `${id}-block`,
      type: "manual",
      title: "Main",
      repeat: 1,
      steps: steps.map((name, index) => ({ id: `${id}-${index}`, name, detail: "" })),
    }],
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

const row = template("row", "base-engine", ["30 min veslo"]);
const ski = template("ski", "base-engine", ["30 min SkiErg"]);
const outdoor = template("outdoor", "base-engine", ["30 min běh"]);
const locations = [
  {
    id: "location-row-gym",
    name: "Row gym",
    equipment: ["rower"],
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  },
];

function schedule(overrides = {}) {
  return {
    id: "scheduled-1",
    templateId: "ski",
    date: "2026-08-20",
    time: "18:00",
    status: "planned",
    programWeek: 1,
    ...overrides,
  };
}

const program = {
  id: "program-1",
  code: "TEST",
  name: "Test program",
  description: "",
  weeks: [
    { weekNumber: 1, title: "Week 1", phase: "base", focus: "Base", sessions: [] },
    { weekNumber: 2, title: "Week 2", phase: "build", focus: "Build", sessions: [] },
  ],
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

test("unknown location keeps the planned workout and leaves location unset", () => {
  const plan = planTrainingLocationChange({
    schedule: schedule(),
    currentTemplate: ski,
    templates: [ski, row, outdoor],
  });
  assert.equal(plan.outcome, "kept-current");
  assert.equal(plan.updates.trainingLocation, undefined);
  assert.equal(plan.selectedTemplate.id, "ski");
});

test("newly selected gym automatically adapts to a compatible workout", () => {
  const plan = planTrainingLocationChange({
    schedule: schedule(),
    currentTemplate: ski,
    templates: [ski, row, outdoor],
    location: "location-row-gym",
    customLocations: locations,
    phase: "base",
  });
  assert.equal(plan.outcome, "adapted");
  assert.equal(plan.updates.trainingLocation, "location-row-gym");
  assert.equal(plan.updates.templateId, "row");
  assert.equal(plan.updates.originalTemplateId, "ski");
});

test("clearing location restores the original program workout after an adaptation", () => {
  const adaptedSchedule = schedule({
    templateId: "row",
    originalTemplateId: "ski",
    trainingLocation: "location-row-gym",
  });
  const plan = planTrainingLocationChange({
    schedule: adaptedSchedule,
    currentTemplate: row,
    templates: [ski, row, outdoor],
  });
  assert.equal(plan.outcome, "restored-original");
  assert.equal(plan.updates.templateId, "ski");
  assert.equal(plan.updates.trainingLocation, undefined);
  assert.equal(plan.updates.originalTemplateId, undefined);
});

test("one saved gym can be assigned to the rest of the active program", () => {
  const schedules = [
    schedule({ id: "past", programId: program.id, date: "2026-08-19", status: "planned" }),
    schedule({ id: "done", programId: program.id, date: "2026-08-20", status: "completed" }),
    schedule({ id: "future-ski", programId: program.id, date: "2026-08-20", templateId: "ski", programWeek: 1 }),
    schedule({ id: "future-row", programId: program.id, date: "2026-08-22", templateId: "row", programWeek: 1 }),
    schedule({ id: "other-program", programId: "program-2", date: "2026-08-23", templateId: "ski", programWeek: 1 }),
  ];

  const plan = planRemainingProgramLocationChange({
    program,
    schedules,
    templates: [ski, row, outdoor],
    location: "location-row-gym",
    customLocations: locations,
    fromDate: "2026-08-20",
  });

  assert.equal(plan.total, 2);
  assert.equal(plan.adapted, 1);
  assert.equal(plan.kept, 1);
  assert.equal(plan.unresolved, 0);
  assert.deepEqual(plan.updates.map((item) => item.id), ["future-ski", "future-row"]);
  assert.equal(plan.updates[0].updates.trainingLocation, "location-row-gym");
  assert.equal(plan.updates[0].updates.templateId, "row");
  assert.equal(plan.updates[1].updates.trainingLocation, "location-row-gym");
  assert.equal(plan.updates[1].updates.templateId, undefined);
});
