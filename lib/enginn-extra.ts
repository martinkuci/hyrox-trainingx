import {
  findCompensationExercises,
  findExerciseAlternatives,
  findFinisherExercises,
} from "./exercise-catalog";
import type {
  EnginnExtraDurationMinutes,
  EnginnExtraExercise,
  EnginnExtraFocus,
  EnginnExtraPlan,
  EquipmentId,
} from "./types";

export const ENGINN_EXTRA_FOCUS_LABELS: Record<EnginnExtraFocus, string> = {
  core: "Core",
  grip: "Grip",
  legs: "Nohy",
  cardio: "Cardio",
  mobility: "Mobilita",
  recovery: "Recovery",
};

export const ENGINN_EXTRA_DURATIONS: EnginnExtraDurationMinutes[] = [5, 8, 10];

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

function rotate<T>(items: T[], offset: number) {
  if (items.length === 0) return items;
  const index = offset % items.length;
  return [...items.slice(index), ...items.slice(0, index)];
}

function prescriptionFor(focus: EnginnExtraFocus, duration: EnginnExtraDurationMinutes, index: number) {
  if (focus === "mobility" || focus === "recovery") {
    return duration === 5
      ? "45 s plynule · 15 s přechod"
      : "60 s plynule · vystřídej strany podle potřeby";
  }
  if (focus === "cardio") return "40 s práce · 20 s přechod";
  if (focus === "grip") return index % 2 === 0 ? "30–40 s práce · kontrolovaný úchop" : "8–12 kvalitních opakování";
  return duration === 5 ? "30–40 s práce · 20 s přechod" : "8–15 kvalitních opakování";
}

function targetCount(duration: EnginnExtraDurationMinutes) {
  if (duration === 5) return 2;
  if (duration === 8) return 3;
  return 4;
}

function candidatesFor({
  equipment,
  focus,
}: {
  equipment: EquipmentId[];
  focus: EnginnExtraFocus;
}) {
  const source = focus === "mobility" || focus === "recovery"
    ? findCompensationExercises({ equipment, focusTag: focus, limit: 30 })
    : findFinisherExercises({ equipment, focus: focus === "legs" ? "legs" : focus, limit: 30 });

  const fallback = focus === "mobility" || focus === "recovery"
    ? findCompensationExercises({ equipment, limit: 30 })
    : findFinisherExercises({ equipment, limit: 30 });

  return source.length > 0 ? source : fallback;
}

export function buildEnginnExtra({
  equipment,
  focus,
  durationMinutes,
  seed = "enginn-extra",
}: {
  equipment: EquipmentId[];
  focus: EnginnExtraFocus;
  durationMinutes: EnginnExtraDurationMinutes;
  seed?: string;
}): EnginnExtraPlan {
  const candidates = candidatesFor({ equipment, focus });
  const selected = rotate(candidates, hashSeed(`${seed}-${focus}-${durationMinutes}`)).slice(0, targetCount(durationMinutes));

  return {
    focus,
    durationMinutes,
    exercises: selected.map((exercise, index) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      prescription: prescriptionFor(focus, durationMinutes, index),
    })),
  };
}

export function replaceEnginnExtraExercise({
  equipment,
  focus,
  durationMinutes,
  currentExerciseId,
  excludedExerciseIds = [],
  seed = "enginn-extra-replacement",
}: {
  equipment: EquipmentId[];
  focus: EnginnExtraFocus;
  durationMinutes: EnginnExtraDurationMinutes;
  currentExerciseId: string;
  excludedExerciseIds?: string[];
  seed?: string;
}): EnginnExtraExercise | undefined {
  const candidates = candidatesFor({ equipment, focus });
  const candidateIds = new Set(candidates.map((exercise) => exercise.id));
  const blocked = new Set([currentExerciseId, ...excludedExerciseIds]);
  const directAlternatives = findExerciseAlternatives(currentExerciseId, equipment)
    .filter((exercise) => candidateIds.has(exercise.id) && !blocked.has(exercise.id));
  const directIds = new Set(directAlternatives.map((exercise) => exercise.id));
  const remaining = rotate(
    candidates.filter((exercise) => !blocked.has(exercise.id) && !directIds.has(exercise.id)),
    hashSeed(`${seed}-${focus}-${durationMinutes}-${currentExerciseId}`),
  );
  const exercise = [...directAlternatives, ...remaining][0];
  if (!exercise) return undefined;

  return {
    exerciseId: exercise.id,
    name: exercise.name,
    prescription: prescriptionFor(focus, durationMinutes, hashSeed(`${seed}-${exercise.id}`) % 2),
  };
}
