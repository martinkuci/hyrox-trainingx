import {
  EXERCISE_LIBRARY,
  exerciseFitsEquipment,
  type ExerciseDefinition,
} from "./exercise-catalog";
import type {
  EquipmentId,
  NewWorkoutTemplate,
  WorkoutCategory,
  WorkoutStep,
} from "./types";

export type GeneratedWorkoutGoal = "hyrox" | "engine" | "strength" | "mixed" | "recovery";
export type GeneratedWorkoutDurationMinutes = 20 | 30 | 45 | 60;

export const GENERATED_WORKOUT_GOAL_LABELS: Record<GeneratedWorkoutGoal, string> = {
  hyrox: "HYROX",
  engine: "Engine",
  strength: "Síla",
  mixed: "Hybrid",
  recovery: "Mobilita & recovery",
};

export const GENERATED_WORKOUT_DURATIONS: GeneratedWorkoutDurationMinutes[] = [20, 30, 45, 60];

const GOAL_CONFIG: Record<GeneratedWorkoutGoal, {
  category: WorkoutCategory;
  targetRpe: [number, number];
  difficulty: 1 | 2 | 3;
  primaryMetric: string;
}> = {
  hyrox: { category: "race-simulation", targetRpe: [7, 9], difficulty: 2, primaryMetric: "stabilní tempo mezi stanovišti" },
  engine: { category: "base-engine", targetRpe: [6, 8], difficulty: 2, primaryMetric: "konzistentní výkon bez výrazného propadu" },
  strength: { category: "strength", targetRpe: [7, 9], difficulty: 2, primaryMetric: "kvalita opakování a použitá zátěž" },
  mixed: { category: "mixed", targetRpe: [7, 9], difficulty: 2, primaryMetric: "rovnoměrný výkon napříč pohyby" },
  recovery: { category: "recovery", targetRpe: [2, 4], difficulty: 1, primaryMetric: "rozsah pohybu a subjektivní uvolnění" },
};

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

function goalMatches(exercise: ExerciseDefinition, goal: GeneratedWorkoutGoal) {
  if (goal === "hyrox") return exercise.category === "hyrox" || exercise.tags.includes("hyrox");
  if (goal === "engine") {
    return exercise.category === "running"
      || exercise.category === "conditioning"
      || exercise.tags.includes("cardio")
      || exercise.tags.includes("engine")
      || exercise.tags.includes("erg");
  }
  if (goal === "strength") return exercise.category === "strength" || exercise.tags.includes("strength");
  if (goal === "mixed") {
    return exercise.category === "strength"
      || exercise.category === "hyrox"
      || exercise.category === "conditioning"
      || exercise.category === "running";
  }
  return exercise.category === "mobility"
    || exercise.category === "compensation"
    || exercise.category === "recovery"
    || exercise.tags.includes("mobility")
    || exercise.tags.includes("recovery")
    || exercise.tags.includes("prehab");
}

function pickDiverse(candidates: ExerciseDefinition[], count: number, seed: string, excluded = new Set<string>()) {
  const rotated = rotate(candidates, hashSeed(seed));
  const selected: ExerciseDefinition[] = [];
  const families = new Set<string>();

  for (const exercise of rotated) {
    if (selected.length >= count) break;
    if (excluded.has(exercise.id) || families.has(exercise.movementFamily)) continue;
    selected.push(exercise);
    families.add(exercise.movementFamily);
  }

  for (const exercise of rotated) {
    if (selected.length >= count) break;
    if (excluded.has(exercise.id) || selected.some((item) => item.id === exercise.id)) continue;
    selected.push(exercise);
  }

  return selected;
}

function mainCount(durationMinutes: GeneratedWorkoutDurationMinutes) {
  if (durationMinutes === 20) return 3;
  if (durationMinutes === 30) return 4;
  if (durationMinutes === 45) return 5;
  return 6;
}

function prescriptionFor(exercise: ExerciseDefinition, goal: GeneratedWorkoutGoal) {
  if (goal === "recovery") return "45–60 s plynule · bez bolesti · klidné dýchání";
  if (exercise.id === "run" || exercise.category === "running") return "400 m nebo 2 min v kontrolovaném tempu";
  if (exercise.equipment.some((requirement) => requirement.anyOf.some((item) => ["rower", "ski-erg", "bike-erg", "air-bike", "spin-bike"].includes(item)))) {
    return "45–60 s práce nebo 250–400 m podle stroje";
  }
  if (exercise.id.includes("sled") || exercise.id.includes("carry") || exercise.id.includes("lunge")) return "20–30 m kvalitní práce";
  if (exercise.category === "strength") return "8–12 kvalitních opakování · nech 2–3 opakování v rezervě";
  if (exercise.tags.includes("core")) return "10–15 opakování nebo 30–40 s práce";
  return "10–15 kvalitních opakování";
}

function toStep(exercise: ExerciseDefinition, index: number, goal: GeneratedWorkoutGoal, prefix: string): WorkoutStep {
  return {
    id: `${prefix}-${index + 1}-${exercise.id}`,
    name: exercise.name,
    detail: prescriptionFor(exercise, goal),
    exerciseId: exercise.id,
  };
}

