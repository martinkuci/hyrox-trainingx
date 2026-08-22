import { classifyWorkoutPhase } from "./workout-pacing";
import type { TeamWorkoutEvent, TeamWorkoutSession } from "./team-training";

export type TeamParticipantMovementTotal = {
  reps: number;
  distanceMeters: number;
};

function movementKey(assignmentId: string, participantId: string) {
  return `${assignmentId}:${participantId}`;
}

/**
 * Reconstruct movement totals from the authoritative event log.
 *
 * Shared stations are counted from explicit progress events. Simultaneous,
 * solo and relay assignments are prescribed work: once the participant marks
 * the assignment completed, any missing prescribed distance/reps is credited
 * automatically. This keeps results stable even when a runner only records a
 * duration progress event before the completion event.
 */
export function deriveParticipantMovementTotals(
  session: TeamWorkoutSession,
  events: TeamWorkoutEvent[],
): Record<string, TeamParticipantMovementTotal> {
  const totals = Object.fromEntries(
    session.participants.map((participant) => [participant.id, { reps: 0, distanceMeters: 0 }]),
  ) as Record<string, TeamParticipantMovementTotal>;
  const explicit = new Map<string, TeamParticipantMovementTotal>();

  for (const event of events) {
    if (event.type !== "step-progress") continue;
    const assignment = session.assignments.find((item) => item.id === event.assignmentId);
    if (!assignment || classifyWorkoutPhase(assignment.blockTitle, assignment.stepName, assignment.stepDetail ?? "") !== "work") continue;

    if (!totals[event.participantId]) totals[event.participantId] = { reps: 0, distanceMeters: 0 };
    const key = movementKey(event.assignmentId, event.participantId);
    const current = explicit.get(key) ?? { reps: 0, distanceMeters: 0 };
    const reps = Math.max(0, event.repsDelta ?? 0);
    const distanceMeters = Math.max(0, event.distanceMetersDelta ?? 0);
    current.reps += reps;
    current.distanceMeters += distanceMeters;
    totals[event.participantId].reps += reps;
    totals[event.participantId].distanceMeters += distanceMeters;
    explicit.set(key, current);
  }

  for (const assignment of session.assignments) {
    if (classifyWorkoutPhase(assignment.blockTitle, assignment.stepName, assignment.stepDetail ?? "") !== "work") continue;
    if (!["simultaneous", "solo", "relay"].includes(assignment.mode)) continue;

    for (const participantId of assignment.participantIds) {
      const completed = events.some((event) =>
        event.type === "participant-step-completed"
        && event.assignmentId === assignment.id
        && event.participantId === participantId,
      );
      if (!completed) continue;

      if (!totals[participantId]) totals[participantId] = { reps: 0, distanceMeters: 0 };
      const recorded = explicit.get(movementKey(assignment.id, participantId)) ?? { reps: 0, distanceMeters: 0 };
      if (assignment.targetDistanceMeters) {
        totals[participantId].distanceMeters += Math.max(0, assignment.targetDistanceMeters - recorded.distanceMeters);
      }
      if (assignment.targetReps) {
        totals[participantId].reps += Math.max(0, assignment.targetReps - recorded.reps);
      }
    }
  }

  return totals;
}
