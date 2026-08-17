import { createDefaultHyroxData } from "./default-data";
import { upgradeCatalogTemplates } from "./catalog-migration";
import type {
  HyroxData,
  NewScheduledWorkout,
  NewTrainingProgram,
  NewWeeklyPlanTemplate,
  NewWorkoutResult,
  NewWorkoutTemplate,
  ScheduledWorkout,
  TrainingProgram,
  WeeklyPlanTemplate,
  WorkoutResult,
  WorkoutTemplate,
} from "./types";
import type { ScheduledWorkoutUpdate } from "./calendar-planning";

export const HYROX_STORAGE_KEY = "hyrox-data-v1";
export const LEGACY_RESULTS_KEY = "hyrox-results";
export const HYROX_DATA_EVENT = "hyrox-data-change";

function makeId(prefix: string) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function normalizeTemplates(data: Partial<HyroxData>, fallback: HyroxData) {
  if (!Array.isArray(data.templates)) return fallback.templates;

  const stored = data.templates.map((template) => ({
    ...template,
    tags: Array.isArray(template.tags) ? template.tags : [],
  }));
  const storedCatalogVersion =
    typeof data.catalogVersion === "number" ? data.catalogVersion : 0;
  const currentCatalogVersion = fallback.catalogVersion ?? 0;
  return upgradeCatalogTemplates(stored, storedCatalogVersion, fallback.templates, currentCatalogVersion);
}

function normalize(value: unknown): HyroxData {
  const fallback = createDefaultHyroxData();
  if (!value || typeof value !== "object") return fallback;
  const data = value as Partial<HyroxData>;

  return {
    version: 1,
    catalogVersion: fallback.catalogVersion,
    templates: normalizeTemplates(data, fallback),
    scheduledWorkouts: Array.isArray(data.scheduledWorkouts)
      ? data.scheduledWorkouts
      : [],
    results: Array.isArray(data.results) ? data.results : [],
    weeklyPlans: Array.isArray(data.weeklyPlans) ? data.weeklyPlans : [],
    trainingPrograms: Array.isArray(data.trainingPrograms)
      ? data.trainingPrograms
      : [],
  };
}

export function loadHyroxData(): HyroxData {
  const storage = getStorage();
  if (!storage) return createDefaultHyroxData();
  try {
    const raw = storage.getItem(HYROX_STORAGE_KEY);
    if (!raw) return createDefaultHyroxData();
    return normalize(JSON.parse(raw));
  } catch {
    return createDefaultHyroxData();
  }
}

export function saveHyroxData(data: HyroxData) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(HYROX_STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(HYROX_DATA_EVENT));
    return true;
  } catch {
    return false;
  }
}

function updateData(updater: (data: HyroxData) => HyroxData) {
  const next = updater(loadHyroxData());
  saveHyroxData(next);
  return next;
}

export function createTemplate(input: NewWorkoutTemplate): WorkoutTemplate {
  const now = new Date().toISOString();
  const template: WorkoutTemplate = { ...input, tags: input.tags ?? [], id: makeId("template"), createdAt: now, updatedAt: now };
  updateData((data) => ({ ...data, templates: [...data.templates, template] }));
  return template;
}

export function updateTemplate(id: string, updates: Partial<NewWorkoutTemplate>) {
  let found: WorkoutTemplate | null = null;
  updateData((data) => ({
    ...data,
    templates: data.templates.map((template) =>
      template.id === id
        ? (found = { ...template, ...updates, id, updatedAt: new Date().toISOString() })
        : template,
    ),
  }));
  return found;
}

export function deleteTemplate(id: string) {
  updateData((data) => ({
    ...data,
    templates: data.templates.filter((template) => template.id !== id),
    scheduledWorkouts: data.scheduledWorkouts.filter((scheduled) => scheduled.templateId !== id),
    weeklyPlans: data.weeklyPlans.map((plan) => ({
      ...plan,
      days: plan.days.map((day) => (day.templateId === id ? { ...day, templateId: null } : day)),
    })),
    trainingPrograms: data.trainingPrograms.map((program) => ({
      ...program,
      weeks: program.weeks.map((week) => ({
        ...week,
        sessions: week.sessions.map((session) =>
          session.templateId === id ? { ...session, templateId: null } : session,
        ),
      })),
    })),
  }));
  return true;
}

