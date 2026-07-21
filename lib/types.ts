export type WorkoutStep = { id: string; name: string; detail: string };
export type ManualWorkoutBlock = { id: string; type: "manual"; title: string; repeat: number; steps: WorkoutStep[] };
export type EmomWorkoutBlock = { id: string; type: "emom"; title: string; minutes: number; steps: WorkoutStep[] };
export type WorkoutBlock = ManualWorkoutBlock | EmomWorkoutBlock;

export type WorkoutCategory =
  | "base-engine"
  | "base-builder"
  | "strength"
  | "threshold"
  | "race-simulation"
  | "long-engine"
  | "recovery"
  | "mixed";

export type WorkoutMetadata = {
  workoutCode: string;
  templateVersion: number;
  category: WorkoutCategory;
  goal: string;
  targetRpeMin: number;
  targetRpeMax: number;
  expectedDurationMin: number;
  expectedDurationMax: number;
  runningTarget: string;
  primaryMetric: string;
  secondaryMetrics: string[];
  progressionGroup: string;
  difficultyLevel: 1 | 2 | 3;
};

export type WorkoutTemplate = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  tags: string[];
  metadata?: WorkoutMetadata;
  blocks: WorkoutBlock[];
  createdAt: string;
  updatedAt: string;
};

export type ProgramPhase = "base" | "build" | "deload" | "specific" | "taper";
export type ProgramSession = {
  id: string;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  time: string;
  templateId: string | null;
  note: string;
};
export type ProgramWeek = {
  weekNumber: number;
  title: string;
  phase: ProgramPhase;
  focus: string;
  sessions: ProgramSession[];
};
export type TrainingProgram = {
  id: string;
  code: string;
  name: string;
  description: string;
  weeks: ProgramWeek[];
  createdAt: string;
  updatedAt: string;
};

export type ScheduledWorkoutStatus = "planned" | "completed" | "skipped";
export type ScheduledWorkout = {
  id: string;
  templateId: string;
  date: string;
  time: string;
  status: ScheduledWorkoutStatus;
  programId?: string;
  programWeek?: number;
  programSessionId?: string;
};
export type WeeklyPlanDay = { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; templateId: string | null; time: string };
export type WeeklyPlanTemplate = { id: string; name: string; days: WeeklyPlanDay[]; createdAt: string; updatedAt: string };
export type StepSplit = { blockId: string; stepId: string; round: number; durationSeconds: number; blockTitle?: string; stepName?: string; stepDetail?: string };
export type WorkoutResultMetrics = {
  averageHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  distanceKm?: number;
  watchDurationSeconds?: number;
};

export type WorkoutResult = {
  id: string;
  templateId: string;
  workoutTitle: string;
  workoutCode?: string;
  templateVersion?: number;
  metadataSnapshot?: WorkoutMetadata;
  scheduledWorkoutId?: string;
  completedAt: string;
  durationSeconds: number;
  rpe: number;
  weights: string;
  notes: string;
  splits: StepSplit[];
  source?: "runner" | "screenshot";
  sourceImageName?: string;
  metrics?: WorkoutResultMetrics;
};
export type HyroxData = {
  version: 1;
  catalogVersion?: number;
  templates: WorkoutTemplate[];
  scheduledWorkouts: ScheduledWorkout[];
  results: WorkoutResult[];
  weeklyPlans: WeeklyPlanTemplate[];
  trainingPrograms: TrainingProgram[];
};
export type NewWorkoutTemplate = Omit<WorkoutTemplate, "id" | "createdAt" | "updatedAt">;
export type NewScheduledWorkout = Omit<ScheduledWorkout, "id">;
export type NewWorkoutResult = Omit<WorkoutResult, "id">;
export type NewWeeklyPlanTemplate = Omit<WeeklyPlanTemplate, "id" | "createdAt" | "updatedAt">;
export type NewTrainingProgram = Omit<TrainingProgram, "id" | "createdAt" | "updatedAt">;