import type { WorkoutCategory, WorkoutMetadata, WorkoutResult, WorkoutTemplate } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TrainingOverview = {
  sessionCount: number;
  durationSeconds: number;
  averageRpe: number | null;
  targetRpeMatches: number;
  targetRpeCount: number;
};

export type WeeklyActivity = {
  startDate: string;
  endDate: string;
  sessionCount: number;
  durationSeconds: number;
  current: boolean;
};

export type TrainingPeriodComparison = {
  weekCount: number;
  currentStartDate: string;
  currentEndDate: string;
  previousStartDate: string;
  previousEndDate: string;
  current: TrainingOverview;
  previous: TrainingOverview;
};

export type CategoryInsight = TrainingOverview & {
  category: WorkoutCategory | "other";
};

export type ComparableWorkout = {
  key: string;
  title: string;
  latestCompletedAt: string;
  latestDurationSeconds: number;
  previousDurationSeconds: number;
  durationChangePercent: number;
  latestRpe: number | null;
  previousRpe: number | null;
  attempts: Array<{
    id: string;
    completedAt: string;
    durationSeconds: number;
    rpe: number | null;
  }>;
};

export type WorkoutBenchmark = {
  key: string;
  title: string;
  workoutCode: string | null;
  templateVersion: number | null;
  attemptCount: number;
  latestResultId: string;
  latestCompletedAt: string;
  latestDurationSeconds: number;
  bestResultIds: string[];
  bestCompletedAt: string;
  bestDurationSeconds: number;
  referenceDurationSeconds: number;
  latestDifferencePercent: number;
  latestStatus: "new-best" | "matched-best" | "above-best";
};

function validDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function validDuration(result: WorkoutResult) {
  return Number.isFinite(result.durationSeconds) && result.durationSeconds > 0;
}

function validRpe(value: number) {
  return Number.isFinite(value) && value >= 1 && value <= 10 ? value : null;
}

function resultMetadata(
  result: WorkoutResult,
  templatesById: ReadonlyMap<string, WorkoutTemplate>,
): WorkoutMetadata | undefined {
  return result.metadataSnapshot ?? templatesById.get(result.templateId)?.metadata;
}

function toUtcDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function startOfUtcWeek(timestamp: number) {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysFromMonday,
  );
}

function summarizeResults(
  results: readonly WorkoutResult[],
  templatesById: ReadonlyMap<string, WorkoutTemplate>,
): TrainingOverview {
  const rpes = results.map((result) => validRpe(result.rpe)).filter((value): value is number => value !== null);
  let targetRpeMatches = 0;
  let targetRpeCount = 0;

  for (const result of results) {
    const rpe = validRpe(result.rpe);
    const metadata = resultMetadata(result, templatesById);
    if (rpe === null || !metadata) continue;
    targetRpeCount += 1;
    if (rpe >= metadata.targetRpeMin && rpe <= metadata.targetRpeMax) targetRpeMatches += 1;
  }

  return {
    sessionCount: results.length,
    durationSeconds: results.reduce(
      (sum, result) => sum + (validDuration(result) ? result.durationSeconds : 0),
      0,
    ),
    averageRpe: rpes.length > 0
      ? Math.round((rpes.reduce((sum, value) => sum + value, 0) / rpes.length) * 10) / 10
      : null,
    targetRpeMatches,
    targetRpeCount,
  };
}

function resultsInWindow(
  results: readonly WorkoutResult[],
  start: number,
  end: number,
  includeEnd: boolean,
) {
  return results.filter((result) => {
    const timestamp = validDate(result.completedAt);
    return timestamp !== null && timestamp >= start && (includeEnd ? timestamp <= end : timestamp < end);
  });
}

export function buildTrainingOverview(
  results: readonly WorkoutResult[],
  templates: readonly WorkoutTemplate[],
  now = new Date(),
): TrainingOverview {
  const end = now.getTime();
  const start = end - 28 * DAY_MS;
  const templatesById = new Map(templates.map((template) => [template.id, template]));
  return summarizeResults(resultsInWindow(results, start, end, true), templatesById);
}

