import type {
  EquipmentId,
  ScheduledTrainingLocation,
  TrainingLocationPresetId,
  TrainingLocationProfile,
  WorkoutTemplate,
} from "./types";
import {
  getTrainingDiscipline,
  inferTemplateDisciplineIds,
} from "./training-domain";

export type TrainingLocationPreset = TrainingLocationPresetId;

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  none: "bez vybavení",
  running: "běžecký prostor / venkovní běh",
  treadmill: "běžecký pás",
  "ski-erg": "SkiErg",
  sled: "saně + dráha",
  rower: "veslo",
  "bike-erg": "BikeErg",
  "air-bike": "air bike / assault bike",
  kettlebell: "kettlebell",
  dumbbell: "jednoručky",
  sandbag: "sandbag",
  "medicine-ball": "medicinbal",
  "wall-ball": "wall ball + terč",
  barbell: "osa + kotouče",
  rack: "rack / stojan",
  bench: "lavice",
  box: "box / bedna",
  "pull-up-bar": "hrazda",
  "cable-machine": "kladka / cable machine",
  "resistance-band": "odporové gumy",
};

export const ALL_TRAINING_EQUIPMENT: EquipmentId[] = [
  "running",
  "treadmill",
  "ski-erg",
  "sled",
  "rower",
  "bike-erg",
  "air-bike",
  "kettlebell",
  "dumbbell",
  "sandbag",
  "medicine-ball",
  "wall-ball",
  "barbell",
  "rack",
  "bench",
  "box",
  "pull-up-bar",
  "cable-machine",
  "resistance-band",
];

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
    description: "Bez strojů, případně základní volné váhy a gumy.",
    equipment: ["none", "running", "kettlebell", "dumbbell", "resistance-band"],
  },
  "standard-gym": {
    label: "Běžné fitko",
    description: "Běžná silová a kardio výbava bez jistoty kompletní hybridní zóny.",
    equipment: [
      "none", "treadmill", "rower", "air-bike", "kettlebell", "dumbbell",
      "medicine-ball", "barbell", "rack", "bench", "box", "pull-up-bar",
      "cable-machine", "resistance-band",
    ],
  },
  "hybrid-gym": {
    label: "Hybridní fitko",
    description: "Plná HYROX / functional výbava.",
    equipment: ["none", ...ALL_TRAINING_EQUIPMENT],
  },
};

const EQUIPMENT_ALIASES: Partial<Record<EquipmentId, string[]>> = {
  treadmill: ["treadmill", "běžecký pás", "bezecky pas"],
  "ski-erg": ["skierg", "ski erg", "ski-erg"],
  sled: ["sled", "saně", "sáně"],
  rower: ["veslo", "rower", "rowing"],
  "bike-erg": ["bikeerg", "bike erg"],
  "air-bike": ["air bike", "assault bike", "echo bike"],
  kettlebell: ["kettlebell", "kb "],
  dumbbell: ["dumbbell", "jednoručk"],
  sandbag: ["sandbag", "sand bag"],
  "medicine-ball": ["medicine ball", "med ball", "medicinbal"],
  "wall-ball": ["wall ball", "wall-ball", "wallball"],
  barbell: ["barbell", "deadlift", "back squat", "front squat", "osa", "kotouč"],
  rack: ["rack", "squat rack", "stojan"],
  bench: ["bench press", "bench", "lavice"],
  box: ["box jump", "box step", "step-over", "step over"],
  "pull-up-bar": ["pull-up", "pull up", "hrazd", "toes to bar"],
  "cable-machine": ["cable", "kladk"],
  "resistance-band": ["resistance band", "banded", "odporov", "guma"],
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
  const explicit = (Object.entries(EQUIPMENT_ALIASES) as Array<[EquipmentId, string[]]>)
    .filter(([, aliases]) => aliases.some((alias) => text.includes(alias)))
    .map(([equipment]) => equipment);

  const disciplines = inferTemplateDisciplineIds(template);
  const unambiguous = disciplines.flatMap((disciplineId) => {
    const options = getTrainingDiscipline(disciplineId)?.equipment ?? [];
    return options.length === 1 && options[0] !== "none" ? options : [];
  });

  if (disciplines.includes("run") && !explicit.includes("treadmill")) {
    unambiguous.push("running");
  }

  return [...new Set([...explicit, ...unambiguous])];
}

export function templateFitsEquipment(template: WorkoutTemplate, equipment: EquipmentId[]) {
  const available = new Set<EquipmentId>(["none", ...equipment]);
  return requiredEquipmentForTemplate(template).every((item) => {
    if (item === "running") return available.has("running") || available.has("treadmill");
    return available.has(item);
  });
}

export function resolveTrainingLocation(
  location: ScheduledTrainingLocation,
  customLocations: TrainingLocationProfile[] = [],
) {
  if (location in TRAINING_LOCATION_PRESETS) {
    const preset = TRAINING_LOCATION_PRESETS[location as TrainingLocationPreset];
    return {
      id: location,
      label: preset.label,
      description: preset.description,
      equipment: preset.equipment,
      custom: false,
    };
  }

  const custom = customLocations.find((item) => item.id === location);
  if (!custom) return null;
  return {
    id: custom.id,
    label: custom.name,
    description: `${custom.equipment.length} položek dostupného vybavení.`,
    equipment: custom.equipment,
    custom: true,
  };
}

export function templateFitsLocation(
  template: WorkoutTemplate,
  location: ScheduledTrainingLocation,
  customLocations: TrainingLocationProfile[] = [],
) {
  const profile = resolveTrainingLocation(location, customLocations);
  return profile ? templateFitsEquipment(template, profile.equipment) : false;
}

export function findLocationAlternatives({
  current,
  templates,
  location,
  customLocations = [],
  limit = 5,
}: {
  current: WorkoutTemplate;
  templates: WorkoutTemplate[];
  location: ScheduledTrainingLocation;
  customLocations?: TrainingLocationProfile[];
  limit?: number;
}) {
  const currentCategory = current.metadata?.category;
  const currentDifficulty = current.metadata?.difficultyLevel ?? 1;

  return templates
    .filter((candidate) => candidate.id !== current.id)
    .filter((candidate) => templateFitsLocation(candidate, location, customLocations))
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

export function findCompatibleLocationForTemplate(
  template: WorkoutTemplate,
  locations: Array<{ id: ScheduledTrainingLocation; equipment: EquipmentId[] }>,
) {
  return locations.find((location) => templateFitsEquipment(template, location.equipment));
}

export function workoutContentSummary(template: WorkoutTemplate) {
  return template.blocks.map((block) => ({
    id: block.id,
    title: block.title,
    detail: block.steps.map((step) => step.name).join(" · "),
  }));
}
