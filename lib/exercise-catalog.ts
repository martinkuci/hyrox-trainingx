import {
  EXERCISE_CATEGORY_LABELS,
  EXERCISE_LIBRARY as CORE_EXERCISE_LIBRARY,
  type ExerciseCategory,
  type ExerciseDefinition,
} from "./exercise-library";
import { EXTENDED_EXERCISE_LIBRARY } from "./exercise-library-extended";
import { ACCESSORY_EXERCISE_LIBRARY } from "./exercise-library-accessories";
import type { EquipmentId, WorkoutStep } from "./types";

export { EXERCISE_CATEGORY_LABELS };
export type { ExerciseCategory, ExerciseDefinition };

export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  ...CORE_EXERCISE_LIBRARY,
  ...EXTENDED_EXERCISE_LIBRARY,
  ...ACCESSORY_EXERCISE_LIBRARY,
];

const exerciseById = new Map(EXERCISE_LIBRARY.map((exercise) => [exercise.id, exercise]));

function normalizeExerciseText(value: string) {
  return value
    .toLocaleLowerCase("cs")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const exercisePhrases = EXERCISE_LIBRARY
  .flatMap((exercise) => [exercise.name, ...exercise.aliases].map((phrase) => ({
    exercise,
    phrase: normalizeExerciseText(phrase),
  })))
  .filter((item, index, all) => (
    item.phrase.length >= 3
    && all.findIndex((candidate) => candidate.exercise.id === item.exercise.id && candidate.phrase === item.phrase) === index
  ))
  .sort((left, right) => right.phrase.length - left.phrase.length);

export function getExercise(exerciseId: string | undefined) {
  if (!exerciseId) return undefined;
  return exerciseById.get(exerciseId);
}

export function inferExerciseFromText(value: string) {
  const text = normalizeExerciseText(value);
  if (!text) return undefined;
  const padded = ` ${text} `;
  return exercisePhrases.find(({ phrase }) => padded.includes(` ${phrase} `))?.exercise;
}

export function getExerciseForStep(step: Pick<WorkoutStep, "exerciseId" | "name" | "detail">) {
  return getExercise(step.exerciseId) ?? inferExerciseFromText(`${step.name} ${step.detail}`);
}

export function exerciseFitsEquipment(exercise: ExerciseDefinition, equipment: EquipmentId[]) {
  const available = new Set<EquipmentId>(["none", ...equipment]);
  return exercise.equipment.every((requirement) => requirement.anyOf.some((item) => available.has(item)));
}

export function findExerciseAlternatives(exerciseId: string, equipment: EquipmentId[]) {
  const source = getExercise(exerciseId);
  if (!source) return [];
  const preferred = new Set(source.alternatives);
  return EXERCISE_LIBRARY
    .filter((candidate) => candidate.id !== source.id && exerciseFitsEquipment(candidate, equipment))
    .map((candidate) => ({
      exercise: candidate,
      score:
        (preferred.has(candidate.id) ? 0 : 20) +
        (candidate.movementFamily === source.movementFamily ? 0 : 12) +
        (candidate.category === source.category ? 0 : 4) +
        (candidate.tags.some((tag) => source.tags.includes(tag)) ? 0 : 3),
    }))
    .sort((a, b) => a.score - b.score || a.exercise.name.localeCompare(b.exercise.name, "cs"))
    .map((item) => item.exercise);
}

export function findFinisherExercises({
  equipment,
  focus,
  limit = 12,
}: {
  equipment: EquipmentId[];
  focus?: "core" | "legs" | "upper-body" | "grip" | "cardio";
  limit?: number;
}) {
  return EXERCISE_LIBRARY
    .filter((exercise) => exercise.tags.includes("finisher"))
    .filter((exercise) => !focus || exercise.tags.includes(focus) || exercise.primaryMuscles.some((muscle) => muscle.includes(focus)))
    .filter((exercise) => exerciseFitsEquipment(exercise, equipment))
    .sort((a, b) => {
      const aAccessory = a.tags.includes("accessory") ? 0 : 1;
      const bAccessory = b.tags.includes("accessory") ? 0 : 1;
      return aAccessory - bAccessory || a.name.localeCompare(b.name, "cs");
    })
    .slice(0, limit);
}

export function findCompensationExercises({
  equipment,
  focusTag,
  limit = 12,
}: {
  equipment: EquipmentId[];
  focusTag?: string;
  limit?: number;
}) {
  return EXERCISE_LIBRARY
    .filter((exercise) => exercise.category === "compensation" || exercise.category === "mobility" || exercise.category === "recovery")
    .filter((exercise) => !focusTag || exercise.tags.includes(focusTag) || exercise.primaryMuscles.some((muscle) => muscle.includes(focusTag)))
    .filter((exercise) => exerciseFitsEquipment(exercise, equipment))
    .sort((a, b) => a.name.localeCompare(b.name, "cs"))
    .slice(0, limit);
}

export function exerciseCatalogStats() {
  return {
    total: EXERCISE_LIBRARY.length,
    bodyweight: EXERCISE_LIBRARY.filter((exercise) => exercise.tags.includes("bodyweight")).length,
    core: EXERCISE_LIBRARY.filter((exercise) => exercise.tags.includes("core")).length,
    finisher: EXERCISE_LIBRARY.filter((exercise) => exercise.tags.includes("finisher")).length,
    machine: EXERCISE_LIBRARY.filter((exercise) => exercise.tags.includes("machine")).length,
    crossfit: EXERCISE_LIBRARY.filter((exercise) => exercise.tags.includes("crossfit")).length,
  };
}
