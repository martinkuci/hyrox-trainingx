import {
  EXERCISE_LIBRARY,
  exerciseFitsEquipment,
  getExerciseForStep,
  type ExerciseDefinition,
} from "./exercise-catalog";
import type { EquipmentId, WorkoutTemplate } from "./types";

export type RecoveryIntent = "warmup" | "cooldown" | "mobility" | "prehab";
export type RecoveryArea =
  | "full-body"
  | "ankles-calves"
  | "hips"
  | "posterior-chain"
  | "shoulders"
  | "thoracic-back"
  | "core";

export type RecoveryDurationMinutes = 5 | 8 | 10 | 15;

export type RecoveryPlanExercise = {
  exerciseId: string;
  name: string;
  prescription: string;
  reason: string;
};

export type RecoveryPlan = {
  intent: RecoveryIntent;
  area: RecoveryArea;
  durationMinutes: RecoveryDurationMinutes;
  exercises: RecoveryPlanExercise[];
};

export const RECOVERY_INTENT_LABELS: Record<RecoveryIntent, string> = {
  warmup: "Příprava před tréninkem",
  cooldown: "Zklidnění po tréninku",
  mobility: "Mobilita",
  prehab: "Kompenzace / prehab",
};

export const RECOVERY_AREA_LABELS: Record<RecoveryArea, string> = {
  "full-body": "Celé tělo",
  "ankles-calves": "Kotníky & lýtka",
  hips: "Kyčle & hýždě",
  "posterior-chain": "Zadní řetězec",
  shoulders: "Ramena & lopatky",
  "thoracic-back": "Hrudní páteř & záda",
  core: "Core & stabilita",
};

export const RECOVERY_DURATIONS: RecoveryDurationMinutes[] = [5, 8, 10, 15];

