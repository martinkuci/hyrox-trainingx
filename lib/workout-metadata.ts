import type { WorkoutCategory, WorkoutMetadata } from "./types";

export const WORKOUT_CATEGORIES: { value: WorkoutCategory; label: string }[] = [
  { value: "base-engine", label: "Base Engine" },
  { value: "base-builder", label: "Base Builder" },
  { value: "strength", label: "Strength" },
  { value: "threshold", label: "Threshold" },
  { value: "race-simulation", label: "Race Simulation" },
  { value: "long-engine", label: "Long Engine" },
  { value: "recovery", label: "Recovery" },
  { value: "mixed", label: "Mixed" },
];

export function categoryLabel(category