import { getExerciseForStep } from "./exercise-catalog";
import type { TeamStepAssignment, TeamWorkoutFormat, TeamWorkoutParticipant } from "./team-training";
import type { WorkoutBlock, WorkoutStep, WorkoutTemplate } from "./types";

function normalizedNumber(value: string) {
  return Number(value.replace(",", "."));
}

function normalizedText(...values: Array<string | undefined>) {
  return values
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function targetForStep(name: string, detail: string) {
  const text = `${name} ${detail}`.toLowerCase().replace(/\s+/g, " ");
  const multipliedMeters = text.match(/(?:^|\s)(\d{1,3})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*m(?:\s|$)/);
  const km = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*km(?:\s|$)/);
  const meters = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*m(?:\s|$)/);
  const explicitReps = text.match(/(?:^|\s)(\d{1,5})\s*(?:x|rep(?:s)?|opakování|opakovani)(?:\s|$)/);
  const timedPrescription = /(?:^|\s)\d+(?:[.,]\d+)?\s*(?:min(?:\.|ut(?:y|a)?)?|sek(?:\.|und(?:y|a)?)?|s)(?:\s|$)/i.test(text);
  const distanceMeters = multipliedMeters
    ? Math.round(Number(multipliedMeters[1]) * normalizedNumber(multipliedMeters[2]))
    : km
      ? Math.round(normalizedNumber(km[1]) * 1000)
      : meters
        ? Math.round(normalizedNumber(meters[1]))
        : undefined;
  const reps = explicitReps ? Number(explicitReps[1]) : undefined;
  const leadingCount = distanceMeters || reps || timedPrescription
    ? undefined
    : Number(name.match(/^\s*(\d{1,4})\b/)?.[1] ?? detail.match(/^\s*(\d{1,4})\b/)?.[1] ?? 0) || undefined;
  return { distanceMeters, reps, leadingCount };
}

function isSharedPreparationOrRecovery(
  blockTitle: string,
  stepName: string,
  stepDetail: string,
  category?: string,
) {
  if (["warmup", "mobility", "compensation", "recovery"].includes(category ?? "")) return true;
  const text = normalizedText(blockTitle, stepName, stepDetail);
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

function blockOccurrences(block: WorkoutBlock): Array<{ step: WorkoutStep; round: number; totalRounds: number }> {
  if (!block.steps.length) return [];
  if (block.type === "manual") {
    const totalRounds = Math.max(1, block.repeat);
    return Array.from({ length: totalRounds }, (_, roundIndex) =>
      block.steps.map((step) => ({ step, round: roundIndex + 1, totalRounds })),
    ).flat();
  }
  if (block.type === "for-time") {
    const totalRounds = Math.max(1, block.rounds);
    return Array.from({ length: totalRounds }, (_, roundIndex) =>
      block.steps.map((step) => ({ step, round: roundIndex + 1, totalRounds })),
    ).flat();
  }
  if (block.type === "interval" || block.type === "tabata") {
    const totalRounds = Math.max(1, block.rounds);
    return Array.from({ length: totalRounds }, (_, roundIndex) => ({
      step: block.steps[roundIndex % block.steps.length],
      round: roundIndex + 1,
      totalRounds,
    }));
  }
  if (block.type === "emom") {
    const totalRounds = Math.max(1, block.minutes);
    return Array.from({ length: totalRounds }, (_, roundIndex) => ({
      step: block.steps[roundIndex % block.steps.length],
      round: roundIndex + 1,
      totalRounds,
    }));
  }
  return block.steps.map((step) => ({ step, round: 1, totalRounds: 1 }));
}

export function buildStructuredTeamAssignments({
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
    const occurrences = blockOccurrences(block);
    for (const occurrence of occurrences) {
      const step = occurrence.step;
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
        id: `${block.id}:${step.id}:r${occurrence.round}:${sequence}`,
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
        round: occurrence.round,
        totalRounds: occurrence.totalRounds,
      });
      sequence += 1;
    }
  }

  return assignments;
}
