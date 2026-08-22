import type { TeamStepAssignment, TeamWorkoutFormat } from "./team-training";
import { phaseForAssignment, suggestedTeamSplit, type TeamPacingEntry } from "./team-pacing";
import { normalizedWorkoutText, referencePacingSeconds } from "./workout-pacing";

function explicitDurationSeconds(assignment: TeamStepAssignment) {
  const text = normalizedWorkoutText(assignment.stepName, assignment.stepDetail).replace(/,/g, ".");
  const minute = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*min(?:\.|ut(?:y|a)?)?(?:\s|$)/);
  if (minute) return Math.max(1, Math.round(Number(minute[1]) * 60));
  const seconds = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:s|sek(?:\.|und(?:y|a)?)?)(?:\s|$)/);
  return seconds ? Math.max(1, Math.round(Number(seconds[1]))) : undefined;
}

function movementText(assignment: TeamStepAssignment) {
  return normalizedWorkoutText(assignment.exerciseId, assignment.stepName, assignment.stepDetail);
}

function isRun(assignment: TeamStepAssignment) {
  const text = movementText(assignment);
  return text.includes("run") || text.includes("beh") || text.includes("klus");
}

function isErg(assignment: TeamStepAssignment) {
  const text = movementText(assignment);
  return text.includes("ski") || text.includes("row") || text.includes("vesl");
}

function isSled(assignment: TeamStepAssignment) {
  const text = movementText(assignment);
  return text.includes("sled") || text.includes("sane");
}

function isBurpeeBroadJump(assignment: TeamStepAssignment) {
  const text = movementText(assignment);
  return text.includes("burpee") && (text.includes("broad") || text.includes("jump"));
}

function isFarmersCarry(assignment: TeamStepAssignment) {
  const text = movementText(assignment);
  return text.includes("farmer") || text.includes("carry");
}

function isLunge(assignment: TeamStepAssignment) {
  const text = movementText(assignment);
  return text.includes("lunge") || text.includes("vypad");
}

function isWallBall(assignment: TeamStepAssignment) {
  const text = movementText(assignment);
  return text.includes("wall ball") || text.includes("wallball");
}

function splitPace(seconds: number, distanceMeters: number, referenceMeters: number) {
  if (distanceMeters <= 0) return undefined;
  const split = Math.max(1, Math.round(seconds * referenceMeters / distanceMeters));
  return `${Math.floor(split / 60)}:${String(split % 60).padStart(2, "0")} / ${referenceMeters} m`;
}

function paceLabel(assignment: TeamStepAssignment, movementTargetSeconds: number) {
  if (assignment.targetDistanceMeters && isErg(assignment)) {
    return splitPace(movementTargetSeconds, assignment.targetDistanceMeters, 500);
  }
  if (assignment.targetDistanceMeters && isRun(assignment) && assignment.targetDistanceMeters >= 400) {
    const perKm = Math.max(1, Math.round(movementTargetSeconds * 1000 / assignment.targetDistanceMeters));
    return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, "0")} / km`;
  }
  if (assignment.targetDistanceMeters && isSled(assignment)) {
    return splitPace(movementTargetSeconds, assignment.targetDistanceMeters, 12.5);
  }
  if (assignment.targetDistanceMeters && isBurpeeBroadJump(assignment)) {
    return splitPace(movementTargetSeconds, assignment.targetDistanceMeters, 10);
  }
  if (assignment.targetDistanceMeters && isFarmersCarry(assignment)) {
    return splitPace(movementTargetSeconds, assignment.targetDistanceMeters, 100);
  }
  if (assignment.targetDistanceMeters && isLunge(assignment)) {
    return splitPace(movementTargetSeconds, assignment.targetDistanceMeters, 25);
  }
  if (assignment.targetReps && isWallBall(assignment) && movementTargetSeconds > 0) {
    const repsPerMinute = assignment.targetReps * 60 / movementTargetSeconds;
    const rounded = repsPerMinute >= 10 ? Math.round(repsPerMinute) : Math.round(repsPerMinute * 10) / 10;
    return `${rounded} reps / min`;
  }
  return undefined;
}

function clockShort(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function transitionReserveFor(targetSeconds: number, count: number) {
  if (count <= 1) return 0;
  return Math.max(0, Math.min(Math.round(targetSeconds * 0.05), (count - 1) * 20));
}

export function buildStructuredTeamPacingPlan({
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
  const work = assignments.filter((assignment) => phaseForAssignment(assignment) === "work");
  const targetSeconds = Math.max(5 * 60, Math.round(targetWorkoutSeconds));
  const transitionReserve = transitionReserveFor(targetSeconds, work.length);
  const transitionPerGap = work.length > 1 ? transitionReserve / (work.length - 1) : 0;

  let runOrdinal = 0;
  const items = work.map((assignment) => {
    const fixed = explicitDurationSeconds(assignment);
    const weight = fixed ?? referencePacingSeconds({
      name: assignment.stepName,
      detail: assignment.stepDetail,
      exerciseId: assignment.exerciseId,
      distanceMeters: assignment.targetDistanceMeters,
      reps: assignment.targetReps,
      runOrdinal: isRun(assignment) ? runOrdinal : undefined,
    });
    if (isRun(assignment)) runOrdinal += 1;
    return { assignment, fixed, weight };
  });

  const fixedBudget = items.reduce((sum, item) => sum + (item.fixed ?? 0), 0);
  const flexibleWeight = items.reduce((sum, item) => sum + (item.fixed ? 0 : item.weight), 0) || 1;
  const flexibleBudget = Math.max(1, targetSeconds - transitionReserve - fixedBudget);
  const entries: Record<string, TeamPacingEntry> = {};
  let cumulative = 0;
  let workIndex = 0;

  for (const assignment of assignments) {
    const phase = phaseForAssignment(assignment);
    if (phase !== "work") {
      entries[assignment.id] = {
        assignmentId: assignment.id,
        cue: phase === "warmup"
          ? "Warm-up se synchronizuje, ale nepočítá se do workout času."
          : "Cooldown patří do celkového času tréninku, ne do výsledku workoutu.",
      };
      continue;
    }

    const item = items[workIndex];
    const movementTargetSeconds = item?.fixed
      ? item.fixed
      : Math.max(15, Math.round((item?.weight ?? 1) / flexibleWeight * flexibleBudget));
    const transitionSeconds = workIndex === 0 ? 0 : Math.round(transitionPerGap);
    const assignmentTargetSeconds = movementTargetSeconds + transitionSeconds;
    cumulative += assignmentTargetSeconds;
    const label = paceLabel(assignment, movementTargetSeconds);
    const splitSuggestion = format === "doubles" && ["shared-reps", "shared-distance", "you-go-i-go"].includes(assignment.mode)
      ? suggestedTeamSplit(assignment, participantCount)
      : undefined;
    let cue = item?.fixed
      ? `Předepsaná délka ${clockShort(movementTargetSeconds)}.`
      : `Cíl úseku cca ${clockShort(assignmentTargetSeconds)}.`;
    if (label) cue += ` Drž ${label}.`;
    if (transitionSeconds > 0) cue += ` Přechod cca ${clockShort(transitionSeconds)}.`;
    if (isRun(assignment) && runningTarget) cue += ` ${runningTarget}`;

    entries[assignment.id] = {
      assignmentId: assignment.id,
      targetSeconds: assignmentTargetSeconds,
      movementTargetSeconds,
      transitionSeconds,
      cumulativeTargetSeconds: cumulative,
      paceLabel: label,
      cue,
      splitSuggestion,
    };
    workIndex += 1;
  }

  return entries;
}
