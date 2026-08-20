import { getExerciseForStep } from "./exercise-catalog";
import type {
  TeamAssignmentProgress,
  TeamParticipantContribution,
  TeamStepAssignment,
  TeamWorkoutDerivedState,
  TeamWorkoutEvent,
  TeamWorkoutFormat,
  TeamWorkoutParticipant,
  TeamWorkoutSession,
} from "./team-training";
import type { WorkoutTemplate } from "./types";

function parseNumberBeforeUnit(value: string, units: string[]) {
  const normalized = value.toLowerCase().replace(/\s+/g, " ");
  for (const unit of units) {
    const match = normalized.match(new RegExp(`(?:^|\\s)(\\d{1,5})(?:\\s*)${unit}(?:\\s|$)`));
    if (match) return Number(match[1]);
  }
  return undefined;
}

function targetForStep(name: string, detail: string) {
  const text = `${name} ${detail}`;
  const distanceMeters = parseNumberBeforeUnit(text, ["m", "metr(?:ů|u|y)?", "meters?"]);
  const reps = parseNumberBeforeUnit(text, ["x", "rep(?:s)?", "opakování", "opakovani"]);
  const leadingCount = Number(name.match(/^\s*(\d{1,4})\b/)?.[1] ?? detail.match(/^\s*(\d{1,4})\b/)?.[1] ?? 0) || undefined;
  return { distanceMeters, reps, leadingCount };
}

export function createJoinCode(random = Math.random) {
  return `ENG-${Math.floor(1000 + random() * 9000)}`;
}

export function createParticipantId() {
  return `athlete-${crypto.randomUUID()}`;
}

export function buildTeamAssignments({
  template,
  participants,
  format,
}: {
  template: WorkoutTemplate;
  participants: TeamWorkoutParticipant[];
  format: TeamWorkoutFormat;
}): TeamStepAssignment[] {
  const participantIds = participants.map((participant) => participant.id);
  let sequence = 0;
  const assignments: TeamStepAssignment[] = [];

  for (const block of template.blocks) {
    for (const step of block.steps) {
      const exercise = getExerciseForStep(step);
      const supported = exercise?.team.modes ?? ["solo"];
      const target = targetForStep(step.name, step.detail);
      const sharedRepTarget = target.reps ?? target.leadingCount;
      let mode: TeamStepAssignment["mode"] = "simultaneous";
      let assignedIds = participantIds;
      let activeParticipantId: string | undefined;

      if (format === "relay") {
        mode = "relay";
        assignedIds = participantIds.length > 0 ? [participantIds[sequence % participantIds.length]] : [];
        activeParticipantId = assignedIds[0];
      } else if (format === "doubles") {
        if (supported.includes("shared-distance") && target.distanceMeters) mode = "shared-distance";
        else if (supported.includes("shared-reps") && sharedRepTarget) mode = "shared-reps";
        else if (supported.includes("you-go-i-go")) mode = "you-go-i-go";
        else if (supported.includes("simultaneous")) mode = "simultaneous";
        else mode = "solo";
        if (mode === "you-go-i-go" || exercise?.team.requiresSingleStation) activeParticipantId = participantIds[0];
      } else {
        mode = supported.includes("simultaneous") ? "simultaneous" : "solo";
      }

      assignments.push({
        id: `${block.id}:${step.id}:${sequence}`,
        sequence,
        blockId: block.id,
        blockTitle: block.title,
        stepId: step.id,
        stepName: step.name,
        stepDetail: step.detail,
        exerciseId: exercise?.id ?? step.exerciseId,
        mode,
        participantIds: assignedIds,
        activeParticipantId,
        targetReps: mode === "shared-reps" ? sharedRepTarget : undefined,
        targetDistanceMeters: mode === "shared-distance" ? target.distanceMeters : undefined,
      });
      sequence += 1;
    }
  }

  return assignments;
}

function emptyContribution(participantId: string): TeamParticipantContribution {
  return { participantId, reps: 0, distanceMeters: 0, durationSeconds: 0, completedAssignments: 0 };
}

function emptyProgress(assignment: TeamStepAssignment): TeamAssignmentProgress {
  return {
    assignmentId: assignment.id,
    reps: 0,
    distanceMeters: 0,
    durationSeconds: 0,
    completedByParticipantIds: [],
    teamCompleted: false,
    activeParticipantId: assignment.activeParticipantId,
  };
}

function uniquePush(items: string[], item: string) {
  return items.includes(item) ? items : [...items, item];
}

