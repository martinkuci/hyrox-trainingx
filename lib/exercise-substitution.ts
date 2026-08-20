import { exerciseFitsEquipment, findExerciseAlternatives, getExercise, getExerciseForStep } from "./exercise-catalog";
import type { EquipmentId, ScheduledExerciseOverride, WorkoutStep, WorkoutTemplate } from "./types";

export type ExerciseSubstitution = {
  blockId: string;
  stepId: string;
  fromExerciseId: string;
  toExerciseId: string;
  fromName: string;
  toName: string;
};

export function findStepAlternatives(step: WorkoutStep, equipment: EquipmentId[]) {
  const exercise = getExerciseForStep(step);
  if (!exercise) return [];
  return findExerciseAlternatives(exercise.id, equipment);
}

export function stepFitsEquipment(step: WorkoutStep, equipment: EquipmentId[]) {
  const exercise = getExerciseForStep(step);
  return exercise ? exerciseFitsEquipment(exercise, equipment) : true;
}

export function applyExerciseOverrides(
  template: WorkoutTemplate,
  overrides: ScheduledExerciseOverride[] = [],
): WorkoutTemplate {
  if (overrides.length === 0) return template;
  const byStep = new Map(overrides.map((override) => [`${override.blockId}:${override.stepId}`, override]));
  return {
    ...template,
    blocks: template.blocks.map((block) => ({
      ...block,
      steps: block.steps.map((step) => {
        const override = byStep.get(`${block.id}:${step.id}`);
        if (!override) return step;
        const replacement = getExercise(override.exerciseId);
        return replacement
          ? { ...step, exerciseId: replacement.id, name: replacement.name }
          : step;
      }),
    })),
  };
}

export function substitutionsToOverrides(substitutions: ExerciseSubstitution[]): ScheduledExerciseOverride[] {
  return substitutions.map((substitution) => ({
    blockId: substitution.blockId,
    stepId: substitution.stepId,
    exerciseId: substitution.toExerciseId,
  }));
}

export function substituteTemplateExercisesForEquipment(
  template: WorkoutTemplate,
  equipment: EquipmentId[],
): { template: WorkoutTemplate; substitutions: ExerciseSubstitution[]; unresolvedStepIds: string[] } {
  const substitutions: ExerciseSubstitution[] = [];
  const unresolvedStepIds: string[] = [];

  const blocks = template.blocks.map((block) => ({
    ...block,
    steps: block.steps.map((step) => {
      const source = getExerciseForStep(step);
      if (!source || exerciseFitsEquipment(source, equipment)) return step;

      const replacement = findExerciseAlternatives(source.id, equipment)[0];
      if (!replacement) {
        unresolvedStepIds.push(step.id);
        return step;
      }

      substitutions.push({
        blockId: block.id,
        stepId: step.id,
        fromExerciseId: source.id,
        toExerciseId: replacement.id,
        fromName: step.name,
        toName: replacement.name,
      });

      return {
        ...step,
        exerciseId: replacement.id,
        name: replacement.name,
      };
    }),
  }));

  return {
    template: { ...template, blocks },
    substitutions,
    unresolvedStepIds,
  };
}
