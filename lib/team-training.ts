import type { TeamWorkMode } from "./exercise-library";

export type TeamWorkoutSessionStatus = "lobby" | "ready" | "running" | "paused" | "completed" | "cancelled";
export type TeamParticipantStatus = "invited" | "joined" | "ready" | "active" | "finished" | "left";
export type TeamParticipantRole = "host" | "athlete";

export type TeamWorkoutParticipant = {
  id: string;
  displayName: string;
  role: TeamParticipantRole;
  status: TeamParticipantStatus;
  deviceId?: string;
  joinedAt?: string;
};

export type TeamStepAssignment = {
  blockId: string;
  stepId: string;
  exerciseId?: string;
  mode: TeamWorkMode;
  participantIds: string[];
  targetReps?: number;
  targetDistanceMeters?: number;
};

export type TeamWorkoutSession = {
  id: string;
  joinCode: string;
  workoutTemplateId: string;
  hostUserId: string;
  status: TeamWorkoutSessionStatus;
  participantLimit: number;
  participants: TeamWorkoutParticipant[];
  assignments: TeamStepAssignment[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

export type TeamWorkoutEvent =
  | { id: string; type: "participant-ready"; participantId: string; at: string }
  | { id: string; type: "session-started"; participantId: string; at: string }
  | { id: string; type: "session-paused"; participantId: string; at: string }
  | { id: string; type: "session-resumed"; participantId: string; at: string }
  | { id: string; type: "step-progress"; participantId: string; blockId: string; stepId: string; at: string; reps?: number; distanceMeters?: number; durationSeconds?: number }
  | { id: string; type: "handoff"; participantId: string; nextParticipantId: string; blockId: string; stepId: string; at: string }
  | { id: string; type: "step-completed"; participantId: string; blockId: string; stepId: string; at: string }
  | { id: string; type: "session-completed"; participantId: string; at: string };

export type TeamWorkoutSnapshot = {
  session: TeamWorkoutSession;
  events: TeamWorkoutEvent[];
  revision: number;
};

/**
 * Realtime transport is intentionally not implemented in PWA 3B.1.
 * Firebase or another realtime backend can later synchronize this snapshot
 * while each device keeps its own local runner/checkpoint and personal metrics.
 */
export interface TeamWorkoutTransport {
  createSession(session: TeamWorkoutSession): Promise<void>;
  joinSession(joinCode: string, participant: TeamWorkoutParticipant): Promise<TeamWorkoutSnapshot>;
  publishEvent(sessionId: string, event: TeamWorkoutEvent): Promise<void>;
  subscribe(sessionId: string, onSnapshot: (snapshot: TeamWorkoutSnapshot) => void): () => void;
}
