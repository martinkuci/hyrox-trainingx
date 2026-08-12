"use client";

import { useCallback, useEffect, useState } from "react";
import { createDefaultHyroxData } from "@/lib/default-data";
import {
  HYROX_DATA_EVENT,
  HYROX_STORAGE_KEY,
  addResult,
  createTemplate,
  createTrainingProgram,
  createWeeklyPlan,
  deleteResult,
  deleteScheduledWorkout,
  deleteTemplate,
  deleteTrainingProgram,
  deleteWeeklyPlan,
  loadHyroxData,
  replaceSchedulesForDates,
  resetHyroxData,
  scheduleMany,
  scheduleWorkout,
  updateResult,
  updateScheduledWorkout,
  updateScheduledWorkouts,
  updateTemplate,
  updateTrainingProgram,
} from "@/lib/storage";
import type {
  NewScheduledWorkout,
  NewTrainingProgram,
  NewWeeklyPlanTemplate,
  NewWorkoutResult,
  NewWorkoutTemplate,
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
    deleteResult,
    resetData: resetHyroxData,
  };
}
