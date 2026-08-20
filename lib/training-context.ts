import type {
  EquipmentId,
  ProgramPhase,
  ScheduledTrainingLocation,
  TrainingLocationPresetId,
  TrainingLocationProfile,
  WorkoutCategory,
  WorkoutTemplate,
} from "./types";
import { getExerciseForStep } from "./exercise-catalog";
import {
  getTrainingDiscipline,
  inferTemplateDisciplineIds,
} from "./training-domain.ts";

export type TrainingLocationPreset = TrainingLocationPresetId;
export type EquipmentRequirement = { anyOf: EquipmentId[] };

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  none: "bez vybavení",
  running: "běžecký prostor / venkovní běh",
  treadmill: "běžecký pás",
  "ski-erg": "SkiErg",
  sled: "saně + dráha",
  rower: "veslo",
  "bike-erg": "BikeErg",
  "air-bike": "air bike / assault bike",
  "stair-climber": "stair climber / schody",
  elliptical: "eliptický trenažér",
  "spin-bike": "spinning bike",
  kettlebell: "kettlebell",
  dumbbell: "jednoručky",
  sandbag: "sandbag",
  "medicine-ball": "medicinbal",
  "wall-ball": "wall ball + terč",
  barbell: "osa + kotouče",
  "trap-bar": "trap bar / hex bar",
  "ez-bar": "EZ osa",
  landmine: "landmine adaptér",
  rack: "rack / stojan",
  bench: "lavice",
  box: "box / bedna",
  "pull-up-bar": "hrazda",
  "dip-bars": "bradla",
  rings: "gymnastické kruhy",
  "suspension-trainer": "TRX / závěsný systém",
  "cable-machine": "kladka / cable machine",
  "lat-pulldown": "lat pulldown",
  "seated-row-machine": "veslovací posilovací stroj",
  "chest-press-machine": "chest press stroj",
  "shoulder-press-machine": "shoulder press stroj",
  "pec-deck": "pec deck / rear delt",
  "leg-press": "leg press",
  "hack-squat": "hack squat",
  "leg-extension": "leg extension",
  "leg-curl": "leg curl",
  "calf-machine": "stroj na lýtka",
  "hip-abductor-machine": "abductor machine",
  "hip-adductor-machine": "adductor machine",
  "hip-thrust-machine": "hip thrust / glute drive stroj",
  "smith-machine": "Smith machine",
  "assisted-pullup": "assisted pull-up / dip stroj",
  "back-extension-bench": "hyperextenze / back extension lavice",
  ghd: "GHD",
  "ab-wheel": "ab wheel",
  "battle-rope": "battle rope",
  "jump-rope": "švihadlo",
  "resistance-band": "odporové gumy",
  mat: "podložka",
};

export const ALL_TRAINING_EQUIPMENT: EquipmentId[] = [
  "running", "treadmill", "ski-erg", "sled", "rower", "bike-erg", "air-bike",
  "stair-climber", "elliptical", "spin-bike", "kettlebell", "dumbbell", "sandbag",
  "medicine-ball", "wall-ball", "barbell", "trap-bar", "ez-bar", "landmine", "rack",
  "bench", "box", "pull-up-bar", "dip-bars", "rings", "suspension-trainer", "cable-machine",
  "lat-pulldown", "seated-row-machine", "chest-press-machine", "shoulder-press-machine",
  "pec-deck", "leg-press", "hack-squat", "leg-extension", "leg-curl", "calf-machine",
  "hip-abductor-machine", "hip-adductor-machine", "hip-thrust-machine", "smith-machine",
  "assisted-pullup", "back-extension-bench", "ghd", "ab-wheel", "battle-rope", "jump-rope",
  "resistance-band", "mat",
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
    description: "Vlastní váha a běžné domácí vybavení.",
    equipment: ["none", "running", "kettlebell", "dumbbell", "resistance-band", "mat", "jump-rope", "suspension-trainer"],
  },
  "standard-gym": {
    label: "Běžné fitko",
    description: "Běžná silová, strojová a kardio výbava bez jistoty kompletní HYROX zóny.",
    equipment: [
      "none", "treadmill", "rower", "spin-bike", "elliptical", "air-bike", "kettlebell", "dumbbell",
      "medicine-ball", "barbell", "rack", "bench", "box", "pull-up-bar", "dip-bars", "cable-machine",
      "lat-pulldown", "seated-row-machine", "chest-press-machine", "shoulder-press-machine", "pec-deck",
      "leg-press", "leg-extension", "leg-curl", "calf-machine", "smith-machine", "assisted-pullup",
      "back-extension-bench", "resistance-band", "mat",
    ],
  },
  "hybrid-gym": {
    label: "Hybridní fitko",
    description: "Plná HYROX / functional výbava včetně běžné posilovny.",
    equipment: ["none", ...ALL_TRAINING_EQUIPMENT],
  },
};

