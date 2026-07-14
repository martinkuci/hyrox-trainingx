export type WorkoutStep = {
  id: string;
  name: string;
  detail: string;
};

export type ManualWorkoutBlock = {
  id: string;
  type: "manual";
  title: string;
  repeat: number;
  steps: WorkoutStep[];
};

export type EmomWorkoutBlock = {
  id: string;
  type: "emom";
  title: string;
  minutes: number;
  steps: WorkoutStep[];
};

export type WorkoutBlock = ManualWorkoutBlock | EmomWorkoutBlock;

export type WorkoutTemplate = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  blocks: WorkoutBlock[];
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
};

export type StepSplit = {
  blockId: string;
  stepId: string;
  round: number;
  durationSeconds: number;
};

export type WorkoutResult = {
  id: string;
  templateId: string;
  workoutTitle: string;
  scheduledWorkoutId?: string;
  completedAt: string;
  durationSeconds: number;
  rpe: number;
  weights: string;
  notes: string;
  splits: StepSplit[];
};

export type HyroxData = {
  version: 1;
  templates: WorkoutTemplate[];
  scheduledWorkouts: ScheduledWorkout[];
  results: WorkoutResult[];
};

export type NewWorkoutTemplate = Omit<
  WorkoutTemplate,
  "id" | "createdAt" | "updatedAt"
>;

export type NewScheduledWorkout = Omit<ScheduledWorkout, "id">;
export type NewWorkoutResult = Omit<WorkoutResult, "id">;

