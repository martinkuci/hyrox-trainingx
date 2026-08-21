import type { TeamStepAssignment, TeamWorkoutEvent, TeamWorkoutFormat } from "./team-training";
import {
  classifyWorkoutPhase,
  normalizedWorkoutText,
  recommendedWorkoutTargetSeconds,
  type WorkoutPacingPhase,
} from "./workout-pacing";
import type { WorkoutTemplate } from "./types";

export type TeamWorkoutPhase = WorkoutPacingPhase;
export const classifyTeamWorkoutPhase = classifyWorkoutPhase;
export { recommendedWorkoutTargetSeconds } from "./workout-pacing";

export type TeamPacingEntry = {
  assignmentId: string;
  targetSeconds?: number;
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

export function phaseForAssignment(assignment: TeamStepAssignment) {
  return classifyWorkoutPhase(assignment.blockTitle, assignment.stepName, assignment.stepDetail ?? "");
}

function assignmentWeight(assignment: TeamStepAssignment) {
  const text = normalized(assignment.exerciseId, assignment.stepName, assignment.stepDetail);
  if (phaseForAssignment(assignment) !== "work") return 0;
  if (assignment.targetDistanceMeters) {
    if (text.includes("run") || text.includes("beh")) return Math.max(45, assignment.targetDistanceMeters * 0.30);
    if (text.includes("ski") || text.includes("row") || text.includes("vesl")) return Math.max(40, assignment.targetDistanceMeters * 0.24);
    if (text.includes("burpee") || text.includes("broad jump")) return Math.max(45, assignment.targetDistanceMeters * 3.2);
    if (text.includes("carry") || text.includes("lunge") || text.includes("vypad")) return Math.max(40, assignment.targetDistanceMeters * 1.8);
    return Math.max(45, assignment.targetDistanceMeters * 0.8);
  }
  if (assignment.targetReps) {
    if (text.includes("burpee")) return Math.max(40, assignment.targetReps * 4);
    if (text.includes("wall-ball") || text.includes("wall ball")) return Math.max(35, assignment.targetReps * 2.2);
    if (text.includes("lunge") || text.includes("vypad")) return Math.max(35, assignment.targetReps * 2.1);
    return Math.max(35, assignment.targetReps * 2.5);
  }
  return 75;
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
  const totalWeight = workAssignments.reduce((sum, assignment) => sum + assignmentWeight(assignment), 0) || 1;
  const entries: Record<string, TeamPacingEntry> = {};

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

    const targetSeconds = Math.max(15, Math.round((assignmentWeight(assignment) / totalWeight) * targetWorkoutSeconds));
    const text = normalized(assignment.exerciseId, assignment.stepName);
    let cue = `Orientační cíl úseku ${Math.floor(targetSeconds / 60)}:${String(targetSeconds % 60).padStart(2, "0")}.`;
    if ((text.includes("run") || text.includes("beh")) && runningTarget) cue += ` ${runningTarget}`;
    else if (text.includes("ski") || text.includes("row") || text.includes("vesl")) cue += " Drž rovnoměrné /500 m a nepřepal první záběry.";
    else cue += " Drž tempo, které zvládneš zopakovat bez výrazného propadu techniky.";

    const splitSuggestion = format === "doubles" ? suggestedTeamSplit(assignment, participantCount) : undefined;
    entries[assignment.id] = { assignmentId: assignment.id, targetSeconds, cue, splitSuggestion };
  }

  return entries;
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

export function workoutPacingSummary(template: WorkoutTemplate, format: TeamWorkoutFormat, participantCount: number) {
  const targetSeconds = recommendedWorkoutTargetSeconds(template);
  const targetMinutes = Math.round(targetSeconds / 60);
  const running = template.metadata?.runningTarget;
  const formatCue = format === "doubles"
    ? `Enginn navrhne výchozí dělení vzdáleností a opakování mezi ${Math.max(2, participantCount)} sportovce.`
    : format === "relay"
      ? "Pacing se rozdělí podle pořadí štafety a cílového času úseků."
      : "Každý drží vlastní tempo, ale tým vidí společný průběh.";
  return {
    targetSeconds,
    title: `Orientační workout cíl: ${targetMinutes} min`,
    running,
    formatCue,
  };
}