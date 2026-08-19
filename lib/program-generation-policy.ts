import type { ProgramPhase, WorkoutCategory, WorkoutTemplate } from "./types";
import {
  inferTemplateDisciplineIds,
  type DisciplineId,
  type TrainingFocus,
} from "./training-domain";

export type ProgramGoal = "race" | "fitness" | "run" | "strength";
export type ProgramLevel = 1 | 2 | 3;

export type SessionBlueprint = {
  category: WorkoutCategory;
  focus: TrainingFocus;
  preferredDisciplines: DisciplineId[];
};

const blueprint = (
  category: WorkoutCategory,
  focus: TrainingFocus,
  preferredDisciplines: DisciplineId[] = [],
): SessionBlueprint => ({ category, focus, preferredDisciplines });

const policies: Record<ProgramGoal, Record<ProgramPhase, SessionBlueprint[]>> = {
  race: {
    base: [
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("base-builder", "hybrid", ["run", "ski-erg", "row"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
      blueprint("recovery", "recovery", ["mobility", "recovery"]),
    ],
    build: [
      blueprint("threshold", "threshold", ["run"]),
      blueprint("strength", "strength", ["strength", "sled-push", "sled-pull"]),
      blueprint("base-engine", "aerobic-base", ["run", "row"]),
      blueprint("mixed", "hybrid", ["run", "wall-ball", "burpee-broad-jump"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
    ],
    deload: [
      blueprint("recovery", "recovery", ["mobility", "recovery"]),
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("mixed", "hybrid", ["run", "ski-erg", "row"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
    ],
    specific: [
      blueprint("race-simulation", "race-specific", ["run", "ski-erg", "sled-push", "sled-pull", "burpee-broad-jump", "row", "farmers-carry", "sandbag-lunge", "wall-ball"]),
      blueprint("threshold", "threshold", ["run"]),
      blueprint("strength", "strength", ["sled-push", "sled-pull", "strength"]),
      blueprint("mixed", "race-specific", ["run", "wall-ball", "sandbag-lunge"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
    ],
    taper: [
      blueprint("recovery", "recovery", ["mobility", "recovery"]),
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("race-simulation", "race-specific", ["run", "wall-ball"]),
      blueprint("threshold", "threshold", ["run"]),
      blueprint("mixed", "hybrid", ["run", "ski-erg", "row"]),
    ],
  },
  fitness: {
    base: [
      blueprint("base-engine", "aerobic-base", ["run", "row"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("base-builder", "hybrid", ["run", "ski-erg", "row"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
      blueprint("recovery", "recovery", ["mobility", "recovery"]),
    ],
    build: [
      blueprint("mixed", "hybrid", ["run", "row", "wall-ball"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("threshold", "threshold", ["run"]),
      blueprint("base-engine", "aerobic-base", ["run", "ski-erg"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
    ],
    deload: [
      blueprint("recovery", "recovery", ["mobility", "recovery"]),
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("mixed", "hybrid", ["run", "row"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
    ],
    specific: [
      blueprint("mixed", "hybrid", ["run", "ski-erg", "row", "wall-ball"]),
      blueprint("threshold", "threshold", ["run"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
      blueprint("race-simulation", "race-specific", ["run", "wall-ball"]),
    ],
    taper: [
      blueprint("recovery", "recovery", ["mobility", "recovery"]),
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("mixed", "hybrid", ["run", "row"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("threshold", "threshold", ["run"]),
    ],
  },
  run: {
    base: [
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("base-builder", "aerobic-base", ["run"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
      blueprint("recovery", "recovery", ["recovery"]),
    ],
    build: [
      blueprint("threshold", "threshold", ["run"]),
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
      blueprint("mixed", "hybrid", ["run"]),
    ],
    deload: [
      blueprint("recovery", "recovery", ["recovery"]),
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("mixed", "hybrid", ["run"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
    ],
    specific: [
      blueprint("threshold", "threshold", ["run"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
      blueprint("mixed", "hybrid", ["run"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("race-simulation", "race-specific", ["run"]),
    ],
    taper: [
      blueprint("recovery", "recovery", ["recovery"]),
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("threshold", "threshold", ["run"]),
      blueprint("mixed", "hybrid", ["run"]),
      blueprint("strength", "strength", ["strength"]),
    ],
  },
  strength: {
    base: [
      blueprint("strength", "strength", ["strength"]),
      blueprint("base-engine", "aerobic-base", ["run", "row"]),
      blueprint("base-builder", "hybrid", ["strength", "run"]),
      blueprint("recovery", "recovery", ["mobility", "recovery"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
    ],
    build: [
      blueprint("strength", "strength", ["strength", "sled-push", "sled-pull"]),
      blueprint("mixed", "hybrid", ["strength", "run"]),
      blueprint("threshold", "threshold", ["run"]),
      blueprint("base-engine", "aerobic-base", ["run", "row"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
    ],
    deload: [
      blueprint("recovery", "recovery", ["mobility", "recovery"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("mixed", "hybrid", ["run", "strength"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
    ],
    specific: [
      blueprint("strength", "strength", ["strength", "sled-push", "sled-pull", "farmers-carry"]),
      blueprint("race-simulation", "race-specific", ["run", "sled-push", "sled-pull"]),
      blueprint("mixed", "hybrid", ["strength", "run"]),
      blueprint("threshold", "threshold", ["run"]),
      blueprint("long-engine", "aerobic-base", ["run"]),
    ],
    taper: [
      blueprint("recovery", "recovery", ["mobility", "recovery"]),
      blueprint("base-engine", "aerobic-base", ["run"]),
      blueprint("strength", "strength", ["strength"]),
      blueprint("mixed", "hybrid", ["run", "strength"]),
      blueprint("threshold", "threshold", ["run"]),
    ],
  },
};

export function getSessionBlueprints(
  goal: ProgramGoal,
  phase: ProgramPhase,
  frequency: number,
) {
  return policies[goal][phase].slice(0, Math.min(5, Math.max(1, frequency)));
}

export function scoreTemplateForBlueprint(
  template: WorkoutTemplate,
  session: SessionBlueprint,
) {
  let score = template.metadata?.category === session.category ? 100 : 0;
  const disciplines = new Set(inferTemplateDisciplineIds(template));
  for (const discipline of session.preferredDisciplines) {
    if (disciplines.has(discipline)) score += 10;
  }
  return score;
}
