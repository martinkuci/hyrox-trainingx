import type { WorkoutBlock, WorkoutStep } from "./types";

export type WorkoutBlockType = WorkoutBlock["type"];

export const WORKOUT_BLOCK_TYPES: { value: WorkoutBlockType; label: string; description: string }[] = [
  { value: "manual", label: "Manuální", description: "Každý cvik potvrď ručně." },
  { value: "for-time", label: "For Time", description: "Cviky ručně, odpočinek mezi koly automaticky." },
  { value: "interval", label: "Interval", description: "Automaticky střídej čas práce a odpočinku." },
  { value: "tabata", label: "TABATA", description: "Krátké pracovní intervaly s pevnou pauzou." },
  { value: "emom", label: "EMOM", description: "Každou minutu následuje další cvik." },
  { value: "amrap", label: "AMRAP", description: "Opakuj sestavu po celý nastavený čas." },
];

export function workoutBlockTypeLabel(type: WorkoutBlockType) {
  return WORKOUT_BLOCK_TYPES.find((option) => option.value === type)?.label ?? type;
}

export function workoutBlockTypeDescription(type: WorkoutBlockType) {
  return WORKOUT_BLOCK_TYPES.find((option) => option.value === type)?.description ?? "";
}

export function createWorkoutBlock(type: WorkoutBlockType, id: string, step: WorkoutStep): WorkoutBlock {
  const common = { id, title: workoutBlockTypeLabel(type), steps: [step] };
  switch (type) {
    case "manual": return { ...common, type, title: "Nový blok", repeat: 1 };
    case "for-time": return { ...common, type, rounds: 3, restSeconds: 60 };
    case "interval": return { ...common, type, rounds: 6, workSeconds: 60, restSeconds: 30 };
    case "tabata": return { ...common, type, rounds: 8, workSeconds: 20, restSeconds: 10 };
    case "emom": return { ...common, type, minutes: 6 };
    case "amrap": return { ...common, type, minutes: 12 };
  }
}

export function convertWorkoutBlock(block: WorkoutBlock, type: WorkoutBlockType): WorkoutBlock {
  if (block.type === type) return block;
  const common = { id: block.id, title: block.title, steps: block.steps };
  const rounds = "rounds" in block ? block.rounds : block.type === "manual" ? block.repeat : 3;
  const minutes = "minutes" in block ? block.minutes : 6;
  const restSeconds = "restSeconds" in block ? block.restSeconds : type === "tabata" ? 10 : 30;
  const workSeconds = "workSeconds" in block ? block.workSeconds : type === "tabata" ? 20 : 60;

  switch (type) {
    case "manual": return { ...common, type, repeat: rounds };
    case "for-time": return { ...common, type, rounds, restSeconds };
    case "interval": return { ...common, type, rounds, workSeconds, restSeconds };
    case "tabata": return { ...common, type, rounds, workSeconds, restSeconds };
    case "emom": return { ...common, type, minutes };
    case "amrap": return { ...common, type, minutes };
  }
}
