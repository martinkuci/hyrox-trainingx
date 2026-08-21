import type { TeamStepAssignment, TeamWorkoutEvent, TeamWorkoutFormat } from "./team-training";
import {
  classifyWorkoutPhase,
  normalizedWorkoutText,
  recommendedWorkoutTargetSeconds,
  referencePacingSeconds,
  type WorkoutPacingPhase,
} from "./workout-pacing";
import type { WorkoutTemplate } from "./types";

export type TeamWorkoutPhase = WorkoutPacingPhase;
export const classifyTeamWorkoutPhase = classifyWorkoutPhase;
export { recommendedWorkoutTargetSeconds } from "./workout-pacing";

export type TeamPacingEntry = {
  assignmentId: string;
  targetSeconds?: number;
  movementTargetSeconds?: number;
  transitionSeconds?: number;
  cumulativeTargetSeconds?: number;
  paceLabel?: string;
  cue: string;
  splitSuggestion?: string;
};

export type TeamWorkoutTiming = {
  sessionSeconds: number;
  warmupSeconds: number;
  workoutSeconds: number;
  cooldownSeconds: number;
  workoutStarted: boolean;
  workoutCompleted: boolean;
};

function normalized(...values: Array<string | undefined>) {
  return normalizedWorkoutText(...values);
}

