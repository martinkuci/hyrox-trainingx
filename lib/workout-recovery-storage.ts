import type { RecoveryRoutineResult } from "./types";
import { makeWorkoutKey } from "./workout-checkpoint";

const PRE_RECOVERY_PREFIX = "enginn-pre-recovery-v1:";

function storage() {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

function key(templateId: string, scheduledWorkoutId?: string) {
  return `${PRE_RECOVERY_PREFIX}${makeWorkoutKey(templateId, scheduledWorkoutId)}`;
}

function isRecoveryResult(value: unknown): value is RecoveryRoutineResult {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecoveryRoutineResult>;
  return typeof item.intent === "string"
    && typeof item.area === "string"
    && typeof item.durationMinutes === "number"
    && Array.isArray(item.exercises)
    && typeof item.completedAt === "string"
    && typeof item.durationSeconds === "number";
}

export function savePreWorkoutRecovery(templateId: string, scheduledWorkoutId: string | undefined, result: RecoveryRoutineResult) {
  const target = storage();
  if (!target) return false;
  try {
    target.setItem(key(templateId, scheduledWorkoutId), JSON.stringify(result));
    return true;
  } catch { return false; }
}

export function loadPreWorkoutRecovery(templateId: string, scheduledWorkoutId?: string) {
  const target = storage();
  if (!target) return undefined;
  try {
    const raw = target.getItem(key(templateId, scheduledWorkoutId));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecoveryResult(parsed)) {
      target.removeItem(key(templateId, scheduledWorkoutId));
      return undefined;
    }
    return parsed;
  } catch { return undefined; }
}

export function clearPreWorkoutRecovery(templateId: string, scheduledWorkoutId?: string) {
  const target = storage();
  if (!target) return false;
  try {
    target.removeItem(key(templateId, scheduledWorkoutId));
    return true;
  } catch { return false; }
}
