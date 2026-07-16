import type { WorkoutCategory, WorkoutMetadata } from "./types";

export const WORKOUT_CATEGORIES: { value: WorkoutCategory; label: string }[] = [
  { value: "base-engine", label: "Base Engine" },
  { value: "base-builder", label: "Base Builder" },
  { value: "strength", label: "Strength" },
  { value: "threshold", label: "Threshold" },
  { value: "race-simulation", label: "Race Simulation" },
  { value: "long-engine", label: "Long Engine" },
  { value: "recovery", label: "Recovery" },
  { value: "mixed", label: "Mixed" },
];

export function categoryLabel(category?: WorkoutCategory) {
  return WORKOUT_CATEGORIES.find((item) => item.value === category)?.label ?? "Bez kategorie";
}

export function emptyMetadata(): WorkoutMetadata {
  return {
    workoutCode: "",
    templateVersion: 1,
    category: "mixed",
    goal: "",
    targetRpeMin: 6,
    targetRpeMax: 8,
    expectedDurationMin: 30,
    expectedDurationMax: 45,
    runningTarget: "",
    primaryMetric: "",
    secondaryMetrics: [],
    progressionGroup: "",
    difficultyLevel: 1,
  };
}

export function normalizeWorkoutCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function normalizeMetadata(value?: unknown): WorkoutMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  const metadata = value as Partial<WorkoutMetadata>;
  const base = emptyMetadata();
  const workoutCode = normalizeWorkoutCode(String(metadata.workoutCode ?? ""));
  const goal = String(metadata.goal ?? "").trim();
  const primaryMetric = String(metadata.primaryMetric ?? "").trim();
  const progressionGroup = String(metadata.progressionGroup ?? "").trim();
  const runningTarget = String(metadata.runningTarget ?? "").trim();
  const secondaryMetrics = Array.isArray(metadata.secondaryMetrics)
    ? Array.from(new Set(metadata.secondaryMetrics.map((item) => String(item).trim()).filter(Boolean)))
    : [];

  if (!workoutCode && !goal && !primaryMetric && !progressionGroup && !runningTarget && secondaryMetrics.length === 0) return undefined;

  const minRpe = Math.min(10, Math.max(1, Number(metadata.targetRpeMin) || base.targetRpeMin));
  const maxRpe = Math.min(10, Math.max(minRpe, Number(metadata.targetRpeMax) || base.targetRpeMax));
  const minDuration = Math.max(1, Number(metadata.expectedDurationMin) || base.expectedDurationMin);
  const maxDuration = Math.max(minDuration, Number(metadata.expectedDurationMax) || base.expectedDurationMax);
  const difficulty = Math.min(3, Math.max(1, Number(metadata.difficultyLevel) || 1)) as 1 | 2 | 3;
  const category = WORKOUT_CATEGORIES.some((item) => item.value === metadata.category) ? metadata.category as WorkoutCategory : base.category;

  return {
    workoutCode,
    templateVersion: Math.max(1, Math.round(Number(metadata.templateVersion) || 1)),
    category,
    goal,
    targetRpeMin: minRpe,
    targetRpeMax: maxRpe,
    expectedDurationMin: minDuration,
    expectedDurationMax: maxDuration,
    runningTarget,
    primaryMetric,
    secondaryMetrics,
    progressionGroup,
    difficultyLevel: difficulty,
  };
}
