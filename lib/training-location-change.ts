import type {
  ProgramPhase,
  ScheduledTrainingLocation,
  ScheduledWorkout,
  TrainingLocationProfile,
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
