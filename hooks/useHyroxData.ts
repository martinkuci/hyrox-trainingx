"use client";

import { useCallback, useEffect, useState } from "react";
import { createDefaultHyroxData } from "@/lib/default-data";
import {
  HYROX_DATA_EVENT, HYROX_STORAGE_KEY, addResult, createTemplate, createWeeklyPlan,
  deleteResult, deleteScheduledWorkout, deleteTemplate, deleteWeeklyPlan, loadHyroxData,
  replaceSchedulesForDates, resetHyroxData, scheduleMany, scheduleWorkout, updateResult,
  updateScheduledWorkout, updateTemplate,
} from "@/lib/storage";
import type { NewScheduledWorkout, NewWeeklyPlanTemplate, NewWorkoutResult, NewWorkoutTemplate } from "@/lib/types";

export function useHyroxData() {
  const [data, setData] = useState(createDefaultHyroxData);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(() => { try { setData(loadHyroxData()); } finally { setReady(true); } }, []);
  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => { if (event.key === HYROX_STORAGE_KEY) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(HYROX_DATA_EVENT, refresh);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(HYROX_DATA_EVENT, refresh); };
  }, [refresh]);
  return {
    data, ready,
    createTemplate: (input: NewWorkoutTemplate) => createTemplate(input),
    updateTemplate: (id: string, updates: Partial<NewWorkoutTemplate>) => updateTemplate(id, updates),
    deleteTemplate,
    scheduleWorkout: (input: NewScheduledWorkout) => scheduleWorkout(input),
    scheduleMany: (inputs: NewScheduledWorkout[]) => scheduleMany(inputs),
    replaceSchedulesForDates: (inputs: NewScheduledWorkout[], dates: string[]) => replaceSchedulesForDates(inputs, dates),
    updateScheduledWorkout: (id: string, updates: Partial<NewScheduledWorkout>) => updateScheduledWorkout(id, updates),
    deleteScheduledWorkout,
    createWeeklyPlan: (input: NewWeeklyPlanTemplate) => createWeeklyPlan(input),
    deleteWeeklyPlan,
    addResult: (input: NewWorkoutResult) => addResult(input),
    updateResult: (id: string, updates: Partial<NewWorkoutResult>) => updateResult(id, updates),
    deleteResult,
    resetData: resetHyroxData,
  };
}
