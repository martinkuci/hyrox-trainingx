import { createDefaultHyroxData } from "./default-data";
import type {
  HyroxData,
  NewScheduledWorkout,
  NewWorkoutResult,
  NewWorkoutTemplate,
  ScheduledWorkout,
  WorkoutResult,
  WorkoutTemplate,
} from "./types";

export const HYROX_STORAGE_KEY = "hyrox-data-v1";
export const LEGACY_RESULTS_KEY = "hyrox-results";
export const HYROX_DATA_EVENT = "hyrox-data-change";

type LegacyResult = {
  id?: unknown;
  workoutId?: unknown;
  workoutName?: unknown;
  completedAt?: unknown;
  durationSeconds?: unknown;
  rpe?: unknown;
  weights?: unknown;
  notes?: unknown;
};

function makeId(prefix: string): string {
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

function isHyroxData(value: unknown): value is HyroxData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<HyroxData>;

  return (
    data.version === 1 &&
    Array.isArray(data.templates) &&
    Array.isArray(data.scheduledWorkouts) &&
    Array.isArray(data.results)
  );
}

function migrateLegacyResults(storage: Storage, data: HyroxData): HyroxData {
  const legacyValue = storage.getItem(LEGACY_RESULTS_KEY);
  if (!legacyValue) return data;

  try {
    const parsed = JSON.parse(legacyValue) as unknown;
    if (!Array.isArray(parsed)) return data;

    const migrated = parsed.flatMap((entry): WorkoutResult[] => {
      if (!entry || typeof entry !== "object") return [];
      const legacy = entry as LegacyResult;
      const templateId =
        typeof legacy.workoutId === "string" ? legacy.workoutId : "hyrox-02";

      return [
        {
          id: typeof legacy.id === "string" ? legacy.id : makeId("result"),
          templateId,
          workoutTitle:
            typeof legacy.workoutName === "string" ? legacy.workoutName : "HYROX 02",
          completedAt:
            typeof legacy.completedAt === "string"
              ? legacy.completedAt
              : new Date().toISOString(),
          durationSeconds:
            typeof legacy.durationSeconds === "number" ? legacy.durationSeconds : 0,
          rpe: typeof legacy.rpe === "number" ? legacy.rpe : 0,
          weights: typeof legacy.weights === "string" ? legacy.weights : "",
          notes: typeof legacy.notes === "string" ? legacy.notes : "",
          splits: [],
        },
      ];
    });

    return { ...data, results: migrated };
  } catch {
    return data;
  }
}

export function loadHyroxData(): HyroxData {
  const storage = getStorage();
  if (!storage) return createDefaultHyroxData();

  try {
    const stored = storage.getItem(HYROX_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (isHyroxData(parsed)) return parsed;
    }

    const migrated = migrateLegacyResults(storage, createDefaultHyroxData());
    saveHyroxData(migrated);
    return migrated;
  } catch {
    return createDefaultHyroxData();
  }
}

export function saveHyroxData(data: HyroxData): boolean {
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

function updateData(updater: (data: HyroxData) => HyroxData): HyroxData {
  const next = updater(loadHyroxData());
  saveHyroxData(next);
  return next;
}

export function createTemplate(input: NewWorkoutTemplate): WorkoutTemplate {
  const now = new Date().toISOString();
  const template: WorkoutTemplate = {
    ...input,
    id: makeId("template"),
    createdAt: now,
    updatedAt: now,
  };

  updateData((data) => ({ ...data, templates: [...data.templates, template] }));
  return template;
}

export function updateTemplate(
  id: string,
  updates: Partial<NewWorkoutTemplate>,
): WorkoutTemplate | null {
  let updated: WorkoutTemplate | null = null;
  updateData((data) => ({
    ...data,
    templates: data.templates.map((template) => {
      if (template.id !== id) return template;
      updated = { ...template, ...updates, id, updatedAt: new Date().toISOString() };
      return updated;
    }),
  }));
  return updated;
}

export function deleteTemplate(id: string): boolean {
  let deleted = false;
  updateData((data) => {
    deleted = data.templates.some((template) => template.id === id);
    return {
      ...data,
      templates: data.templates.filter((template) => template.id !== id),
      scheduledWorkouts: data.scheduledWorkouts.filter(
        (scheduled) => scheduled.templateId !== id,
      ),
    };
  });
  return deleted;
}

export function scheduleWorkout(input: NewScheduledWorkout): ScheduledWorkout {
  const scheduled: ScheduledWorkout = { ...input, id: makeId("scheduled") };
  updateData((data) => ({
    ...data,
    scheduledWorkouts: [...data.scheduledWorkouts, scheduled],
  }));
  return scheduled;
}

export function updateScheduledWorkout(
  id: string,
  updates: Partial<NewScheduledWorkout>,
): ScheduledWorkout | null {
  let updated: ScheduledWorkout | null = null;
  updateData((data) => ({
    ...data,
    scheduledWorkouts: data.scheduledWorkouts.map((scheduled) => {
      if (scheduled.id !== id) return scheduled;
      updated = { ...scheduled, ...updates, id };
      return updated;
    }),
  }));
  return updated;
}

export function deleteScheduledWorkout(id: string): boolean {
  let deleted = false;
  updateData((data) => {
    deleted = data.scheduledWorkouts.some((scheduled) => scheduled.id === id);
    return {
      ...data,
      scheduledWorkouts: data.scheduledWorkouts.filter(
        (scheduled) => scheduled.id !== id,
      ),
    };
  });
  return deleted;
}

export function addResult(input: NewWorkoutResult): WorkoutResult {
  const result: WorkoutResult = { ...input, id: makeId("result") };
  updateData((data) => ({ ...data, results: [result, ...data.results] }));
  return result;
}

export function updateResult(
  id: string,
  updates: Partial<NewWorkoutResult>,
): WorkoutResult | null {
  let updated: WorkoutResult | null = null;
  updateData((data) => ({
    ...data,
    results: data.results.map((result) => {
      if (result.id !== id) return result;
      updated = { ...result, ...updates, id };
      return updated;
    }),
  }));
  return updated;
}

export function deleteResult(id: string): boolean {
  let deleted = false;
  updateData((data) => {
    deleted = data.results.some((result) => result.id === id);
    return { ...data, results: data.results.filter((result) => result.id !== id) };
  });
  return deleted;
}

export function resetHyroxData(): HyroxData {
  const data = createDefaultHyroxData();
  saveHyroxData(data);
  return data;
}