const EQUIPMENT_ALIASES: Partial<Record<EquipmentId, string[]>> = {
  running: ["běh", "klus", "run", "running"],
  treadmill: ["treadmill", "běžecký pás", "bezecky pas"],
  "ski-erg": ["skierg", "ski erg", "ski-erg"],
  sled: ["sled", "saně", "sáně"],
  rower: ["veslo", "rower", "rowing"],
  "bike-erg": ["bikeerg", "bike erg"],
  "air-bike": ["air bike", "assault bike", "echo bike"],
  "stair-climber": ["stair climber", "stairmaster"],
  elliptical: ["elliptical", "eliptický"],
  "spin-bike": ["spin bike", "spinning"],
  kettlebell: ["kettlebell", "kb "],
  dumbbell: ["dumbbell", "jednoručk"],
  sandbag: ["sandbag", "sand bag"],
  "medicine-ball": ["medicine ball", "med ball", "medicinbal"],
  "wall-ball": ["wall ball", "wall-ball", "wallball"],
  barbell: ["barbell", "deadlift", "back squat", "front squat", "osa", "kotouč"],
  "trap-bar": ["trap bar", "hex bar"],
  "ez-bar": ["ez bar", "ez osa"],
  landmine: ["landmine"],
  rack: ["rack", "squat rack", "stojan"],
  bench: ["bench press", "bench", "lavice"],
  box: ["box jump", "box step", "step-over", "step over"],
  "pull-up-bar": ["pull-up", "pull up", "hrazd", "toes to bar"],
  "dip-bars": ["dip bars", "bradla"],
  rings: ["rings", "kruhy", "ring row", "ring dip"],
  "suspension-trainer": ["trx", "suspension trainer"],
  "cable-machine": ["cable", "kladk"],
  "lat-pulldown": ["lat pulldown"],
  "seated-row-machine": ["seated row machine"],
  "chest-press-machine": ["chest press machine"],
  "shoulder-press-machine": ["shoulder press machine"],
  "pec-deck": ["pec deck", "rear delt machine"],
  "leg-press": ["leg press"],
  "hack-squat": ["hack squat"],
  "leg-extension": ["leg extension"],
  "leg-curl": ["leg curl"],
  "calf-machine": ["calf machine"],
  "hip-abductor-machine": ["abductor machine"],
  "hip-adductor-machine": ["adductor machine"],
  "hip-thrust-machine": ["hip thrust machine", "glute drive"],
  "smith-machine": ["smith machine"],
  "assisted-pullup": ["assisted pull-up", "assisted dip"],
  "back-extension-bench": ["back extension", "hyperextension"],
  ghd: ["ghd"],
  "ab-wheel": ["ab wheel"],
  "battle-rope": ["battle rope"],
  "jump-rope": ["jump rope", "švihadlo", "double under", "single under"],
  "resistance-band": ["resistance band", "banded", "odporov", "guma"],
  mat: ["podložka", "mat"],
};

const PHASE_CATEGORY_ORDER: Record<ProgramPhase, WorkoutCategory[]> = {
  base: ["base-engine", "strength", "base-builder", "long-engine", "recovery", "mixed", "threshold", "race-simulation"],
  build: ["threshold", "strength", "mixed", "base-engine", "long-engine", "base-builder", "race-simulation", "recovery"],
  deload: ["recovery", "base-engine", "strength", "long-engine", "base-builder", "mixed", "threshold", "race-simulation"],
  specific: ["race-simulation", "mixed", "threshold", "strength", "long-engine", "base-engine", "base-builder", "recovery"],
  taper: ["recovery", "base-engine", "threshold", "mixed", "strength", "race-simulation", "long-engine", "base-builder"],
};

function equipmentMentions(text: string) {
  const normalized = text.toLocaleLowerCase("cs");
  return (Object.entries(EQUIPMENT_ALIASES) as Array<[EquipmentId, string[]]>)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(alias)))
    .map(([equipment]) => equipment);
}

function requirementOptions(equipment: EquipmentId): EquipmentId[] {
  return equipment === "running" ? ["running", "treadmill"] : [equipment];
}

function requirementKey(requirement: EquipmentRequirement) {
  return [...requirement.anyOf].sort().join("|");
}

