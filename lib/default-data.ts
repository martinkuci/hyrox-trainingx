import type { HyroxData, WorkoutTemplate } from "./types";

const seedTimestamp = "2026-07-14T00:00:00.000Z";

export const HYROX_02_TEMPLATE: WorkoutTemplate = {
  id: "hyrox-02",
  title: "HYROX 02",
  description: "Běh + stanoviště",
  durationMinutes: 45,
  tags: ["běh", "stanoviště", "kondice"],
  createdAt: seedTimestamp,
  updatedAt: seedTimestamp,
  blocks: [
    {
      id: "hyrox-02-warmup",
      type: "manual",
      title: "Warm-up",
      repeat: 1,
      steps: [
        { id: "warmup-run-row", name: "5 min lehký běh nebo veslo", detail: "Klidné tempo" },
        { id: "warmup-mobility", name: "2 kola rozcvičení", detail: "Squat · lunge · push-up · plank" },
      ],
    },
    {
      id: "hyrox-02-main",
      type: "manual",
      title: "3 kola For Time",
      repeat: 3,
      steps: [
        { id: "run-600", name: "600 m běh", detail: "Tempo přibližně 75–80 %" },
        { id: "burpee-broad-jumps", name: "10 burpee broad jumps", detail: "Plynule a kontrolovaně" },
        { id: "walking-lunges", name: "16 walking lunges", detail: "8 na každou nohu" },
        { id: "wall-balls", name: "12 wall balls", detail: "Zvol udržitelnou váhu" },
        { id: "row-250", name: "250 m veslo", detail: "Silné a rovnoměrné tempo" },
      ],
    },
    {
      id: "hyrox-02-emom",
      type: "emom",
      title: "EMOM 6",
      minutes: 6,
      steps: [
        { id: "kb-swings", name: "12 kettlebell swings", detail: "Liché minuty" },
        { id: "box-step-overs", name: "10 box step-overs", detail: "Sudé minuty" },
      ],
    },
    {
      id: "hyrox-02-cooldown",
      type: "manual",
      title: "Cooldown",
      repeat: 1,
      steps: [
        { id: "cooldown-walk-stretch", name: "Vychození a protažení", detail: "3 minuty" },
      ],
    },
  ],
};

export const DEFAULT_HYROX_DATA: HyroxData = {
  version: 1,
  templates: [HYROX_02_TEMPLATE],
  scheduledWorkouts: [],
  results: [],
  weeklyPlans: [],
};

export function createDefaultHyroxData(): HyroxData {
  return JSON.parse(JSON.stringify(DEFAULT_HYROX_DATA)) as HyroxData;
}