export function buildTrainingPeriodComparison(
  results: readonly WorkoutResult[],
  templates: readonly WorkoutTemplate[],
  now = new Date(),
  weekCount = 4,
): TrainingPeriodComparison {
  const safeWeekCount = Math.max(1, Math.floor(weekCount));
  const end = now.getTime();
  const periodDuration = safeWeekCount * 7 * DAY_MS;
  const currentStart = end - periodDuration;
  const previousStart = currentStart - periodDuration;
  const templatesById = new Map(templates.map((template) => [template.id, template]));

  return {
    weekCount: safeWeekCount,
    currentStartDate: toUtcDate(currentStart),
    currentEndDate: toUtcDate(end),
    previousStartDate: toUtcDate(previousStart),
    previousEndDate: toUtcDate(currentStart),
    current: summarizeResults(resultsInWindow(results, currentStart, end, true), templatesById),
    previous: summarizeResults(resultsInWindow(results, previousStart, currentStart, false), templatesById),
  };
}

export function buildCategoryInsights(
  results: readonly WorkoutResult[],
  templates: readonly WorkoutTemplate[],
  now = new Date(),
  weekCount = 4,
): CategoryInsight[] {
  const safeWeekCount = Math.max(1, Math.floor(weekCount));
  const end = now.getTime();
  const start = end - safeWeekCount * 7 * DAY_MS;
  const templatesById = new Map(templates.map((template) => [template.id, template]));
  const groups = new Map<WorkoutCategory | "other", WorkoutResult[]>();

  for (const result of resultsInWindow(results, start, end, true)) {
    const category = resultMetadata(result, templatesById)?.category ?? "other";
    const group = groups.get(category) ?? [];
    group.push(result);
    groups.set(category, group);
  }

  return [...groups.entries()]
    .map(([category, group]) => ({ category, ...summarizeResults(group, templatesById) }))
    .sort((left, right) => right.durationSeconds - left.durationSeconds || right.sessionCount - left.sessionCount);
}

export function buildWeeklyActivity(
  results: readonly WorkoutResult[],
  now = new Date(),
  weekCount = 5,
): WeeklyActivity[] {
  const safeWeekCount = Math.max(1, Math.floor(weekCount));
  const currentWeekStart = startOfUtcWeek(now.getTime());
  const firstWeekStart = currentWeekStart - (safeWeekCount - 1) * 7 * DAY_MS;
  const weeks = Array.from({ length: safeWeekCount }, (_, index) => {
    const start = firstWeekStart + index * 7 * DAY_MS;
    return {
      startDate: toUtcDate(start),
      endDate: toUtcDate(start + 6 * DAY_MS),
      sessionCount: 0,
      durationSeconds: 0,
      current: start === currentWeekStart,
    };
  });

  for (const result of results) {
    const timestamp = validDate(result.completedAt);
    if (timestamp === null || timestamp < firstWeekStart || timestamp >= currentWeekStart + 7 * DAY_MS) {
      continue;
    }
    const index = Math.floor((startOfUtcWeek(timestamp) - firstWeekStart) / (7 * DAY_MS));
    const week = weeks[index];
    if (!week) continue;
    week.sessionCount += 1;
    if (validDuration(result)) week.durationSeconds += result.durationSeconds;
  }

  return weeks;
}

function exerciseVariationKey(result: WorkoutResult) {
  const overrides = result.exerciseOverridesSnapshot;
  if (!overrides?.length) return "base";
  return [...overrides]
    .sort((left, right) => `${left.blockId}:${left.stepId}`.localeCompare(`${right.blockId}:${right.stepId}`))
    .map((override) => `${override.blockId}:${override.stepId}:${override.exerciseId}`)
    .join("|");
}

function teamVariationSuffix(result: WorkoutResult) {
  return result.teamFormat ? `:team:${result.teamFormat}` : "";
}

function comparisonKey(result: WorkoutResult) {
  const workoutCode = result.workoutCode ?? result.metadataSnapshot?.workoutCode;
  const base = workoutCode ? `code:${workoutCode}` : result.templateId ? `template:${result.templateId}` : null;
  if (!base) return null;
  const variation = exerciseVariationKey(result);
  const variantSuffix = variation === "base" ? "" : `:variant:${variation}`;
  return `${base}${teamVariationSuffix(result)}${variantSuffix}`;
}

