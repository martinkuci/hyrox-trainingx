import type { WorkoutTemplate } from "./types";
import {
  getTrainingDiscipline,
  inferTemplateDisciplineIds,
  type EquipmentId,
} from "./training-domain";

export type TrainingLocationPreset =
  | "outdoor"
  | "home"
  | "standard-gym"
  | "hybrid-gym";

export const TRAINING_LOCATION_PRESETS: Record<
  TrainingLocationPreset,
  { label: string; description: string; equipment: EquipmentId[] }
> = {
  outdoor: {
    label: "Venku",
    description: "Běh a cviky bez vybavení.",
    equipment: ["none", "running"],
  },
  home: {
    label: "Doma / minimum",
    description: "Bez strojů, případně jednoručky nebo kettlebell.",
    equipment: ["none", "running", "dumbbell", "kettlebell"],
  },
  "standard-gym": {
    label: "Běžné fitko",
    description: "Činky a kardio stroje bez jistoty saní, SkiErgu a wall-ball zóny.",
    equipment: ["none", "running", "rower", "kettlebell", "dumbbell", "barbell", "box"],
  },
  "hybrid-gym": {
    label: "Hybridní fitko",
    description: "Plná HYROX / functional výbava.",
    equipment: [
      "none",
      "running",
      "ski-erg",
      "sled",
      "rower",
      "kettlebell",
      "dumbbell",
      "sandbag",
      "wall-ball",
      "barbell",
      "box",
    ],
  },
};

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  none: "bez vybavení",
  running: "běžecký prostor",
  "ski-erg": "SkiErg",
  sled: "saně",
  rower: "veslo",
  kettlebell: "kettlebell",
  dumbbell: "jednoručky",
  sandbag: "sandbag",
  "wall-ball": "wall ball",
  barbell: "osa + kotouče",
  box: "box",
};

const EQUIPMENT_ALIASES: Partial<Record<EquipmentId, string[]>> = {
  "ski-erg": ["skierg", "ski erg", "ski-erg"],
  sled: ["sled", "saně", "sáně"],
  rower: ["veslo", "rower", "rowing"],
  kettlebell: ["kettlebell", "kb "],
  dumbbell: ["dumbbell", "jednoručk"],
  sandbag: ["sandbag", "sand bag"],
  "wall-ball": ["wall ball", "wall-ball", "wallball"],
  barbell: ["barbell", "deadlift", "back squat", "front squat", "osa", "kotouč"],
  box: ["box jump", "box step", "step-over", "step over"],
};

function templateSearchText(template: WorkoutTemplate) {
  return [
    template.title,
    template.description,
    ...template.tags,
    ...template.blocks.flatMap((block) => [
      block.title,
      ...block.steps.flatMap((step) => [step.name, step.detail]),
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase("cs");
}

export function requiredEquipmentForTemplate(template: WorkoutTemplate): EquipmentId[] {
  const text = templateSearchText(template);
  const explicit = (Object.entries(EQUIPMENT_ALIASES) as Array<[EquipmentId, string[]]> )
    .filter(([, aliases]) => aliases.some((alias) => text.includes(alias)))
    .map(([equipment]) => equipment);

  const disciplines = inferTemplateDisciplineIds(template);
  const unambiguous = disciplines.flatMap((disciplineId) => {
    const options = getTrainingDiscipline(disciplineId)?.equipment ?? [];
    return options.length === 1 && options[0] !== "none" ? options : [];
  });

  if (disciplines.includes("run")) unambiguous.push("running");

  return [...new Set([...explicit, ...unambiguous])];
}

export function templateFitsLocation(
  template: WorkoutTemplate,
  location: TrainingLocationPreset,
) {
  const available = new Set(TRAINING_LOCATION_PRESETS[location].equipment);
  return requiredEquipmentForTemplate(template).every((item) => available.has(item));
}

export function findLocationAlternatives({
  current,
  templates,
  location,
  limit = 5,
}: {
  current: WorkoutTemplate;
  templates: WorkoutTemplate[];
  location: TrainingLocationPreset;
  limit?: number;
}) {
  const currentCategory = current.metadata?.category;
  const currentDifficulty = current.metadata?.difficultyLevel ?? 1;

  return templates
    .filter((candidate) => candidate.id !== current.id)
    .filter((candidate) => templateFitsLocation(candidate, location))
    .map((candidate) => {
      const categoryPenalty = candidate.metadata?.category === currentCategory ? 0 : 20;
      const difficultyPenalty = Math.abs(
        (candidate.metadata?.difficultyLevel ?? 1) - currentDifficulty,
      ) * 5;
      const durationPenalty = Math.abs(candidate.durationMinutes - current.durationMinutes) / 5;
      return {
        template: candidate,
        score: categoryPenalty + difficultyPenalty + durationPenalty,
      };
    })
    .sort((left, right) => left.score - right.score)
    .slice(0, limit)
    .map((item) => item.template);
}

export function workoutContentSummary(template: WorkoutTemplate) {
  return template.blocks.map((block) => ({
    id: block.id,
    title: block.title,
    detail: block.steps.map((step) => step.name).join(" · "),
  }));
}
