import { createDefaultHyroxData } from "./default-data";
import type {
  HyroxData, NewScheduledWorkout, NewWeeklyPlanTemplate, NewWorkoutResult,
  NewWorkoutTemplate, ScheduledWorkout, WeeklyPlanTemplate, WorkoutResult, WorkoutTemplate,
} from "./types";

export const HYROX_STORAGE_KEY = "hyrox-data-v1";
export const LEGACY_RESULTS_KEY = "hyrox-results";
export const HYROX_DATA_EVENT = "hyrox-data-change";

function makeId(prefix: string) {
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}
function getStorage(): Storage | null { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } }
function normalize(value: unknown): HyroxData {
  const fallback = createDefaultHyroxData();
  if (!value || typeof value !== "object") return fallback;
  const data = value as Partial<HyroxData>;
  return {
    version: 1,
    templates: Array.isArray(data.templates) ? data.templates.map((t) => ({ ...t, tags: Array.isArray(t.tags) ? t.tags : [] })) : fallback.templates,
    scheduledWorkouts: Array.isArray(data.scheduledWorkouts) ? data.scheduledWorkouts : [],
    results: Array.isArray(data.results) ? data.results : [],
    weeklyPlans: Array.isArray(data.weeklyPlans) ? data.weeklyPlans : [],
  };
}
export function loadHyroxData(): HyroxData {
  const storage = getStorage(); if (!storage) return createDefaultHyroxData();
  try { const raw = storage.getItem(HYROX_STORAGE_KEY); const data = raw ? normalize(JSON.parse(raw)) : createDefaultHyroxData(); saveHyroxData(data); return data; }
  catch { return createDefaultHyroxData(); }
}
export function saveHyroxData(data: HyroxData) {
  const storage = getStorage(); if (!storage) return false;
  try { storage.setItem(HYROX_STORAGE_KEY, JSON.stringify(data)); window.dispatchEvent(new CustomEvent(HYROX_DATA_EVENT)); return true; } catch { return false; }
}
function updateData(updater: (data: HyroxData) => HyroxData) { const next = updater(loadHyroxData()); saveHyroxData(next); return next; }

export function createTemplate(input: NewWorkoutTemplate): WorkoutTemplate {
  const now = new Date().toISOString(); const template = { ...input, tags: input.tags ?? [], id: makeId("template"), createdAt: now, updatedAt: now };
  updateData((d) => ({ ...d, templates: [...d.templates, template] })); return template;
}
export function updateTemplate(id: string, updates: Partial<NewWorkoutTemplate>) { let found: WorkoutTemplate | null = null; updateData((d) => ({ ...d, templates: d.templates.map((t) => t.id === id ? (found = { ...t, ...updates, id, updatedAt: new Date().toISOString() }) : t) })); return found; }
export function deleteTemplate(id: string) { updateData((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== id), scheduledWorkouts: d.scheduledWorkouts.filter((s) => s.templateId !== id), weeklyPlans: d.weeklyPlans.map((p) => ({ ...p, days: p.days.map((day) => day.templateId === id ? { ...day, templateId: null } : day) })) })); return true; }

export function scheduleWorkout(input: NewScheduledWorkout): ScheduledWorkout { const item = { ...input, id: makeId("scheduled") }; updateData((d) => ({ ...d, scheduledWorkouts: [...d.scheduledWorkouts, item] })); return item; }
export function scheduleMany(inputs: NewScheduledWorkout[]) { const items = inputs.map((input) => ({ ...input, id: makeId("scheduled") })); updateData((d) => ({ ...d, scheduledWorkouts: [...d.scheduledWorkouts, ...items] })); return items; }
export function replaceSchedulesForDates(inputs: NewScheduledWorkout[], dates: string[]) { const dateSet = new Set(dates); const items = inputs.map((input) => ({ ...input, id: makeId("scheduled") })); updateData((d) => ({ ...d, scheduledWorkouts: [...d.scheduledWorkouts.filter((s) => !dateSet.has(s.date)), ...items] })); return items; }
export function updateScheduledWorkout(id: string, updates: Partial<NewScheduledWorkout>) { let found: ScheduledWorkout | null = null; updateData((d) => ({ ...d, scheduledWorkouts: d.scheduledWorkouts.map((s) => s.id === id ? (found = { ...s, ...updates, id }) : s) })); return found; }
export function deleteScheduledWorkout(id: string) { updateData((d) => ({ ...d, scheduledWorkouts: d.scheduledWorkouts.filter((s) => s.id !== id) })); return true; }

export function createWeeklyPlan(input: NewWeeklyPlanTemplate): WeeklyPlanTemplate { const now = new Date().toISOString(); const plan = { ...input, id: makeId("plan"), createdAt: now, updatedAt: now }; updateData((d) => ({ ...d, weeklyPlans: [...d.weeklyPlans, plan] })); return plan; }
export function deleteWeeklyPlan(id: string) { updateData((d) => ({ ...d, weeklyPlans: d.weeklyPlans.filter((p) => p.id !== id) })); return true; }

export function addResult(input: NewWorkoutResult): WorkoutResult { const result = { ...input, id: makeId("result") }; updateData((d) => ({ ...d, results: [result, ...d.results] })); return result; }
export function updateResult(id: string, updates: Partial<NewWorkoutResult>) { let found: WorkoutResult | null = null; updateData((d) => ({ ...d, results: d.results.map((r) => r.id === id ? (found = { ...r, ...updates, id }) : r) })); return found; }
export function deleteResult(id: string) { updateData((d) => ({ ...d, results: d.results.filter((r) => r.id !== id) })); return true; }
export function resetHyroxData() { const data = createDefaultHyroxData(); saveHyroxData(data); return data; }
