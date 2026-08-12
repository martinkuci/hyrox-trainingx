import type { BlockFeedback, BlockFeedbackRating, StepSplit } from "./types";

export const ACTIVE_WORKOUT_STORAGE_KEY = "hyrox-active-workout-v1";
export const ACTIVE_WORKOUT_CHANGE_EVENT = "hyrox-active-workout-change";
export const WORKOUT_CHECKPOINT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type CheckpointRunnerMode = "block-preview" | "block-feedback" | "countdown" | "running";

export type WorkoutCheckpoint = {
  version: 1;
  workoutKey: string;
  templateId: string;
  templateTitle: string;
  templateUpdatedAt: string;
  scheduledWorkoutId?: string;
  mode: CheckpointRunnerMode;
  currentIndex: number;
  totalElapsedMilliseconds: number;
  stepElapsedMilliseconds: number;
  splits: StepSplit[];
  blockFeedbacks: BlockFeedback[];
  feedbackBlockId?: string;
  feedbackFinishesWorkout: boolean;
  countdown: number;
  paused: boolean;
  countdownPaused: boolean;
  savedAt: number;
};

export type RestoredCheckpointRuntime = WorkoutCheckpoint & {
  restoredAt: number;
};

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function announceWorkoutCheckpointChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACTIVE_WORKOUT_CHANGE_EVENT));
  }
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeSplit(value: unknown): StepSplit | null {
  if (!value || typeof value !== "object") return null;
  const split = value as Partial<StepSplit>;
  if (
    typeof split.blockId !== "string" ||
    typeof split.stepId !== "string" ||
    !Number.isInteger(split.round) ||
    (split.round ?? 0) < 1 ||
    !isFiniteNonNegative(split.durationSeconds)
  ) return null;

  return {
    blockId: split.blockId,
    stepId: split.stepId,
    round: split.round as number,
    durationSeconds: split.durationSeconds,
  };
}

function normalizeBlockFeedback(value: unknown): BlockFeedback | null {
  if (!value || typeof value !== "object") return null;
  const feedback = value as Partial<BlockFeedback>;
  if (
    typeof feedback.blockId !== "string" ||
    !Number.isInteger(feedback.rating) ||
    (feedback.rating ?? 0) < 1 ||
    (feedback.rating ?? 6) > 5
  ) return null;
  return { blockId: feedback.blockId, rating: feedback.rating as BlockFeedbackRating };
}

export function makeWorkoutKey(templateId: string, scheduledWorkoutId?: string) {
  return `${templateId}:${scheduledWorkoutId ?? "free"}`;
}

