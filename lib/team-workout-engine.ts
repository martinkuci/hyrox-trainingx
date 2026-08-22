import { getExerciseForStep } from "./exercise-catalog";
import { classifyWorkoutPhase } from "./workout-pacing";
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

function normalizedNumber(value: string) {
  return Number(value.replace(",", "."));
}

function targetForStep(name: string, detail: string) {
  const text = `${name} ${detail}`.toLowerCase().replace(/\s+/g, " ");
  const multipliedMeters = text.match(/(?:^|\s)(\d{1,3})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*m(?:\s|$)/);
  const km = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*km(?:\s|$)/);
  const meters = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*m(?:\s|$)/);
  const explicitReps = text.match(/(?:^|\s)(\d{1,5})\s*(?:x|rep(?:s)?|opakování|opakovani)(?:\s|$)/);
  const distanceMeters = multipliedMeters
    ? Math.round(Number(multipliedMeters[1]) * normalizedNumber(multipliedMeters[2]))
    : km
      ? Math.round(normalizedNumber(km[1]) * 1000)
      : meters
        ? Math.round(normalizedNumber(meters[1]))
        : undefined;
  const reps = explicitReps ? Number(explicitReps[1]) : undefined;
  const leadingCount = distanceMeters ? undefined : Number(name.match(/^\s*(\d{1,4})\b/)?.[1] ?? detail.match(/^\s*(\d{1,4})\b/)?.[1] ?? 0) || undefined;
  return { distanceMeters, reps, leadingCount };
}