export function equipmentRequirementsForTemplate(template: WorkoutTemplate): EquipmentRequirement[] {
  const requirements: EquipmentRequirement[] = [];
  const add = (anyOf: EquipmentId[]) => {
    const requirement = { anyOf: [...new Set(anyOf)] };
    if (!requirement.anyOf.length || requirement.anyOf.every((item) => item === "none")) return;
    const key = requirementKey(requirement);
    if (!requirements.some((item) => requirementKey(item) === key)) requirements.push(requirement);
  };
  const addFromPiece = (piece: string) => {
    const mentions = [...new Set(equipmentMentions(piece))];
    if (!mentions.length) return;
    const alternative = /(^|\s)(nebo|or)(\s|$)/i.test(piece);
    if (alternative && mentions.length > 1) {
      add(mentions.flatMap(requirementOptions));
    } else {
      for (const mention of mentions) add(requirementOptions(mention));
    }
  };

  for (const block of template.blocks) {
    for (const step of block.steps) {
      const exercise = getExerciseForStep(step);
      if (exercise) {
        for (const requirement of exercise.equipment) add(requirement.anyOf);
      } else {
        addFromPiece(`${step.name} ${step.detail}`);
      }
    }
  }

  if (requirements.length === 0) {
    for (const piece of [
      ...template.blocks.map((block) => block.title),
      template.title,
      template.description,
      ...template.tags,
    ]) addFromPiece(piece);
  }

  if (requirements.length === 0) {
    const disciplines = inferTemplateDisciplineIds(template);
    for (const disciplineId of disciplines) {
      if (disciplineId === "run") {
        add(["running", "treadmill"]);
        continue;
      }
      const options = getTrainingDiscipline(disciplineId)?.equipment ?? [];
      if (options.length === 1 && options[0] !== "none") add([options[0]]);
    }
  }

  return requirements;
}

export function equipmentRequirementLabelsForTemplate(template: WorkoutTemplate) {
  return equipmentRequirementsForTemplate(template).map((requirement) => {
    if (requirement.anyOf.length === 2 && requirement.anyOf.includes("running") && requirement.anyOf.includes("treadmill")) {
      return "běh venku / běžecký pás";
    }
    return requirement.anyOf.map((item) => EQUIPMENT_LABELS[item]).join(" / ");
  });
}

export function requiredEquipmentForTemplate(template: WorkoutTemplate): EquipmentId[] {
  return [...new Set(equipmentRequirementsForTemplate(template).flatMap((requirement) => {
    if (requirement.anyOf.length === 1) return requirement.anyOf;
    if (requirement.anyOf.includes("running") && requirement.anyOf.includes("treadmill")) return ["running" as EquipmentId];
    return [];
  }))];
}

export function templateFitsEquipment(template: WorkoutTemplate, equipment: EquipmentId[]) {
  const available = new Set<EquipmentId>(["none", ...equipment]);
  return equipmentRequirementsForTemplate(template).every((requirement) =>
    requirement.anyOf.some((item) => available.has(item)),
  );
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
  phase,
  limit = 5,
}: {
  current: WorkoutTemplate;
  templates: WorkoutTemplate[];
  location: ScheduledTrainingLocation;
  customLocations?: TrainingLocationProfile[];
  phase?: ProgramPhase;
  limit?: number;
}) {
  const currentCategory = current.metadata?.category;
  const currentDifficulty = current.metadata?.difficultyLevel ?? 1;
  const currentProgression = current.metadata?.progressionGroup;

  return templates
    .filter((candidate) => candidate.id !== current.id)
    .filter((candidate) => templateFitsLocation(candidate, location, customLocations))
    .map((candidate) => {
      const candidateCategory = candidate.metadata?.category;
      const categoryPenalty = candidateCategory === currentCategory ? 0 : 30;
      const progressionPenalty = currentProgression && candidate.metadata?.progressionGroup === currentProgression ? 0 : 12;
      const phaseOrder = phase ? PHASE_CATEGORY_ORDER[phase] : null;
      const phaseIndex = phaseOrder && candidateCategory ? phaseOrder.indexOf(candidateCategory) : -1;
      const phasePenalty = phase ? (phaseIndex >= 0 ? phaseIndex * 2 : 20) : 0;
      const difficultyPenalty = Math.abs(
        (candidate.metadata?.difficultyLevel ?? 1) - currentDifficulty,
      ) * 5;
      const durationPenalty = Math.abs(candidate.durationMinutes - current.durationMinutes) / 5;
      return {
        template: candidate,
        score: categoryPenalty + progressionPenalty + phasePenalty + difficultyPenalty + durationPenalty,
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
