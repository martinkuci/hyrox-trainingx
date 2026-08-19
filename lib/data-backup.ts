import type { HyroxData } from "./types";

export const HYROX_BACKUP_FORMAT = "hyrox-training-backup";
export const HYROX_BACKUP_VERSION = 1;
export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;

export type HyroxBackup = {
  format: typeof HYROX_BACKUP_FORMAT;
  backupVersion: typeof HYROX_BACKUP_VERSION;
  exportedAt: string;
  data: HyroxData;
};

export type BackupSummary = {
  templates: number;
  scheduledWorkouts: number;
  results: number;
  weeklyPlans: number;
  trainingPrograms: number;
};

export type ParsedHyroxBackup = {
  backup: HyroxBackup;
  summary: BackupSummary;
  legacy: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalId(value: unknown) {
  return value === null || value === undefined || hasText(value);
}

function validStep(value: unknown) {
  return (
    isRecord(value) &&
    hasText(value.id) &&
    hasText(value.name) &&
    typeof value.detail === "string"
  );
}

function validBlock(value: unknown) {
  if (
    !isRecord(value) ||
    !hasText(value.id) ||
    !hasText(value.title) ||
    !Array.isArray(value.steps) ||
    !value.steps.every(validStep)
  ) {
    return false;
  }
  if (value.type === "manual") {
    return isFiniteNumber(value.repeat) && Number.isInteger(value.repeat) && value.repeat >= 1;
  }
  if (value.type === "for-time") {
    return isFiniteNumber(value.rounds) && Number.isInteger(value.rounds) && value.rounds >= 1 &&
      isFiniteNumber(value.restSeconds) && Number.isInteger(value.restSeconds) && value.restSeconds >= 0 &&
      (value.restName === undefined || typeof value.restName === "string") &&
      (value.restDetail === undefined || typeof value.restDetail === "string");
  }
  if (value.type === "interval" || value.type === "tabata") {
    return isFiniteNumber(value.rounds) && Number.isInteger(value.rounds) && value.rounds >= 1 &&
      isFiniteNumber(value.workSeconds) && Number.isInteger(value.workSeconds) && value.workSeconds >= 1 &&
      isFiniteNumber(value.restSeconds) && Number.isInteger(value.restSeconds) && value.restSeconds >= 0 &&
      (value.restName === undefined || typeof value.restName === "string") &&
      (value.restDetail === undefined || typeof value.restDetail === "string");
  }
  if (value.type === "emom" || value.type === "amrap") {
    return isFiniteNumber(value.minutes) && Number.isInteger(value.minutes) && value.minutes >= 1;
  }
  return false;
}

function validSplit(value: unknown) {
  return (
    isRecord(value) &&
    hasText(value.blockId) &&
    hasText(value.stepId) &&
    isFiniteNumber(value.round) &&
    value.round >= 1 &&
    isFiniteNumber(value.durationSeconds) &&
    value.durationSeconds >= 0
  );
}

function validAdaptationDecision(value: unknown) {
  return (
    isRecord(value) &&
    ["accepted", "dismissed"].includes(String(value.status)) &&
    ["reduce", "increase"].includes(String(value.direction)) &&
    hasText(value.scheduleId) &&
    hasText(value.originalTemplateId) &&
    hasText(value.recommendedTemplateId) &&
    hasText(value.decidedAt) &&
    !Number.isNaN(Date.parse(value.decidedAt))
  );
}

function validPlanDay(value: unknown) {
  return (
    isRecord(value) &&
    isFiniteNumber(value.weekday) &&
    Number.isInteger(value.weekday) &&
    value.weekday >= 0 &&
    value.weekday <= 6 &&
    isOptionalId(value.templateId) &&
    hasText(value.time)
  );
}

function validProgramSession(value: unknown) {
  return (
    isRecord(value) &&
    hasText(value.id) &&
    isFiniteNumber(value.weekday) &&
    Number.isInteger(value.weekday) &&
    value.weekday >= 0 &&
    value.weekday <= 6 &&
    hasText(value.time) &&
    isOptionalId(value.templateId) &&
    typeof value.note === "string"
  );
}

function validProgramWeek(value: unknown) {
  return (
    isRecord(value) &&
    isFiniteNumber(value.weekNumber) &&
    value.weekNumber >= 1 &&
    hasText(value.title) &&
    hasText(value.phase) &&
    typeof value.focus === "string" &&
    Array.isArray(value.sessions) &&
    value.sessions.every(validProgramSession)
  );
}

function validateCollections(value: unknown): asserts value is HyroxData {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error("Soubor neobsahuje podporovaná data aplikace Enginn verze 1.");
  }

  const collectionNames = [
    "templates",
    "scheduledWorkouts",
    "results",
    "weeklyPlans",
    "trainingPrograms",
  ] as const;

  for (const name of collectionNames) {
    if (!Array.isArray(value[name])) {
      throw new Error(`V záloze chybí kolekce „${name}“.`);
    }
    if (!value[name].every(isRecord)) {
      throw new Error(`Kolekce „${name}“ obsahuje neplatnou položku.`);
    }
  }

  const templates = value.templates as Record<string, unknown>[];
  const scheduledWorkouts = value.scheduledWorkouts as Record<string, unknown>[];
  const results = value.results as Record<string, unknown>[];
  const weeklyPlans = value.weeklyPlans as Record<string, unknown>[];
  const trainingPrograms = value.trainingPrograms as Record<string, unknown>[];

  const templatesValid = templates.every(
    (item) =>
      hasText(item.id) &&
      hasText(item.title) &&
      Array.isArray(item.blocks) &&
      item.blocks.every(validBlock),
  );
  const schedulesValid = scheduledWorkouts.every(
    (item) =>
      hasText(item.id) &&
      hasText(item.templateId) &&
      hasText(item.date) &&
      hasText(item.time) &&
      ["planned", "completed", "skipped"].includes(String(item.status)),
  );
  const resultsValid = results.every(
    (item) =>
      hasText(item.id) &&
      hasText(item.templateId) &&
      hasText(item.workoutTitle) &&
      hasText(item.completedAt) &&
      isFiniteNumber(item.durationSeconds) &&
      item.durationSeconds >= 0 &&
      isFiniteNumber(item.rpe) &&
      item.rpe >= 0 &&
      item.rpe <= 10 &&
      Array.isArray(item.splits) &&
      item.splits.every(validSplit) &&
      (item.adaptationDecision === undefined || validAdaptationDecision(item.adaptationDecision)),
  );
  const weeklyPlansValid = weeklyPlans.every(
    (item) =>
      hasText(item.id) &&
      hasText(item.name) &&
      Array.isArray(item.days) &&
      item.days.every(validPlanDay),
  );
  const programsValid = trainingPrograms.every(
    (item) =>
      hasText(item.id) &&
      hasText(item.code) &&
      hasText(item.name) &&
      Array.isArray(item.weeks) &&
      item.weeks.every(validProgramWeek),
  );

  if (!templatesValid || !schedulesValid || !resultsValid || !weeklyPlansValid || !programsValid) {
    throw new Error("Záloha obsahuje neplatná nebo neúplná tréninková data.");
  }
}