function clockShort(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function isRunAssignment(assignment: TeamStepAssignment) {
  const text = normalized(assignment.exerciseId, assignment.stepName, assignment.stepDetail);
  return text.includes("run") || text.includes("beh") || text.includes("klus");
}

function isErgAssignment(assignment: TeamStepAssignment) {
  const text = normalized(assignment.exerciseId, assignment.stepName, assignment.stepDetail);
  return text.includes("ski") || text.includes("row") || text.includes("vesl");
}

export function phaseForAssignment(assignment: TeamStepAssignment) {
  return classifyWorkoutPhase(assignment.blockTitle, assignment.stepName, assignment.stepDetail ?? "");
}

function movementWeight(assignment: TeamStepAssignment, runOrdinal: number) {
  return referencePacingSeconds({
    name: assignment.stepName,
    detail: assignment.stepDetail,
    exerciseId: assignment.exerciseId,
    distanceMeters: assignment.targetDistanceMeters,
    reps: assignment.targetReps,
    runOrdinal: isRunAssignment(assignment) ? runOrdinal : undefined,
  });
}

function niceShare(value: number, target: number) {
  const step = target <= 50 ? 5 : target <= 200 ? 10 : target <= 1000 ? 25 : target <= 2000 ? 50 : 100;
  return Math.max(step, Math.round(value / step) * step);
}

export function adaptiveProgressOptions(target: number | undefined, current: number, kind: "distance" | "reps") {
  if (!target || target <= 0) return kind === "distance" ? [100, 250, 500] : [1, 5, 10];
  const remaining = Math.max(0, target - Math.max(0, current));
  if (!remaining) return [];
  const step = kind === "distance"
    ? target <= 50 ? 5 : target <= 200 ? 10 : target <= 1000 ? 25 : target <= 2000 ? 50 : 100
    : target <= 20 ? 1 : target <= 60 ? 5 : 10;
  const fractions = [0.25, 0.5, 0.75];
  const values = fractions.map((fraction) => {
    const raw = target * fraction;
    const rounded = fraction === 0.75 ? Math.floor(raw / step) * step : Math.round(raw / step) * step;
    return Math.max(step, Math.min(remaining, rounded));
  });
  return [...new Set(values)].sort((left, right) => left - right);
}

export function suggestedTeamSplit(assignment: TeamStepAssignment, participantCount: number) {
  const people = Math.max(1, participantCount);
  if (assignment.targetDistanceMeters && people > 1) {
    const share = niceShare(assignment.targetDistanceMeters / people, assignment.targetDistanceMeters);
    return `Výchozí rozdělení: cca ${share} m na osobu. Předávej dřív jen při poklesu tempa.`;
  }
  if (assignment.targetReps && people > 1) {
    const share = Math.max(1, Math.round(assignment.targetReps / people));
    return `Výchozí rozdělení: cca ${share} opakování na osobu. Série můžeš upravit podle únavy.`;
  }
  return undefined;
}

function teamPaceLabel(assignment: TeamStepAssignment, movementTargetSeconds: number) {
  if (assignment.targetDistanceMeters && isErgAssignment(assignment)) {
    const per500 = Math.max(1, Math.round(movementTargetSeconds * 500 / assignment.targetDistanceMeters));
    return `${Math.floor(per500 / 60)}:${String(per500 % 60).padStart(2, "0")} / 500 m`;
  }
  if (assignment.targetDistanceMeters && isRunAssignment(assignment) && assignment.targetDistanceMeters >= 400) {
    const perKm = Math.max(1, Math.round(movementTargetSeconds * 1000 / assignment.targetDistanceMeters));
    return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, "0")} / km`;
  }
  return undefined;
}

function transitionReserveFor(targetSeconds: number, workCount: number) {
  if (workCount <= 1) return 0;
  return Math.max(0, Math.min(Math.round(targetSeconds * 0.055), (workCount - 1) * 25));
}

export function buildTeamPacingPlan({
  assignments,
  targetWorkoutSeconds,
  participantCount,
  runningTarget,
  format,
}: {
  assignments: TeamStepAssignment[];
  targetWorkoutSeconds: number;
  participantCount: number;
  runningTarget?: string;
  format: TeamWorkoutFormat;
}): Record<string, TeamPacingEntry> {
  const workAssignments = assignments.filter((assignment) => phaseForAssignment(assignment) === "work");
  const targetSeconds = Math.max(5 * 60, Math.round(targetWorkoutSeconds));
  const transitionReserve = transitionReserveFor(targetSeconds, workAssignments.length);
  const transitionPerGap = workAssignments.length > 1 ? transitionReserve / (workAssignments.length - 1) : 0;
  let runOrdinal = 0;
  const weighted = workAssignments.map((assignment) => {
    const weight = movementWeight(assignment, runOrdinal);
    if (isRunAssignment(assignment)) runOrdinal += 1;
    return { assignment, weight };
  });
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;
  const movementBudget = Math.max(1, targetSeconds - transitionReserve);
  const entries: Record<string, TeamPacingEntry> = {};
  let cumulative = 0;
  let workIndex = 0;

  for (const assignment of assignments) {
    const phase = phaseForAssignment(assignment);
    if (phase !== "work") {
      entries[assignment.id] = {
        assignmentId: assignment.id,
        cue: phase === "warmup"
          ? "Rozcvičení se synchronizuje, ale nepočítá se do workout času."
          : "Cooldown patří do celkového času tréninku, ne do výsledku workoutu.",
      };
      continue;
    }

    const weightedItem = weighted[workIndex];
    const movementTargetSeconds = Math.max(15, Math.round((weightedItem?.weight ?? 1) / totalWeight * movementBudget));
    const transitionSeconds = workIndex === 0 ? 0 : Math.round(transitionPerGap);
    const assignmentTargetSeconds = movementTargetSeconds + transitionSeconds;
    cumulative += assignmentTargetSeconds;
    const paceLabel = teamPaceLabel(assignment, movementTargetSeconds);
    let cue = `Cíl úseku cca ${clockShort(assignmentTargetSeconds)}.`;
    if (transitionSeconds > 0) cue += ` Z toho cca ${clockShort(transitionSeconds)} je rezerva na přesun/přechod.`;
    if (isRunAssignment(assignment) && runningTarget) cue += ` ${paceLabel ? `Tempo pohybu ${paceLabel}. ` : ""}${runningTarget}`;
    else if (isErgAssignment(assignment)) cue += ` ${paceLabel ? `Tempo pohybu ${paceLabel}. ` : ""}Začni kontrolovaně a drž stejný záběr.`;
    else cue += " Drž tempo, které dokážeš zopakovat bez výrazného propadu techniky.";

    const splitSuggestion = format === "doubles" ? suggestedTeamSplit(assignment, participantCount) : undefined;
    entries[assignment.id] = {
      assignmentId: assignment.id,
      targetSeconds: assignmentTargetSeconds,
      movementTargetSeconds,
      transitionSeconds,
      cumulativeTargetSeconds: cumulative,
      paceLabel,
      cue,
      splitSuggestion,
    };
    workIndex += 1;
  }

  return entries;
}

export function completionTime(assignment: TeamStepAssignment, events: TeamWorkoutEvent[]) {
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

function assignmentStartAt(
  assignments: TeamStepAssignment[],
  events: TeamWorkoutEvent[],
  startedAt: string | undefined,
  currentIndex: number,
) {
  const firstWorkIndex = assignments.findIndex((assignment) => phaseForAssignment(assignment) === "work");
  if (firstWorkIndex < 0 || currentIndex < firstWorkIndex) return undefined;
  if (currentIndex === firstWorkIndex) return firstWorkIndex > 0 ? completionTime(assignments[firstWorkIndex - 1], events) : startedAt;
  return completionTime(assignments[currentIndex - 1], events);
}

export function currentAssignmentElapsedSeconds(
  assignments: TeamStepAssignment[],
  events: TeamWorkoutEvent[],
  startedAt: string | undefined,
  currentAssignmentId: string,
  nowMs: number,
) {
  const currentIndex = assignments.findIndex((assignment) => assignment.id === currentAssignmentId);
  if (currentIndex < 0 || phaseForAssignment(assignments[currentIndex]) !== "work") return undefined;
  const startAt = assignmentStartAt(assignments, events, startedAt, currentIndex);
  if (!startAt) return undefined;
  const startMs = Date.parse(startAt);
  if (!Number.isFinite(startMs)) return undefined;
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

export function pacingDeltaBeforeAssignment(
  assignments: TeamStepAssignment[],
  events: TeamWorkoutEvent[],
  startedAt: string | undefined,
  currentAssignmentId: string,
  plan: Record<string, TeamPacingEntry>,
) {
  if (!startedAt) return undefined;
  const currentIndex = assignments.findIndex((assignment) => assignment.id === currentAssignmentId);
  if (currentIndex < 0 || phaseForAssignment(assignments[currentIndex]) !== "work") return undefined;
  const firstWorkIndex = assignments.findIndex((assignment) => phaseForAssignment(assignment) === "work");
  if (firstWorkIndex < 0 || currentIndex <= firstWorkIndex) return 0;
  const beforeFirstWork = firstWorkIndex > 0 ? completionTime(assignments[firstWorkIndex - 1], events) : startedAt;
  const beforeCurrent = completionTime(assignments[currentIndex - 1], events);
  if (!beforeFirstWork || !beforeCurrent) return undefined;
  const actualBeforeCurrent = Math.max(0, (Date.parse(beforeCurrent) - Date.parse(beforeFirstWork)) / 1000);
  const previousWork = assignments.slice(firstWorkIndex, currentIndex).filter((assignment) => phaseForAssignment(assignment) === "work");
  const targetBeforeCurrent = previousWork.reduce((sum, assignment) => sum + (plan[assignment.id]?.targetSeconds ?? 0), 0);
  return Math.round(actualBeforeCurrent - targetBeforeCurrent);
}

export function deriveTeamWorkoutTiming(
  assignments: TeamStepAssignment[],
  events: TeamWorkoutEvent[],
  startedAt: string | undefined,
  completedAt: string | undefined,
  nowMs: number,
): TeamWorkoutTiming {
  const startMs = startedAt ? Date.parse(startedAt) : NaN;
  if (!Number.isFinite(startMs)) return { sessionSeconds: 0, warmupSeconds: 0, workoutSeconds: 0, cooldownSeconds: 0, workoutStarted: false, workoutCompleted: false };
  const sessionEndMs = completedAt ? Date.parse(completedAt) : nowMs;
  const workIndexes = assignments.map((assignment, index) => phaseForAssignment(assignment) === "work" ? index : -1).filter((index) => index >= 0);
  if (!workIndexes.length) {
    const sessionSeconds = Math.max(0, Math.floor((sessionEndMs - startMs) / 1000));
    return { sessionSeconds, warmupSeconds: sessionSeconds, workoutSeconds: 0, cooldownSeconds: 0, workoutStarted: false, workoutCompleted: false };
  }

  const firstWorkIndex = workIndexes[0];
  const lastWorkIndex = workIndexes[workIndexes.length - 1];
  const preceding = firstWorkIndex > 0 ? completionTime(assignments[firstWorkIndex - 1], events) : startedAt;
  const workoutStartMs = preceding ? Date.parse(preceding) : NaN;
  const lastWorkCompletedAt = completionTime(assignments[lastWorkIndex], events);
  const workoutEndMs = lastWorkCompletedAt ? Date.parse(lastWorkCompletedAt) : nowMs;
  const workoutStarted = Number.isFinite(workoutStartMs) && nowMs >= workoutStartMs;
  const workoutCompleted = Boolean(lastWorkCompletedAt);
  const sessionSeconds = Math.max(0, Math.floor((sessionEndMs - startMs) / 1000));
  const warmupSeconds = workoutStarted ? Math.max(0, Math.floor((workoutStartMs - startMs) / 1000)) : sessionSeconds;
  const workoutSeconds = workoutStarted ? Math.max(0, Math.floor((Math.min(workoutEndMs, sessionEndMs) - workoutStartMs) / 1000)) : 0;
  const cooldownSeconds = workoutCompleted ? Math.max(0, sessionSeconds - warmupSeconds - workoutSeconds) : 0;
  return { sessionSeconds, warmupSeconds, workoutSeconds, cooldownSeconds, workoutStarted, workoutCompleted };
}

export function workoutPacingSummary(
  template: WorkoutTemplate,
  format: TeamWorkoutFormat,
  participantCount: number,
  targetOverrideSeconds?: number,
) {
  const targetSeconds = Math.max(5 * 60, Math.round(targetOverrideSeconds ?? recommendedWorkoutTargetSeconds(template)));
  const targetMinutes = Math.round(targetSeconds / 60);
  const running = template.metadata?.runningTarget;
  const formatCue = format === "doubles"
    ? `Enginn navrhne výchozí dělení vzdáleností a opakování mezi ${Math.max(2, participantCount)} sportovce.`
    : format === "relay"
      ? "Pacing se rozdělí podle pořadí štafety a cílového času úseků."
      : "Každý drží vlastní tempo, ale tým vidí společný průběh.";
  return {
    targetSeconds,
    title: `Cíl měřené části: ${targetMinutes} min`,
    running,
    formatCue,
  };
}