export function deriveTeamWorkoutState(session: TeamWorkoutSession, events: TeamWorkoutEvent[]): TeamWorkoutDerivedState {
  const readyParticipantIds: string[] = [];
  const assignmentProgress = Object.fromEntries(session.assignments.map((assignment) => [assignment.id, emptyProgress(assignment)]));
  const contributions = Object.fromEntries(session.participants.map((participant) => [participant.id, emptyContribution(participant.id)]));
  const participantFinish: TeamWorkoutDerivedState["participantFinish"] = {};
  let status = session.status;
  let startedAt = session.startedAt;
  let completedAt = session.completedAt;

  for (const event of events) {
    if (!contributions[event.participantId]) contributions[event.participantId] = emptyContribution(event.participantId);
    if (event.type === "participant-ready") {
      const index = readyParticipantIds.indexOf(event.participantId);
      if (event.ready && index < 0) readyParticipantIds.push(event.participantId);
      if (!event.ready && index >= 0) readyParticipantIds.splice(index, 1);
      continue;
    }
    if (event.type === "session-started") {
      status = "running";
      startedAt = startedAt ?? event.at;
      continue;
    }
    if (event.type === "session-paused") { status = "paused"; continue; }
    if (event.type === "session-resumed") { status = "running"; continue; }
    if (event.type === "session-completed") {
      status = "completed";
      completedAt = event.at;
      continue;
    }
    if (event.type === "participant-finished") {
      participantFinish[event.participantId] = { durationSeconds: event.durationSeconds, rpe: event.rpe, at: event.at };
      continue;
    }

    if (!("assignmentId" in event)) continue;
    const progress = assignmentProgress[event.assignmentId];
    if (!progress) continue;
    const contribution = contributions[event.participantId] ?? emptyContribution(event.participantId);

    if (event.type === "step-progress") {
      const reps = Math.max(0, event.repsDelta ?? 0);
      const distance = Math.max(0, event.distanceMetersDelta ?? 0);
      const duration = Math.max(0, event.durationSecondsDelta ?? 0);
      progress.reps += reps;
      progress.distanceMeters += distance;
      progress.durationSeconds += duration;
      contribution.reps += reps;
      contribution.distanceMeters += distance;
      contribution.durationSeconds += duration;
      contributions[event.participantId] = contribution;
    } else if (event.type === "handoff") {
      progress.activeParticipantId = event.nextParticipantId;
    } else if (event.type === "participant-step-completed") {
      progress.completedByParticipantIds = uniquePush(progress.completedByParticipantIds, event.participantId);
      contribution.completedAssignments += 1;
      contributions[event.participantId] = contribution;
    } else if (event.type === "team-step-completed") {
      progress.teamCompleted = true;
    }
  }

  for (const assignment of session.assignments) {
    const progress = assignmentProgress[assignment.id];
    if (!progress || progress.teamCompleted) continue;
    if (assignment.targetReps && progress.reps >= assignment.targetReps) progress.teamCompleted = true;
    if (assignment.targetDistanceMeters && progress.distanceMeters >= assignment.targetDistanceMeters) progress.teamCompleted = true;
    if (assignment.mode === "simultaneous" && assignment.participantIds.length > 0 && assignment.participantIds.every((id) => progress.completedByParticipantIds.includes(id))) {
      progress.teamCompleted = true;
    }
    if ((assignment.mode === "relay" || assignment.mode === "solo") && assignment.participantIds.length > 0 && assignment.participantIds.every((id) => progress.completedByParticipantIds.includes(id))) {
      progress.teamCompleted = true;
    }
    if (assignment.mode === "you-go-i-go" && progress.completedByParticipantIds.length > 0 && !assignment.targetReps && !assignment.targetDistanceMeters) {
      progress.teamCompleted = true;
    }
  }

  const currentAssignmentIndex = session.assignments.findIndex((assignment) => !assignmentProgress[assignment.id]?.teamCompleted);
  const resolvedIndex = currentAssignmentIndex < 0 ? session.assignments.length : currentAssignmentIndex;
  return {
    status,
    currentAssignmentIndex: resolvedIndex,
    currentAssignment: session.assignments[resolvedIndex],
    readyParticipantIds,
    assignmentProgress,
    contributions,
    participantFinish,
    startedAt,
    completedAt,
  };
}

export function canStartTeamSession(session: TeamWorkoutSession, state: TeamWorkoutDerivedState) {
  const joined = session.participants.filter((participant) => participant.status !== "left" && participant.status !== "invited");
  return joined.length >= 2 && joined.every((participant) => state.readyParticipantIds.includes(participant.id));
}

export function canParticipantWork(assignment: TeamStepAssignment, participantId: string, state: TeamWorkoutDerivedState) {
  if (!assignment.participantIds.includes(participantId)) return false;
  const progress = state.assignmentProgress[assignment.id];
  if (!progress || progress.teamCompleted) return false;
  if (progress.activeParticipantId && ["you-go-i-go", "relay", "shared-reps", "shared-distance"].includes(assignment.mode)) {
    return progress.activeParticipantId === participantId;
  }
  return true;
}

export function buildTeamResult(session: TeamWorkoutSession, events: TeamWorkoutEvent[]) {
  const state = deriveTeamWorkoutState(session, events);
  const startMs = state.startedAt ? Date.parse(state.startedAt) : NaN;
  const endMs = state.completedAt ? Date.parse(state.completedAt) : NaN;
  const teamDurationSeconds = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, Math.round((endMs - startMs) / 1000)) : undefined;
  return {
    sessionId: session.id,
    joinCode: session.joinCode,
    format: session.format,
    workoutTitle: session.workoutTemplate.title,
    teamDurationSeconds,
    participants: session.participants.map((participant) => ({
      participantId: participant.id,
      displayName: participant.displayName,
      ...state.contributions[participant.id],
      finish: state.participantFinish[participant.id],
    })),
  };
}