function compatibleCandidates(equipment: EquipmentId[]) {
  return EXERCISE_LIBRARY.filter((exercise) => exerciseFitsEquipment(exercise, equipment));
}

export function buildGeneratedWorkout({
  equipment,
  goal,
  durationMinutes,
  seed = "enginn-generated-workout",
  locationLabel,
}: {
  equipment: EquipmentId[];
  goal: GeneratedWorkoutGoal;
  durationMinutes: GeneratedWorkoutDurationMinutes;
  seed?: string;
  locationLabel?: string;
}): NewWorkoutTemplate {
  const compatible = compatibleCandidates(equipment);
  const goalCandidates = compatible.filter((exercise) => goalMatches(exercise, goal));
  const mainPool = goalCandidates.length >= 2
    ? goalCandidates
    : compatible.filter((exercise) => !["warmup", "mobility", "recovery"].includes(exercise.category));
  const main = pickDiverse(mainPool, mainCount(durationMinutes), `${seed}-${goal}-main`);
  const mainIds = new Set(main.map((exercise) => exercise.id));

  const warmupPool = compatible.filter((exercise) =>
    !mainIds.has(exercise.id)
    && (exercise.category === "warmup" || exercise.category === "mobility" || exercise.tags.includes("warmup")),
  );
  const warmup = goal === "recovery" ? [] : pickDiverse(warmupPool, 2, `${seed}-${goal}-warmup`, mainIds);
  const excluded = new Set([...mainIds, ...warmup.map((exercise) => exercise.id)]);
  const recoveryPool = compatible.filter((exercise) =>
    !excluded.has(exercise.id)
    && (exercise.category === "mobility" || exercise.category === "compensation" || exercise.category === "recovery"),
  );
  const cooldown = goal === "recovery" ? [] : pickDiverse(recoveryPool, 2, `${seed}-${goal}-cooldown`, excluded);

  const blocks: NewWorkoutTemplate["blocks"] = [];
  if (warmup.length > 0) {
    blocks.push({
      id: `generated-warmup-${hashSeed(seed).toString(36)}`,
      type: "manual",
      title: "Rozcvičení",
      repeat: 1,
      steps: warmup.map((exercise, index) => toStep(exercise, index, "recovery", "warmup")),
    });
  }

  if (goal === "strength") {
    blocks.push({
      id: `generated-main-${hashSeed(`${seed}-main`).toString(36)}`,
      type: "manual",
      title: "Hlavní silový blok",
      repeat: durationMinutes >= 45 ? 4 : 3,
      steps: main.map((exercise, index) => toStep(exercise, index, goal, "main")),
    });
  } else if (goal === "recovery") {
    blocks.push({
      id: `generated-main-${hashSeed(`${seed}-main`).toString(36)}`,
      type: "manual",
      title: "Mobilita a regenerace",
      repeat: durationMinutes >= 45 ? 3 : 2,
      steps: main.map((exercise, index) => toStep(exercise, index, goal, "main")),
    });
  } else {
    blocks.push({
      id: `generated-main-${hashSeed(`${seed}-main`).toString(36)}`,
      type: "amrap",
      title: goal === "hyrox" ? "HYROX hlavní blok" : goal === "engine" ? "Engine hlavní blok" : "Hybrid hlavní blok",
      minutes: Math.max(12, durationMinutes - (warmup.length > 0 ? 8 : 3) - (cooldown.length > 0 ? 4 : 0)),
      steps: main.map((exercise, index) => toStep(exercise, index, goal, "main")),
    });
  }

  if (cooldown.length > 0) {
    blocks.push({
      id: `generated-cooldown-${hashSeed(`${seed}-cooldown`).toString(36)}`,
      type: "manual",
      title: "Zklidnění",
      repeat: 1,
      steps: cooldown.map((exercise, index) => toStep(exercise, index, "recovery", "cooldown")),
    });
  }

  const config = GOAL_CONFIG[goal];
  const code = `GEN-${hashSeed(`${seed}-${goal}-${durationMinutes}`).toString(36).slice(0, 5).toUpperCase()}`;
  const label = GENERATED_WORKOUT_GOAL_LABELS[goal];

  return {
    title: `Enginn · ${label} · ${durationMinutes} min`,
    description: `Workout složený Enginnem z jednotlivých cviků podle cíle, času${locationLabel ? ` a vybavení místa ${locationLabel}` : " a dostupného vybavení"}.`,
    durationMinutes,
    tags: ["enginn-generated", "exercise-composed", goal],
    metadata: {
      workoutCode: code,
      templateVersion: 1,
      category: config.category,
      goal: label,
      targetRpeMin: config.targetRpe[0],
      targetRpeMax: config.targetRpe[1],
      expectedDurationMin: Math.max(10, durationMinutes - 5),
      expectedDurationMax: durationMinutes + 5,
      runningTarget: goal === "engine" || goal === "hyrox" || goal === "mixed" ? "kontrolované tempo podle RPE" : "",
      primaryMetric: config.primaryMetric,
      secondaryMetrics: ["RPE", "technika", "konzistence"],
      progressionGroup: `enginn-generated-${goal}`,
      difficultyLevel: durationMinutes === 60 && config.difficulty < 3 ? 3 : config.difficulty,
    },
    blocks,
  };
}