export function normalizeWorkoutCheckpoint(value: unknown, now = Date.now()): WorkoutCheckpoint | null {
  if (!value || typeof value !== "object") return null;
  const checkpoint = value as Partial<WorkoutCheckpoint>;
  const validMode = checkpoint.mode === "block-preview" || checkpoint.mode === "block-feedback" || checkpoint.mode === "countdown" || checkpoint.mode === "running";
  const validWorkoutKey = typeof checkpoint.templateId === "string"
    && (checkpoint.scheduledWorkoutId === undefined || typeof checkpoint.scheduledWorkoutId === "string")
    && checkpoint.workoutKey === makeWorkoutKey(checkpoint.templateId, checkpoint.scheduledWorkoutId);
  const validSavedAt = isFiniteNonNegative(checkpoint.savedAt)
    && checkpoint.savedAt <= now + 5 * 60 * 1000
    && now - checkpoint.savedAt <= WORKOUT_CHECKPOINT_MAX_AGE_MS;
  const validSplits = Array.isArray(checkpoint.splits)
    && checkpoint.splits.length <= 10_000
    ? checkpoint.splits.map(normalizeSplit)
    : null;
  const blockFeedbacks = checkpoint.blockFeedbacks === undefined
    ? []
    : Array.isArray(checkpoint.blockFeedbacks) && checkpoint.blockFeedbacks.length <= 100
      ? checkpoint.blockFeedbacks.map(normalizeBlockFeedback).filter((item): item is BlockFeedback => item !== null)
      : null;
  const feedbackBlockId = checkpoint.feedbackBlockId === undefined ? undefined : checkpoint.feedbackBlockId;
  const feedbackFinishesWorkout = checkpoint.feedbackFinishesWorkout ?? false;

  if (
    checkpoint.version !== 1 ||
    !validWorkoutKey ||
    typeof checkpoint.templateId !== "string" ||
    typeof checkpoint.templateTitle !== "string" ||
    typeof checkpoint.templateUpdatedAt !== "string" ||
    (checkpoint.scheduledWorkoutId !== undefined && typeof checkpoint.scheduledWorkoutId !== "string") ||
    !validMode ||
    !Number.isInteger(checkpoint.currentIndex) ||
    (checkpoint.currentIndex ?? -1) < 0 ||
    !isFiniteNonNegative(checkpoint.totalElapsedMilliseconds) ||
    (checkpoint.totalElapsedMilliseconds ?? Infinity) > WORKOUT_CHECKPOINT_MAX_AGE_MS ||
    !isFiniteNonNegative(checkpoint.stepElapsedMilliseconds) ||
    (checkpoint.stepElapsedMilliseconds ?? Infinity) > WORKOUT_CHECKPOINT_MAX_AGE_MS ||
    !Number.isInteger(checkpoint.countdown) ||
    (checkpoint.countdown ?? -1) < 0 ||
    (checkpoint.countdown ?? 11) > 10 ||
    typeof checkpoint.paused !== "boolean" ||
    typeof checkpoint.countdownPaused !== "boolean" ||
    typeof feedbackFinishesWorkout !== "boolean" ||
    (checkpoint.mode === "block-feedback" && typeof feedbackBlockId !== "string") ||
    (feedbackBlockId !== undefined && typeof feedbackBlockId !== "string") ||
    !validSavedAt ||
    !validSplits ||
    validSplits.some((split) => split === null) ||
    !blockFeedbacks
  ) return null;

  return {
    version: 1,
    workoutKey: checkpoint.workoutKey as string,
    templateId: checkpoint.templateId,
    templateTitle: checkpoint.templateTitle,
    templateUpdatedAt: checkpoint.templateUpdatedAt,
    scheduledWorkoutId: checkpoint.scheduledWorkoutId,
    mode: checkpoint.mode as CheckpointRunnerMode,
    currentIndex: checkpoint.currentIndex as number,
    totalElapsedMilliseconds: checkpoint.totalElapsedMilliseconds,
    stepElapsedMilliseconds: checkpoint.stepElapsedMilliseconds,
    splits: validSplits as StepSplit[],
    blockFeedbacks,
    feedbackBlockId,
    feedbackFinishesWorkout,
    countdown: checkpoint.countdown as number,
    paused: checkpoint.paused,
    countdownPaused: checkpoint.countdownPaused,
    savedAt: checkpoint.savedAt as number,
  };
}

export function restoreCheckpointRuntime(checkpoint: WorkoutCheckpoint, now = Date.now()): RestoredCheckpointRuntime {
  const timeAway = Math.max(0, now - checkpoint.savedAt);
  if (checkpoint.mode === "running" && !checkpoint.paused) {
    return {
      ...checkpoint,
      totalElapsedMilliseconds: checkpoint.totalElapsedMilliseconds + timeAway,
      stepElapsedMilliseconds: checkpoint.stepElapsedMilliseconds + timeAway,
      savedAt: now,
      restoredAt: now,
    };
  }

  if (checkpoint.mode === "countdown" && !checkpoint.countdownPaused) {
    const countdownMilliseconds = checkpoint.countdown * 1000;
    if (timeAway >= countdownMilliseconds) {
      const runningTime = timeAway - countdownMilliseconds;
      return {
        ...checkpoint,
        mode: "running",
        countdown: 0,
        paused: false,
        totalElapsedMilliseconds: checkpoint.totalElapsedMilliseconds + runningTime,
        stepElapsedMilliseconds: runningTime,
        savedAt: now,
        restoredAt: now,
      };
    }

    return {
      ...checkpoint,
      countdown: Math.max(1, Math.ceil((countdownMilliseconds - timeAway) / 1000)),
      savedAt: now,
      restoredAt: now,
    };
  }

  return { ...checkpoint, savedAt: now, restoredAt: now };
}

export function loadWorkoutCheckpoint(now = Date.now()): WorkoutCheckpoint | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(ACTIVE_WORKOUT_STORAGE_KEY);
    if (!raw) return null;
    const checkpoint = normalizeWorkoutCheckpoint(JSON.parse(raw), now);
    if (!checkpoint) storage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
    return checkpoint;
  } catch {
    try { storage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY); } catch { /* Storage is unavailable. */ }
    return null;
  }
}

export function saveWorkoutCheckpoint(checkpoint: WorkoutCheckpoint) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(ACTIVE_WORKOUT_STORAGE_KEY, JSON.stringify(checkpoint));
    announceWorkoutCheckpointChange();
    return true;
  } catch {
    return false;
  }
}

export function clearWorkoutCheckpoint(expectedWorkoutKey?: string) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    if (expectedWorkoutKey) {
      const checkpoint = loadWorkoutCheckpoint();
      if (checkpoint && checkpoint.workoutKey !== expectedWorkoutKey) return false;
    }
    storage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
    announceWorkoutCheckpointChange();
    return true;
  } catch {
    return false;
  }
}