function benchmarkIdentity(result: WorkoutResult) {
  const workoutCode = result.workoutCode ?? result.metadataSnapshot?.workoutCode;
  const templateVersion = result.templateVersion ?? result.metadataSnapshot?.templateVersion;
  const variation = exerciseVariationKey(result);
  const variantSuffix = variation === "base" ? "" : `:variant:${variation}`;
  const teamSuffix = teamVariationSuffix(result);
  if (workoutCode && Number.isInteger(templateVersion) && Number(templateVersion) > 0) {
    return {
      key: `code:${workoutCode}:v${templateVersion}${teamSuffix}${variantSuffix}`,
      workoutCode,
      templateVersion: Number(templateVersion),
    };
  }
  if (!result.templateId) return null;
  return { key: `template:${result.templateId}${teamSuffix}${variantSuffix}`, workoutCode: null, templateVersion: null };
}

export function buildComparableWorkouts(
  results: readonly WorkoutResult[],
  limit = 3,
): ComparableWorkout[] {
  const groups = new Map<string, WorkoutResult[]>();

  for (const result of results) {
    const key = comparisonKey(result);
    if (!key || validDate(result.completedAt) === null || !validDuration(result)) continue;
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .flatMap(([key, group]) => {
      const sorted = [...group].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      if (sorted.length < 2) return [];
      const latest = sorted[0];
      const previous = sorted[1];
      const durationChangePercent =
        Math.round(
          ((latest.durationSeconds - previous.durationSeconds) /
            previous.durationSeconds) *
            1000,
        ) / 10;
      return [{
        key,
        title: latest.workoutTitle,
        latestCompletedAt: latest.completedAt,
        latestDurationSeconds: latest.durationSeconds,
        previousDurationSeconds: previous.durationSeconds,
        durationChangePercent,
        latestRpe: validRpe(latest.rpe),
        previousRpe: validRpe(previous.rpe),
        attempts: sorted.slice(0, 6).reverse().map((result) => ({
          id: result.id,
          completedAt: result.completedAt,
          durationSeconds: result.durationSeconds,
          rpe: validRpe(result.rpe),
        })),
      }];
    })
    .sort((a, b) => b.latestCompletedAt.localeCompare(a.latestCompletedAt))
    .slice(0, Math.max(0, Math.floor(limit)));
}

export function buildWorkoutBenchmarks(
  results: readonly WorkoutResult[],
  limit = 4,
): WorkoutBenchmark[] {
  const groups = new Map<string, { identity: NonNullable<ReturnType<typeof benchmarkIdentity>>; results: WorkoutResult[] }>();

  for (const result of results) {
    const identity = benchmarkIdentity(result);
    if (!identity || validDate(result.completedAt) === null || !validDuration(result)) continue;
    const group = groups.get(identity.key) ?? { identity, results: [] };
    group.results.push(result);
    groups.set(identity.key, group);
  }

  return [...groups.values()]
    .flatMap(({ identity, results: group }) => {
      const sorted = [...group].sort((left, right) => right.completedAt.localeCompare(left.completedAt));
      if (sorted.length < 2) return [];
      const latest = sorted[0];
      const previousBest = Math.min(...sorted.slice(1).map((result) => result.durationSeconds));
      const bestDurationSeconds = Math.min(latest.durationSeconds, previousBest);
      const bestResults = sorted
        .filter((result) => result.durationSeconds === bestDurationSeconds)
        .sort((left, right) => left.completedAt.localeCompare(right.completedAt));
      const latestStatus: WorkoutBenchmark["latestStatus"] = latest.durationSeconds < previousBest
        ? "new-best"
        : latest.durationSeconds === previousBest
          ? "matched-best"
          : "above-best";
      const referenceDurationSeconds = latestStatus === "new-best" ? previousBest : bestDurationSeconds;
      const latestDifferencePercent = Math.round(
        ((latest.durationSeconds - referenceDurationSeconds) / referenceDurationSeconds) * 1000,
      ) / 10;

      return [{
        key: identity.key,
        title: latest.workoutTitle,
        workoutCode: identity.workoutCode,
        templateVersion: identity.templateVersion,
        attemptCount: sorted.length,
        latestResultId: latest.id,
        latestCompletedAt: latest.completedAt,
        latestDurationSeconds: latest.durationSeconds,
        bestResultIds: bestResults.map((result) => result.id),
        bestCompletedAt: bestResults[0].completedAt,
        bestDurationSeconds,
        referenceDurationSeconds,
        latestDifferencePercent,
        latestStatus,
      }];
    })
    .sort((left, right) => right.latestCompletedAt.localeCompare(left.latestCompletedAt))
    .slice(0, Math.max(0, Math.floor(limit)));
}
