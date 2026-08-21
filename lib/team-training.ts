import type { TeamWorkMode } from "./exercise-library";
import type { WorkoutTemplate } from "./types";

export type TeamWorkoutFormat = "shared" | "doubles" | "relay";
export type TeamWorkoutSessionStatus = "lobby" | "ready" | "running" | "paused" | "completed" | "cancelled";
export type TeamParticipantStatus = "invited" | "joined" | "ready" | "active" | "finished" | "left";
export type TeamParticipantRole = "host" | "athlete";
export type TeamPacingSource = "auto" | "custom" | "history";

export type TeamWorkoutParticipant = {
  id: string;
  userId?: string;
  email?: string;
  displayName: string;
  role: TeamParticipantRole;
  status: TeamParticipantStatus;
  deviceId?: string;
  joinedAt?: string;
};

export type TeamStepAssignment = {
  id: string;
  sequence: number;
  blockId: string;
  blockTitle: string;
  stepId: string;
  stepName: string;
  stepDetail?: string;
  exerciseId?: string;
  mode: TeamWorkMode;
  participantIds: string[];
  activeParticipantId?: string;
  targetReps?: number;
  targetDistanceMeters?: number;
};

export type TeamWorkoutSession = {
  version: 1;
  id: string;
  joinCode: string;
  workoutTemplateId: string;
  workoutTemplate: WorkoutTemplate;
  format: TeamWorkoutFormat;
  hostUserId: string;
  status: TeamWorkoutSessionStatus;
  participantLimit: number;
  participants: TeamWorkoutParticipant[];
  assignments: TeamStepAssignment[];
  createdAt: string;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  pacingTargetSeconds?: number;
  pacingSource?: TeamPacingSource;
};

export type TeamWorkoutSessionPatch = Partial<Pick<TeamWorkoutSession,
  "format" | "status" | "participantLimit" | "assignments" | "scheduledFor" | "startedAt" | "completedAt" | "pacingTargetSeconds" | "pacingSource"
>>;

export type TeamWorkoutEvent =
  | { id: string; type: "participant-joined"; participantId: string; at: string }
  | { id: string; type: "participant-ready"; participantId: string; ready: boolean; at: string }
  | { id: string; type: "session-started"; participantId: string; at: string }
  | { id: string; type: "session-paused"; participantId: string; at: string }
  | { id: string; type: "session-resumed"; participantId: string; at: string }
  | { id: string; type: "workout-ready"; participantId: string; ready: boolean; at: string }
  | { id: string; type: "workout-started"; participantId: string; at: string }
  | { id: string; type: "step-started"; participantId: string; assignmentId: string; at: string }
  | { id: string; type: "step-progress"; participantId: string; assignmentId: string; at: string; repsDelta?: number; distanceMetersDelta?: number; durationSecondsDelta?: number }
  | { id: string; type: "handoff"; participantId: string; nextParticipantId: string; assignmentId: string; at: string }
  | { id: string; type: "participant-step-completed"; participantId: string; assignmentId: string; at: string }
  | { id: string; type: "team-step-completed"; participantId: string; assignmentId: string; at: string }
  | { id: string; type: "participant-finished"; participantId: string; durationSeconds: number; rpe?: number; at: string }
  | { id: string; type: "session-completed"; participantId: string; at: string };

export type TeamWorkoutSnapshot = {
  session: TeamWorkoutSession;
  events: TeamWorkoutEvent[];
  revision: number;
  updateTime?: string;
};

export type TeamParticipantContribution = {
  participantId: string;
  reps: number;
  distanceMeters: number;
  durationSeconds: number;
  completedAssignments: number;
};

export type TeamAssignmentProgress = {
  assignmentId: string;
  reps: number;
  distanceMeters: number;
  durationSeconds: number;
  completedByParticipantIds: string[];
  teamCompleted: boolean;
  activeParticipantId?: string;
};

export type TeamWorkoutDerivedState = {
  status: TeamWorkoutSessionStatus;
  currentAssignmentIndex: number;
  currentAssignment?: TeamStepAssignment;
  readyParticipantIds: string[];
  assignmentProgress: Record<string, TeamAssignmentProgress>;
  contributions: Record<string, TeamParticipantContribution>;
  participantFinish: Record<string, { durationSeconds: number; rpe?: number; at: string }>;
  startedAt?: string;
  completedAt?: string;
};

export interface TeamWorkoutTransport {
  createSession(session: TeamWorkoutSession): Promise<TeamWorkoutSnapshot>;
  getSession(joinCode: string): Promise<TeamWorkoutSnapshot | null>;
  joinSession(joinCode: string, participant: TeamWorkoutParticipant): Promise<TeamWorkoutSnapshot>;
  updateSession(sessionId: string, patch: TeamWorkoutSessionPatch): Promise<TeamWorkoutSnapshot>;
  publishEvent(sessionId: string, event: TeamWorkoutEvent): Promise<TeamWorkoutSnapshot>;
  subscribe(sessionId: string, onSnapshot: (snapshot: TeamWorkoutSnapshot) => void, onError?: (error: Error) => void): () => void;
}