function normalizedTeamText(...values: Array<string | undefined>) {
  return values
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isSharedPreparationOrRecovery(
  blockTitle: string,
  stepName: string,
  stepDetail: string,
  category?: string,
) {
  if (["warmup", "mobility", "compensation", "recovery"].includes(category ?? "")) return true;
  const text = normalizedTeamText(blockTitle, stepName, stepDetail);
  return [
    "rozcvi",
    "warmup",
    "warm-up",
    "zklid",
    "cooldown",
    "cool-down",
    "mobilit",
    "recovery",
    "regener",
    "stretch",
    "prota",
  ].some((token) => text.includes(token));
}

export function distanceProgressOptions(targetDistanceMeters?: number, currentDistanceMeters = 0) {
  if (!targetDistanceMeters || targetDistanceMeters <= 0) return [100, 250, 500];
  const remaining = Math.max(0, targetDistanceMeters - Math.max(0, currentDistanceMeters));
  if (remaining === 0) return [];

  const base = targetDistanceMeters <= 50
    ? [5, 10, 25]
    : targetDistanceMeters <= 100
      ? [10, 25, 50]
      : targetDistanceMeters <= 500
        ? [25, 50, 100]
        : targetDistanceMeters <= 1500
          ? [50, 100, 250]
          : [100, 250, 500];

  return [...new Set(base.map((value) => Math.min(value, remaining)).filter((value) => value > 0))]
    .sort((left, right) => left - right);
}

export function createJoinCode(random = Math.random) {
  return `ENG-${Math.floor(1000 + random() * 9000)}`;
}

export function createParticipantId() {
  return `athlete-${crypto.randomUUID()}`;
}

export function requiresStarterClaim(assignment: TeamStepAssignment) {
  return assignment.participantIds.length > 1 && ["you-go-i-go", "shared-reps", "shared-distance"].includes(assignment.mode);
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
      const sharedPreparationOrRecovery = isSharedPreparationOrRecovery(
        block.title,
        step.name,
        step.detail,
        exercise?.category,
      );
      const prescribedDistance = sharedPreparationOrRecovery ? undefined : target.distanceMeters;
      const prescribedReps = sharedPreparationOrRecovery || prescribedDistance ? undefined : target.reps ?? target.leadingCount;
      let mode: TeamStepAssignment["mode"] = "simultaneous";
      let assignedIds = participantIds;
      let activeParticipantId: string | undefined;

      if (sharedPreparationOrRecovery) {
        mode = "simultaneous";
        assignedIds = participantIds;
      } else if (format === "relay") {
        mode = "relay";
        assignedIds = participantIds.length > 0 ? [participantIds[sequence % participantIds.length]] : [];
        activeParticipantId = assignedIds[0];
      } else if (format === "doubles") {
        if (supported.includes("shared-distance") && prescribedDistance) mode = "shared-distance";
        else if (supported.includes("shared-reps") && prescribedReps) mode = "shared-reps";
        else if (supported.includes("you-go-i-go")) mode = "you-go-i-go";
        else if (supported.includes("simultaneous")) mode = "simultaneous";
        else mode = "solo";
        if (exercise?.team.requiresSingleStation && mode === "simultaneous" && participantIds.length > 1) {
          mode = prescribedDistance ? "shared-distance" : prescribedReps ? "shared-reps" : "you-go-i-go";
        }
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
        targetReps: prescribedReps,
        targetDistanceMeters: prescribedDistance,
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

function eventTime(value: string | undefined) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function completionTime(assignment: TeamStepAssignment, events: TeamWorkoutEvent[]) {
  let reps = 0;
  let distance = 0;
  const completedBy = new Set<string>();
  for (const item of events) {
    if (!("assignmentId" in item) || item.assignmentId !== assignment.id) continue;
    if (item.type === "team-step-completed") return item.at;
    if (item.type === "step-progress") {
      reps += Math.max(0, item.repsDelta ?? 0);
      distance += Math.max(0, item.distanceMetersDelta ?? 0);
      if (assignment.targetReps && reps >= assignment.targetReps) return item.at;
      if (assignment.targetDistanceMeters && distance >= assignment.targetDistanceMeters) return item.at;
    }
    if (item.type === "participant-step-completed") {
      completedBy.add(item.participantId);
      if (assignment.mode === "you-go-i-go" && !assignment.targetReps && !assignment.targetDistanceMeters) return item.at;
      if (["simultaneous", "relay", "solo"].includes(assignment.mode) && assignment.participantIds.every((id) => completedBy.has(id))) return item.at;
    }
  }
  return undefined;
}

function participantCompletionEvent(assignment: TeamStepAssignment, participantId: string, events: TeamWorkoutEvent[]) {
  return events.find((item) => item.type === "participant-step-completed" && item.assignmentId === assignment.id && item.participantId === participantId);
}

function contributionKey(assignmentId: string, participantId: string) {
  return `${assignmentId}:${participantId}`;
}

function addDuration(
  contribution: TeamParticipantContribution,
  progress: TeamAssignmentProgress,
  seconds: number,
) {
  const safe = Math.max(0, Math.round(seconds));
  contribution.durationSeconds += safe;
  progress.durationSeconds += safe;
}

function deriveAutomaticContributions(
  session: TeamWorkoutSession,
  events: TeamWorkoutEvent[],
  contributions: Record<string, TeamParticipantContribution>,
  assignmentProgress: Record<string, TeamAssignmentProgress>,
  explicitProgress: Set<string>,
  explicitDuration: Set<string>,
  startedAt: string | undefined,
) {
  const completionTimes = session.assignments.map((assignment) => completionTime(assignment, events));
  const firstWorkIndex = session.assignments.findIndex((assignment) => classifyWorkoutPhase(assignment.blockTitle, assignment.stepName, assignment.stepDetail ?? "") === "work");
  const workoutStartAt = events.find((item) => item.type === "workout-started")?.at;

  session.assignments.forEach((assignment, index) => {
    const phase = classifyWorkoutPhase(assignment.blockTitle, assignment.stepName, assignment.stepDetail ?? "");
    if (phase !== "work") return;
    const progress = assignmentProgress[assignment.id];
    if (!progress) return;

    if (["simultaneous", "relay", "solo"].includes(assignment.mode)) {
      for (const participantId of assignment.participantIds) {
        const completed = participantCompletionEvent(assignment, participantId, events);
        if (!completed) continue;
        const key = contributionKey(assignment.id, participantId);
        const contribution = contributions[participantId] ?? emptyContribution(participantId);
        if (!explicitProgress.has(key)) {
          if (assignment.targetDistanceMeters) contribution.distanceMeters += assignment.targetDistanceMeters;
          if (assignment.targetReps) contribution.reps += assignment.targetReps;
        }
        if ((assignment.mode === "relay" || assignment.mode === "solo") && assignment.targetDistanceMeters) {
          progress.distanceMeters = Math.max(progress.distanceMeters, assignment.targetDistanceMeters);
        }
        if ((assignment.mode === "relay" || assignment.mode === "solo") && assignment.targetReps) {
          progress.reps = Math.max(progress.reps, assignment.targetReps);
        }
        contributions[participantId] = contribution;
      }
    }

    const defaultStartAt = index === 0 ? startedAt : completionTimes[index - 1];
    const startAt = index === firstWorkIndex ? workoutStartAt ?? defaultStartAt : defaultStartAt;
    const startMs = eventTime(startAt);
    const completedAt = completionTimes[index];
    const completedMs = eventTime(completedAt);
    if (startMs === undefined || completedMs === undefined || completedMs < startMs) return;

    if (["simultaneous", "relay", "solo"].includes(assignment.mode)) {
      for (const participantId of assignment.participantIds) {
        const completed = participantCompletionEvent(assignment, participantId, events);
        const completedParticipantMs = eventTime(completed?.at);
        const key = contributionKey(assignment.id, participantId);
        if (completedParticipantMs === undefined || explicitDuration.has(key)) continue;
        const contribution = contributions[participantId] ?? emptyContribution(participantId);
        addDuration(contribution, progress, (completedParticipantMs - startMs) / 1000);
        contributions[participantId] = contribution;
      }
      return;
    }

    let activeParticipantId = assignment.activeParticipantId;
    let cursorMs = startMs;
    const relevant = events
      .filter((item) => "assignmentId" in item && item.assignmentId === assignment.id)
      .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));

    const closeSegment = (participantId: string | undefined, endMs: number) => {
      if (!participantId || endMs < cursorMs) return;
      const key = contributionKey(assignment.id, participantId);
      if (!explicitDuration.has(key)) {
        const contribution = contributions[participantId] ?? emptyContribution(participantId);
        addDuration(contribution, progress, (endMs - cursorMs) / 1000);
        contributions[participantId] = contribution;
      }
      cursorMs = endMs;
    };

    for (const item of relevant) {
      const itemMs = eventTime(item.at);
      if (itemMs === undefined || itemMs < startMs || itemMs > completedMs) continue;
      if (item.type === "step-started" && !activeParticipantId) {
        activeParticipantId = item.participantId;
        cursorMs = Math.max(cursorMs, itemMs);
        continue;
      }
      if (item.type === "handoff" && activeParticipantId) {
        closeSegment(activeParticipantId, itemMs);
        activeParticipantId = item.nextParticipantId;
      }
    }
    closeSegment(activeParticipantId, completedMs);
  });
}

function applyWorkedAssignmentCounts(
  session: TeamWorkoutSession,
  events: TeamWorkoutEvent[],
  contributions: Record<string, TeamParticipantContribution>,
) {
  const assignments = new Map(session.assignments.map((assignment) => [assignment.id, assignment]));
  const worked = new Map<string, Set<string>>(session.participants.map((participant) => [participant.id, new Set<string>()]));

  const mark = (participantId: string, assignmentId: string) => {
    const assignment = assignments.get(assignmentId);
    if (!assignment || classifyWorkoutPhase(assignment.blockTitle, assignment.stepName, assignment.stepDetail ?? "") !== "work") return;
    if (!worked.has(participantId)) worked.set(participantId, new Set<string>());
    worked.get(participantId)?.add(assignmentId);
  };

  for (const item of events) {
    if (!("assignmentId" in item)) continue;
    if (item.type === "step-started") mark(item.participantId, item.assignmentId);
    if (item.type === "participant-step-completed") mark(item.participantId, item.assignmentId);
    if (item.type === "handoff") mark(item.participantId, item.assignmentId);
    if (item.type === "step-progress" && ((item.repsDelta ?? 0) > 0 || (item.distanceMetersDelta ?? 0) > 0 || (item.durationSecondsDelta ?? 0) > 0)) {
      mark(item.participantId, item.assignmentId);
    }
  }

  for (const [participantId, contribution] of Object.entries(contributions)) {
    contribution.completedAssignments = worked.get(participantId)?.size ?? 0;
  }
}

export function deriveTeamWorkoutState(session: TeamWorkoutSession, events: TeamWorkoutEvent[]): TeamWorkoutDerivedState {
  const readyParticipantIds: string[] = [];
  const assignmentProgress = Object.fromEntries(session.assignments.map((assignment) => [assignment.id, emptyProgress(assignment)]));
  const assignmentsById = new Map(session.assignments.map((assignment) => [assignment.id, assignment]));
  const contributions = Object.fromEntries(session.participants.map((participant) => [participant.id, emptyContribution(participant.id)]));
  const participantFinish: TeamWorkoutDerivedState["participantFinish"] = {};
  const explicitProgress = new Set<string>();
  const explicitDuration = new Set<string>();
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

    if (event.type === "step-started") {
      const assignment = assignmentsById.get(event.assignmentId);
      if (assignment && requiresStarterClaim(assignment) && !progress.activeParticipantId) {
        progress.activeParticipantId = event.participantId;
      }
    } else if (event.type === "step-progress") {
      const reps = Math.max(0, event.repsDelta ?? 0);
      const distance = Math.max(0, event.distanceMetersDelta ?? 0);
      const duration = Math.max(0, event.durationSecondsDelta ?? 0);
      progress.reps += reps;
      progress.distanceMeters += distance;
      progress.durationSeconds += duration;
      contribution.reps += reps;
      contribution.distanceMeters += distance;
      contribution.durationSeconds += duration;
      if (reps > 0 || distance > 0) explicitProgress.add(contributionKey(event.assignmentId, event.participantId));
      if (duration > 0) explicitDuration.add(contributionKey(event.assignmentId, event.participantId));
      contributions[event.participantId] = contribution;
    } else if (event.type === "handoff") {
      progress.activeParticipantId = event.nextParticipantId;
    } else if (event.type === "participant-step-completed") {
      progress.completedByParticipantIds = uniquePush(progress.completedByParticipantIds, event.participantId);
      contributions[event.participantId] = contribution;
    } else if (event.type === "team-step-completed") {
      progress.teamCompleted = true;
    }
  }

  deriveAutomaticContributions(session, events, contributions, assignmentProgress, explicitProgress, explicitDuration, startedAt);
  applyWorkedAssignmentCounts(session, events, contributions);

  for (const assignment of session.assignments) {
    const progress = assignmentProgress[assignment.id];
    if (!progress || progress.teamCompleted) continue;
    if (assignment.mode === "shared-reps" && assignment.targetReps && progress.reps >= assignment.targetReps) progress.teamCompleted = true;
    if (assignment.mode === "shared-distance" && assignment.targetDistanceMeters && progress.distanceMeters >= assignment.targetDistanceMeters) progress.teamCompleted = true;
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
  if (requiresStarterClaim(assignment) && !progress.activeParticipantId) return false;
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
      ...(state.contributions[participant.id] ?? emptyContribution(participant.id)),
      displayName: participant.displayName,
      finish: state.participantFinish[participant.id],
    })),
  };
}
