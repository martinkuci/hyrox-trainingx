"use client";

import { useCallback, useEffect, useState } from "react";
import { createDefaultHyroxData } from "@/lib/default-data";
import {
  HYROX_DATA_EVENT,
  HYROX_STORAGE_KEY,
  addResult,
  createTemplate,
  createTrainingLocation,
  createTrainingProgram,
  createWeeklyPlan,
  deleteResult,
  deleteScheduledWorkout,
  deleteTemplate,
  deleteTrainingLocation,
  deleteTrainingProgram,
  deleteWeeklyPlan,
  decideTrainingAdaptation,
  loadHyroxData,
  mergeHealthActivities,
  replaceSchedulesForDates,
  resetHyroxData,
  scheduleMany,
  scheduleWorkout,
  updateResult,
  updateScheduledWorkout,
  updateScheduledWorkouts,
  updateTemplate,
  updateTrainingLocation,
  updateTrainingProgram,
} from "@/lib/storage";
import type {
  HealthActivity,
  HealthProviderId,
  NewScheduledWorkout,
  NewTrainingLocationProfile,
  NewTrainingProgram,
  NewWeeklyPlanTemplate,
  NewWorkoutResult,
  NewWorkoutTemplate,
  TrainingAdaptationDecision,
} from "@/lib/types";
import type { ScheduledWorkoutUpdate } from "@/lib/calendar-planning";

export function useHyroxData() {
  const [data, setData] = useState(createDefaultHyroxData);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(() => {
    try { setData(loadHyroxData()); } finally { setReady(true); }
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => { if (event.key === HYROX_STORAGE_KEY) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(HYROX_DATA_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HYROX_DATA_EVENT, refresh);
    };
  }, [refresh]);

  return {
    data,
    ready,
    createTemplate: (input: NewWorkoutTemplate) => createTemplate(input),
    updateTemplate: (id: string, updates: Partial<NewWorkoutTemplate>) => updateTemplate(id, updates),
    deleteTemplate,
    createTrainingLocation: (input: NewTrainingLocationProfile) => createTrainingLocation(input),
    updateTrainingLocation: (id: string, updates: Partial<NewTrainingLocationProfile>) => updateTrainingLocation(id, updates),
    deleteTrainingLocation,
    scheduleWorkout: (input: NewScheduledWorkout) => scheduleWorkout(input),
    scheduleMany: (inputs: NewScheduledWorkout[]) => scheduleMany(inputs),
    replaceSchedulesForDates: (inputs: NewScheduledWorkout[], dates: string[]) => replaceSchedulesForDates(inputs, dates),
    updateScheduledWorkout: (id: string, updates: Partial<NewScheduledWorkout>) => updateScheduledWorkout(id, updates),
    updateScheduledWorkouts: (updates: ScheduledWorkoutUpdate[]) => updateScheduledWorkouts(updates),
    deleteScheduledWorkout,
    createWeeklyPlan: (input: NewWeeklyPlanTemplate) => createWeeklyPlan(input),
    deleteWeeklyPlan,
    createTrainingProgram: (input: NewTrainingProgram) => createTrainingProgram(input),
    updateTrainingProgram: (id: string, updates: Partial<NewTrainingProgram>) => updateTrainingProgram(id, updates),
    deleteTrainingProgram,
    addResult: (input: NewWorkoutResult) => addResult(input),
    updateResult: (id: string, updates: Partial<NewWorkoutResult>) => updateResult(id, updates),
    decideTrainingAdaptation: (resultId: string, decision: TrainingAdaptationDecision) => decideTrainingAdaptation(resultId, decision),
    mergeHealthActivities: (provider: HealthProviderId, activities: HealthActivity[], syncedAt?: string) =>
      mergeHealthActivities(provider, activities, syncedAt),
    deleteResult,
    resetData: resetHyroxData,
  };
}