function normalizeBackupData(data: HyroxData): HyroxData {
  return {
    version: 1,
    catalogVersion:
      typeof data.catalogVersion === "number" ? data.catalogVersion : undefined,
    templates: data.templates.map((template) => ({
      ...template,
      tags: Array.isArray(template.tags) ? template.tags : [],
    })),
    scheduledWorkouts: data.scheduledWorkouts,
    results: data.results,
    weeklyPlans: data.weeklyPlans,
    trainingPrograms: data.trainingPrograms,
  };
}

export function summarizeBackup(data: HyroxData): BackupSummary {
  return {
    templates: data.templates.length,
    scheduledWorkouts: data.scheduledWorkouts.length,
    results: data.results.length,
    weeklyPlans: data.weeklyPlans.length,
    trainingPrograms: data.trainingPrograms.length,
  };
}

export function createHyroxBackup(
  data: HyroxData,
  exportedAt = new Date().toISOString(),
): HyroxBackup {
  return {
    format: HYROX_BACKUP_FORMAT,
    backupVersion: HYROX_BACKUP_VERSION,
    exportedAt,
    data,
  };
}

export function serializeHyroxBackup(data: HyroxData, exportedAt?: string) {
  return JSON.stringify(createHyroxBackup(data, exportedAt), null, 2);
}

export function parseHyroxBackupText(text: string): ParsedHyroxBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Soubor není platný JSON.");
  }

  let rawData: unknown;
  let exportedAt: string;
  let legacy = false;

  if (isRecord(parsed) && parsed.format === HYROX_BACKUP_FORMAT) {
    if (parsed.backupVersion !== HYROX_BACKUP_VERSION) {
      throw new Error("Tato verze zálohy zatím není podporovaná.");
    }
    if (!hasText(parsed.exportedAt) || Number.isNaN(Date.parse(parsed.exportedAt))) {
      throw new Error("V záloze chybí platné datum vytvoření.");
    }
    exportedAt = parsed.exportedAt;
    rawData = parsed.data;
  } else {
    legacy = true;
    exportedAt = new Date(0).toISOString();
    rawData = parsed;
  }

  validateCollections(rawData);
  const data = normalizeBackupData(rawData);
  const backup = createHyroxBackup(data, exportedAt);

  return {
    backup,
    summary: summarizeBackup(data),
    legacy,
  };
}

export function assertBackupFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0 || size > MAX_BACKUP_FILE_BYTES) {
    throw new Error("Soubor je příliš velký. Maximální velikost zálohy je 5 MB.");
  }
}

export function backupFileName(now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return `enginn-zaloha-${date}.json`;
}