export function scheduleWorkout(input: NewScheduledWorkout): ScheduledWorkout {
  const item = { ...input, id: makeId("scheduled") };
  updateData((data) => ({ ...data, scheduledWorkouts: [...data.scheduledWorkouts, item] }));
  return item;
}

export function scheduleMany(inputs: NewScheduledWorkout[]) {
  const items = inputs.map((input) => ({ ...input, id: makeId("scheduled") }));
  updateData((data) => ({ ...data, scheduledWorkouts: [...data.scheduledWorkouts, ...items] }));
  return items;
}

export function replaceSchedulesForDates(inputs: NewScheduledWorkout[], dates: string[]) {
  const dateSet = new Set(dates);
  const items = inputs.map((input) => ({ ...input, id: makeId("scheduled") }));
  updateData((data) => ({
    ...data,
    scheduledWorkouts: [
      ...data.scheduledWorkouts.filter((scheduled) => !dateSet.has(scheduled.date)),
      ...items,
    ],
  }));
  return items;
}

export function updateScheduledWorkout(id: string, updates: Partial<NewScheduledWorkout>) {
  let found: ScheduledWorkout | null = null;
  updateData((data) => ({
    ...data,
    scheduledWorkouts: data.scheduledWorkouts.map((scheduled) =>
      scheduled.id === id ? (found = { ...scheduled, ...updates, id }) : scheduled,
    ),
  }));
  return found;
}

export function updateScheduledWorkouts(updates: ScheduledWorkoutUpdate[]) {
  const updatesById = new Map(updates.map((item) => [item.id, item.updates]));
  let updatedCount = 0;
  updateData((data) => ({
    ...data,
    scheduledWorkouts: data.scheduledWorkouts.map((scheduled) => {
      const patch = updatesById.get(scheduled.id);
      if (!patch) return scheduled;
      updatedCount += 1;
      return { ...scheduled, ...patch, id: scheduled.id };
    }),
  }));
  return updatedCount;
}

export function deleteScheduledWorkout(id: string) {
  updateData((data) => ({
    ...data,
    scheduledWorkouts: data.scheduledWorkouts.filter((scheduled) => scheduled.id !== id),
  }));
  return true;
}

export function createWeeklyPlan(input: NewWeeklyPlanTemplate): WeeklyPlanTemplate {
  const now = new Date().toISOString();
  const plan = { ...input, id: makeId("plan"), createdAt: now, updatedAt: now };
  updateData((data) => ({ ...data, weeklyPlans: [...data.weeklyPlans, plan] }));
  return plan;
}

export function deleteWeeklyPlan(id: string) {
  updateData((data) => ({ ...data, weeklyPlans: data.weeklyPlans.filter((plan) => plan.id !== id) }));
  return true;
}

export function createTrainingProgram(input: NewTrainingProgram): TrainingProgram {
  const now = new Date().toISOString();
  const program: TrainingProgram = { ...input, id: makeId("program"), createdAt: now, updatedAt: now };
  updateData((data) => ({ ...data, trainingPrograms: [...data.trainingPrograms, program] }));
  return program;
}

export function updateTrainingProgram(id: string, updates: Partial<NewTrainingProgram>) {
  let found: TrainingProgram | null = null;
  updateData((data) => ({
    ...data,
    trainingPrograms: data.trainingPrograms.map((program) =>
      program.id === id
        ? (found = { ...program, ...updates, id, updatedAt: new Date().toISOString() })
        : program,
    ),
  }));
  return found;
}

export function deleteTrainingProgram(id: string) {
  updateData((data) => ({
    ...data,
    trainingPrograms: data.trainingPrograms.filter((program) => program.id !== id),
    scheduledWorkouts: data.scheduledWorkouts.filter((item) => item.programId !== id),
  }));
  return true;
}

export function addResult(input: NewWorkoutResult): WorkoutResult {
  const result = { ...input, id: makeId("result") };
  updateData((data) => ({ ...data, results: [result, ...data.results] }));
  return result;
}

export function updateResult(id: string, updates: Partial<NewWorkoutResult>) {
  let found: WorkoutResult | null = null;
  updateData((data) => ({
    ...data,
    results: data.results.map((result) =>
      result.id === id ? (found = { ...result, ...updates, id }) : result,
    ),
  }));
  return found;
}

export function deleteResult(id: string) {
  updateData((data) => ({ ...data, results: data.results.filter((result) => result.id !== id) }));
  return true;
}

export function resetHyroxData() {
  const data = createDefaultHyroxData();
  saveHyroxData(data);
  return data;
}