const AREA_KEYWORDS: Record<Exclude<RecoveryArea, "full-body">, string[]> = {
  "ankles-calves": ["ankle", "ankles", "calf", "calves", "kotník", "kotnik", "lýtka", "lytka", "běrec", "running"],
  hips: ["hips", "hip", "kyčle", "kycle", "glute", "glutes", "hýždě", "hyzde", "adductor", "addukt"],
  "posterior-chain": ["posterior-chain", "hamstring", "hamstringy", "hinge", "deadlift", "záda", "zada"],
  shoulders: ["shoulder", "shoulders", "ramena", "rameno", "scap", "lopat", "rotátor", "rotator", "chest", "prsní"],
  "thoracic-back": ["thoracic", "upper-back", "back", "páteř", "pater", "záda", "zada", "lat", "lats"],
  core: ["core", "bři", "bricho", "anti-rotation", "stabil", "trunk"],
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase("cs")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function exerciseText(exercise: ExerciseDefinition) {
  return normalize([
    exercise.name,
    exercise.movementFamily,
    ...exercise.primaryMuscles,
    ...exercise.purposes,
    ...exercise.tags,
  ].join(" "));
}

function areaMatchScore(exercise: ExerciseDefinition, area: RecoveryArea) {
  if (area === "full-body") {
    return exercise.tags.includes("full-body") ? 6 : 1;
  }
  const text = exerciseText(exercise);
  return AREA_KEYWORDS[area].reduce((score, keyword) => score + (text.includes(normalize(keyword)) ? 2 : 0), 0);
}

function intentMatchScore(exercise: ExerciseDefinition, intent: RecoveryIntent) {
  const tag = (value: string) => exercise.tags.includes(value);
  if (intent === "warmup") {
    return (exercise.category === "warmup" ? 10 : 0)
      + (tag("warmup") ? 8 : 0)
      + (tag("activation") ? 5 : 0)
      + (exercise.category === "mobility" ? 2 : 0);
  }
  if (intent === "cooldown") {
    return (exercise.category === "recovery" ? 10 : 0)
      + (tag("cooldown") ? 8 : 0)
      + (tag("recovery") ? 4 : 0)
      + (exercise.category === "mobility" ? 3 : 0);
  }
  if (intent === "mobility") {
    return (exercise.category === "mobility" ? 10 : 0)
      + (tag("mobility") ? 6 : 0)
      + (exercise.category === "recovery" ? 2 : 0);
  }
  return (exercise.category === "compensation" ? 10 : 0)
    + (tag("prehab") ? 8 : 0)
    + (tag("compensation") ? 5 : 0)
    + (exercise.category === "warmup" ? 2 : 0)
    + (exercise.category === "mobility" ? 2 : 0);
}

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

function targetCount(durationMinutes: RecoveryDurationMinutes) {
  if (durationMinutes === 5) return 2;
  if (durationMinutes === 8) return 3;
  if (durationMinutes === 10) return 4;
  return 5;
}

function prescriptionFor(exercise: ExerciseDefinition, intent: RecoveryIntent) {
  if (intent === "warmup") {
    if (exercise.tags.includes("activation")) return "8–12 kontrolovaných opakování · 1–2 kola";
    return "30–45 s plynule na každou stranu · 1–2 kola";
  }
  if (intent === "cooldown") return "45–60 s klidně · vystřídej strany · bez bolesti";
  if (intent === "mobility") return "45–60 s plynule · 2–3 pomalé průchody rozsahem";
  if (exercise.tags.includes("activation")) return "8–15 kvalitních opakování · lehká intenzita";
  return "30–45 s nebo 8–12 kvalitních opakování · kontrolovaně";
}

function candidateExercises(equipment: EquipmentId[], intent: RecoveryIntent, area: RecoveryArea) {
  return EXERCISE_LIBRARY
    .filter((exercise) => ["warmup", "mobility", "compensation", "recovery"].includes(exercise.category))
    .filter((exercise) => exerciseFitsEquipment(exercise, equipment))
    .map((exercise) => ({
      exercise,
      score: intentMatchScore(exercise, intent) + areaMatchScore(exercise, area),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.exercise.name.localeCompare(right.exercise.name, "cs"));
}

function pickDiverse(
  candidates: Array<{ exercise: ExerciseDefinition; score: number }>,
  count: number,
  seed: string,
) {
  if (candidates.length <= count) return candidates.map((item) => item.exercise);
  const offset = hashSeed(seed) % candidates.length;
  const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  const selected: ExerciseDefinition[] = [];
  const families = new Set<string>();

  for (const item of rotated) {
    if (selected.length >= count) break;
    if (families.has(item.exercise.movementFamily)) continue;
    selected.push(item.exercise);
    families.add(item.exercise.movementFamily);
  }
  for (const item of rotated) {
    if (selected.length >= count) break;
    if (selected.some((exercise) => exercise.id === item.exercise.id)) continue;
    selected.push(item.exercise);
  }
  return selected;
}

export function buildRecoveryPlan({
  equipment,
  intent,
  area,
  durationMinutes,
  seed = "enginn-recovery",
}: {
  equipment: EquipmentId[];
  intent: RecoveryIntent;
  area: RecoveryArea;
  durationMinutes: RecoveryDurationMinutes;
  seed?: string;
}): RecoveryPlan {
  const primary = candidateExercises(equipment, intent, area);
  const fallback = area === "full-body" ? primary : candidateExercises(equipment, intent, "full-body");
  const candidates = primary.length >= targetCount(durationMinutes) ? primary : [...primary, ...fallback.filter((item) => !primary.some((primaryItem) => primaryItem.exercise.id === item.exercise.id))];
  const selected = pickDiverse(candidates, targetCount(durationMinutes), `${seed}-${intent}-${area}-${durationMinutes}`);

  return {
    intent,
    area,
    durationMinutes,
    exercises: selected.map((exercise) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      prescription: prescriptionFor(exercise, intent),
      reason: area === "full-body" ? RECOVERY_INTENT_LABELS[intent] : RECOVERY_AREA_LABELS[area],
    })),
  };
}

export function inferWorkoutRecoveryAreas(template: WorkoutTemplate) {
  const scores = new Map<Exclude<RecoveryArea, "full-body">, number>();
  const exercises = template.blocks.flatMap((block) => block.steps.map((step) => getExerciseForStep(step))).filter(Boolean) as ExerciseDefinition[];

  for (const exercise of exercises) {
    for (const area of Object.keys(AREA_KEYWORDS) as Array<Exclude<RecoveryArea, "full-body">>) {
      const score = areaMatchScore(exercise, area);
      if (score > 0) scores.set(area, (scores.get(area) ?? 0) + score);
    }
  }

  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([area, score]) => ({ area, score, label: RECOVERY_AREA_LABELS[area] }));
}

export function buildWorkoutRecoveryPlan({
  template,
  equipment,
  when,
  durationMinutes = 8,
  seed,
}: {
  template: WorkoutTemplate;
  equipment: EquipmentId[];
  when: "before" | "after";
  durationMinutes?: RecoveryDurationMinutes;
  seed?: string;
}) {
  const inferred = inferWorkoutRecoveryAreas(template);
  const area = inferred[0]?.area ?? "full-body";
  const plan = buildRecoveryPlan({
    equipment,
    intent: when === "before" ? "warmup" : "cooldown",
    area,
    durationMinutes,
    seed: seed ?? `${template.id}-${when}`,
  });
  return { ...plan, inferredAreas: inferred };
}
