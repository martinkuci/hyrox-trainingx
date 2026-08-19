import type {
  ProgramPhase,
  ScheduledTrainingLocation,
  ScheduledWorkout,
  TrainingLocationProfile,
  TrainingProgram,
  WorkoutTemplate,
} from "./types";
import {
  findLocationAlternatives,
  templateFitsLocation,
} from "./training-context.ts";

export type TrainingLocationChangeOutcome =
  | "restored-original"
  | "kept-current"
  | "adapted"
  | "no-compatible-alternative";

export type TrainingLocationChangePlan = {
  outcome: TrainingLocationChangeOutcome;
  updates: {
    trainingLocation?: ScheduledTrainingLocation;
    templateId?: string;
    originalTemplateId?: string;
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

  if (!location) {
    if (originalTemplate) {
      return {
        outcome: "restored-original",
        updates: {
          trainingLocation: undefined,
          templateId: originalTemplate.id,
          originalTemplateId: undefined,
        },
        selectedTemplate: originalTemplate,
        originalTemplate,
      };
    }
    return {
      outcome: "kept-current",
      updates: { trainingLocation: undefined },
      selectedTemplate: currentTemplate,
    };
  }

  if (originalTemplate && templateFitsLocation(originalTemplate, location, customLocations)) {
    return {
      outcome: "restored-original",
      updates: {
        trainingLocation: location,
        templateId: originalTemplate.id,
        originalTemplateId: undefined,
      },
      selectedTemplate: originalTemplate,
      originalTemplate,
    };
  }

  if (templateFitsLocation(currentTemplate, location, customLocations)) {
    return {
      outcome: "kept-current",
      updates: { trainingLocation: location },
      selectedTemplate: currentTemplate,
      originalTemplate,
    };
  }

  const anchor = originalTemplate ?? currentTemplate;
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
      },
      selectedTemplate: bestAlternative,
      originalTemplate,
    };
  }

  return {
    outcome: "no-compatible-alternative",
    updates: { trainingLocation: location },
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
    else if (plan.outcome === "restored-original") result.restored += 1;
    else if (plan.outcome === "no-compatible-alternative") result.unresolved += 1;
    else result.kept += 1;
  }

  return result;
}
