import { exerciseFitsEquipment, findExerciseAlternatives, getExercise } from "./exercise-library";
import type { EquipmentId, WorkoutStep, WorkoutTemplate } from "./types";

export type ExerciseSubstitution = {
  blockId: string;
  stepId: string;
  fromExerciseId: string;
  toExerciseId: string;
  fromName: string;
  toName: string;
};

export function findStepAlternatives(step: WorkoutStep, equipment: EquipmentId[]) {
  if (!step.exerciseId) return [];
  return findExerciseAlternatives(step.exerciseId, equipment);
}

export function stepFitsEquipment(step: WorkoutStep, equipment: EquipmentId[]) {
  const exercise = getExercise(step.exerciseId);
  return exercise ? exerciseFitsEquipment(exercise, equipment) : true;
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
      const source = getExercise(step.exerciseId);
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
