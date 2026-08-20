import type {
  ProgramPhase,
  ScheduledExerciseOverride,
  ScheduledTrainingLocation,
  ScheduledWorkout,
  TrainingLocationProfile,
  TrainingProgram,
  WorkoutTemplate,
} from "./types";
import {
  findLocationAlternatives,
  resolveTrainingLocation,
  templateFitsEquipment,
  templateFitsLocation,
} from "./training-context.ts";
import {
  substituteTemplateExercisesForEquipment,
  substitutionsToOverrides,
} from "./exercise-substitution";

export type TrainingLocationChangeOutcome =
  | "restored-original"
  | "kept-current"
  | "adapted-exercises"
  | "adapted"
  | "no-compatible-alternative";

export type TrainingLocationChangePlan = {
  outcome: TrainingLocationChangeOutcome;
  updates: {
    trainingLocation?: ScheduledTrainingLocation;
    templateId?: string;
    originalTemplateId?: string;
    exerciseOverrides?: ScheduledExerciseOverride[];
  };
  selectedTemplate: WorkoutTemplate;
  originalTemplate?: WorkoutTemplate;
};

export type RemainingProgramLocationPlan = {
  updates: Array<{
    id: string;
    updates: TrainingLocationChangePlan["updates"];
  }>;
  total: number;
  kept: number;
  adapted: number;
  exerciseAdapted: number;
  restored: number;
  unresolved: number;
  missingTemplates: number;
};

export function planTrainingLocationChange({
  schedule,
  currentTemplate,
  templates,
  location,
  customLocations = [],
  phase,
}: {
  schedule: ScheduledWorkout;
  currentTemplate: WorkoutTemplate;
  templates: WorkoutTemplate[];
  location?: ScheduledTrainingLocation;
  customLocations?: TrainingLocationProfile[];
  phase?: ProgramPhase;
}): TrainingLocationChangePlan {
  const originalTemplate = schedule.originalTemplateId
    ? templates.find((item) => item.id === schedule.originalTemplateId)
    : undefined;
  const anchor = originalTemplate ?? currentTemplate;

  if (!location) {
    if (originalTemplate) {
      return {
        outcome: "restored-original",
        updates: {
          trainingLocation: undefined,
          templateId: originalTemplate.id,
          originalTemplateId: undefined,
          exerciseOverrides: undefined,
        },
        selectedTemplate: originalTemplate,
        originalTemplate,
      };
    }
    return {
      outcome: "kept-current",
      updates: { trainingLocation: undefined, exerciseOverrides: undefined },
      selectedTemplate: currentTemplate,
    };
  }

  if (templateFitsLocation(anchor, location, customLocations)) {
    if (originalTemplate) {
      return {
        outcome: "restored-original",
        updates: {
          trainingLocation: location,
          templateId: originalTemplate.id,
          originalTemplateId: undefined,
          exerciseOverrides: undefined,
        },
        selectedTemplate: originalTemplate,
        originalTemplate,
      };
    }
    return {
      outcome: "kept-current",
      updates: { trainingLocation: location, exerciseOverrides: undefined },
      selectedTemplate: currentTemplate,
    };
  }

  const locationProfile = resolveTrainingLocation(location, customLocations);
  if (locationProfile) {
    const exercisePlan = substituteTemplateExercisesForEquipment(anchor, locationProfile.equipment);
    if (
      exercisePlan.substitutions.length > 0
      && exercisePlan.unresolvedStepIds.length === 0
      && templateFitsEquipment(exercisePlan.template, locationProfile.equipment)
    ) {
      return {
        outcome: "adapted-exercises",
        updates: {
          trainingLocation: location,
          templateId: anchor.id,
          originalTemplateId: undefined,
          exerciseOverrides: substitutionsToOverrides(exercisePlan.substitutions),
        },
        selectedTemplate: exercisePlan.template,
        originalTemplate,
      };
    }
  }

  const bestAlternative = findLocationAlternatives({
    current: anchor,
    templates,
    location,
    customLocations,
    phase,
    limit: 1,
  })[0];

  if (bestAlternative) {
    return {
      outcome: "adapted",
      updates: {
        trainingLocation: location,
        templateId: bestAlternative.id,
        originalTemplateId: schedule.originalTemplateId ?? schedule.templateId,
        exerciseOverrides: undefined,
      },
      selectedTemplate: bestAlternative,
      originalTemplate,
    };
  }

  return {
    outcome: "no-compatible-alternative",
    updates: { trainingLocation: location, exerciseOverrides: undefined },
    selectedTemplate: currentTemplate,
    originalTemplate,
  };
}

export function planRemainingProgramLocationChange({
  program,
  schedules,
  templates,
  location,
  customLocations = [],
  fromDate,
}: {
  program: TrainingProgram;
  schedules: ScheduledWorkout[];
  templates: WorkoutTemplate[];
  location: ScheduledTrainingLocation;
  customLocations?: TrainingLocationProfile[];
  fromDate: string;
}): RemainingProgramLocationPlan {
  const remaining = schedules
    .filter((schedule) => (
      schedule.programId === program.id
      && schedule.status === "planned"
      && schedule.date >= fromDate
    ))
    .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));

  const result: RemainingProgramLocationPlan = {
    updates: [],
    total: remaining.length,
    kept: 0,
    adapted: 0,
    exerciseAdapted: 0,
    restored: 0,
    unresolved: 0,
    missingTemplates: 0,
  };

  for (const schedule of remaining) {
    const currentTemplate = templates.find((template) => template.id === schedule.templateId);
    if (!currentTemplate) {
      result.missingTemplates += 1;
      continue;
    }

    const phase = schedule.programWeek
      ? program.weeks.find((week) => week.weekNumber === schedule.programWeek)?.phase
      : undefined;
    const plan = planTrainingLocationChange({
      schedule,
      currentTemplate,
      templates,
      location,
      customLocations,
      phase,
    });

    result.updates.push({ id: schedule.id, updates: plan.updates });
    if (plan.outcome === "adapted") result.adapted += 1;
    else if (plan.outcome === "adapted-exercises") result.exerciseAdapted += 1;
    else if (plan.outcome === "restored-original") result.restored += 1;
    else if (plan.outcome === "no-compatible-alternative") result.unresolved += 1;
    else result.kept += 1;
  }

  return result;
}
