import type { WorkoutTemplate } from "./types";

export type DisciplineId =
  | "run"
  | "ski-erg"
  | "sled-push"
  | "sled-pull"
  | "burpee-broad-jump"
  | "row"
  | "farmers-carry"
  | "sandbag-lunge"
  | "wall-ball"
  | "strength"
  | "mobility"
  | "recovery";

export type EquipmentId =
  | "none"
  | "running"
  | "ski-erg"
  | "sled"
  | "rower"
  | "kettlebell"
  | "dumbbell"
  | "sandbag"
  | "wall-ball"
  | "barbell"
  | "box";

export type MovementFamily =
  | "running"
  | "erg"
  | "push"
  | "pull"
  | "carry"
  | "lunge"
  | "squat"
  | "burpee"
  | "strength"
  | "mobility"
  | "recovery";

export type TrainingFocus =
  | "aerobic-base"
  | "threshold"
  | "strength"
  | "hybrid"
  | "race-specific"
  | "recovery";

export type TrainingDiscipline = {
  id: DisciplineId;
  name: string;
  shortName: string;
  family: MovementFamily;
  equipment: EquipmentId[];
  hyroxStation?: number;
  aliases: string[];
  measurableBy: Array<"time" | "distance" | "reps" | "load" | "pace">;
};

export const TRAINING_DISCIPLINES: readonly TrainingDiscipline[] = [
  {
    id: "run",
    name: "Běh",
    shortName: "Běh",
    family: "running",
    equipment: ["running"],
    aliases: ["běh", "run", "running", "klus", "sprint"],
    measurableBy: ["time", "distance", "pace"],
  },
  {
    id: "ski-erg",
    name: "SkiErg",
    shortName: "SkiErg",
    family: "erg",
    equipment: ["ski-erg"],
    hyroxStation: 1,
    aliases: ["skierg", "ski erg", "ski-erg"],
    measurableBy: ["time", "distance", "pace"],
  },
  {
    id: "sled-push",
    name: "Sled Push",
    shortName: "Sled Push",
    family: "push",
    equipment: ["sled"],
    hyroxStation: 2,
    aliases: ["sled push", "tlačení saní", "saně push"],
    measurableBy: ["time", "distance", "load"],
  },
  {
    id: "sled-pull",
    name: "Sled Pull",
    shortName: "Sled Pull",
    family: "pull",
    equipment: ["sled"],
    hyroxStation: 3,
    aliases: ["sled pull", "tažení saní", "saně pull"],
    measurableBy: ["time", "distance", "load"],
  },
  {
    id: "burpee-broad-jump",
    name: "Burpee Broad Jump",
    shortName: "Burpee BJ",
    family: "burpee",
    equipment: ["none"],
    hyroxStation: 4,
    aliases: ["burpee broad jump", "burpee broad jumps", "bbj"],
    measurableBy: ["time", "distance", "reps"],
  },
  {
    id: "row",
    name: "Veslo",
    shortName: "Veslo",
    family: "erg",
    equipment: ["rower"],
    hyroxStation: 5,
    aliases: ["veslo", "row", "rower", "rowing"],
    measurableBy: ["time", "distance", "pace"],
  },
  {
    id: "farmers-carry",
    name: "Farmers Carry",
    shortName: "Carry",
    family: "carry",
    equipment: ["kettlebell", "dumbbell"],
    hyroxStation: 6,
    aliases: ["farmers carry", "farmer carry", "farmářská chůze"],
    measurableBy: ["time", "distance", "load"],
  },
  {
    id: "sandbag-lunge",
    name: "Sandbag Lunges",
    shortName: "Lunges",
    family: "lunge",
    equipment: ["sandbag"],
    hyroxStation: 7,
    aliases: ["sandbag lunge", "sandbag lunges", "walking lunges", "výpady"],
    measurableBy: ["time", "distance", "reps", "load"],
  },
  {
    id: "wall-ball",
    name: "Wall Balls",
    shortName: "Wall Balls",
    family: "squat",
    equipment: ["wall-ball"],
    hyroxStation: 8,
    aliases: ["wall ball", "wall balls", "wallball", "wallballs"],
    measurableBy: ["time", "reps", "load"],
  },
  {
    id: "strength",
    name: "Silová příprava",
    shortName: "Síla",
    family: "strength",
    equipment: ["barbell", "dumbbell", "kettlebell", "sandbag", "none"],
    aliases: ["strength", "síla", "silový", "deadlift", "squat", "press", "push-up", "klik", "kettlebell swing"],
    measurableBy: ["reps", "load", "time"],
  },
  {
    id: "mobility",
    name: "Mobilita",
    shortName: "Mobilita",
    family: "mobility",
    equipment: ["none"],
    aliases: ["mobility", "mobilita", "protažení", "stretch"],
    measurableBy: ["time"],
  },
  {
    id: "recovery",
    name: "Regenerace",
    shortName: "Recovery",
    family: "recovery",
    equipment: ["none", "running", "rower", "ski-erg"],
    aliases: ["recovery", "regenerace", "vychození", "chůze", "easy"],
    measurableBy: ["time", "distance"],
  },
] as const;

export function getTrainingDiscipline(id: DisciplineId) {
  return TRAINING_DISCIPLINES.find((discipline) => discipline.id === id);
}

function normalize(value: string) {
  return value.toLocaleLowerCase("cs").replace(/\s+/g, " ").trim();
}

export function inferDisciplineIdsFromText(value: string): DisciplineId[] {
  const text = normalize(value);
  if (!text) return [];

  return TRAINING_DISCIPLINES.filter((discipline) =>
    discipline.aliases.some((alias) => text.includes(normalize(alias))),
  ).map((discipline) => discipline.id);
}

export function inferTemplateDisciplineIds(template: WorkoutTemplate): DisciplineId[] {
  const values = [
    template.title,
    template.description,
    ...template.tags,
    ...template.blocks.flatMap((block) => [
      block.title,
      ...block.steps.flatMap((step) => [step.name, step.detail]),
    ]),
  ];

  return [...new Set(values.flatMap(inferDisciplineIdsFromText))];
}
