"use client";

import { useCallback, useEffect, useState } from "react";
import { createDefaultHyroxData } from "@/lib/default-data";
import {
  HYROX_DATA_EVENT,
  HYROX_STORAGE_KEY,
  addResult as addStoredResult,
  createTemplate as createStoredTemplate,
  deleteResult as deleteStoredResult,
  deleteScheduledWorkout as deleteStoredScheduledWorkout,
  deleteTemplate as deleteStoredTemplate,
  loadHyroxData,
  resetHyroxData,
  scheduleWorkout as scheduleStoredWorkout,
  updateResult as updateStoredResult,
  updateScheduledWorkout as updateStoredScheduledWorkout,
  updateTemplate as updateStoredTemplate,
} from "@/lib/storage";
import type {
  NewScheduledWorkout,
  NewWorkoutResult,
  NewWorkoutTemplate,
} from "@/lib/types";

export function useHyroxData() {
  const [data, setData] = useState(createDefaultHyroxData);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setData(loadHyroxData());
    setReady(true);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(refresh, 0);

    const onStorage = (event: StorageEvent) => {
      if (event.key === HYROX_STORAGE_KEY) refresh();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(HYROX_DATA_EVENT, refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HYROX_DATA_EVENT, refresh);
    };
  }, [refresh]);

  return {
    data,
    ready,
    createTemplate: (input: NewWorkoutTemplate) => createStoredTemplate(input),
    updateTemplate: (id: string, updates: Partial<NewWorkoutTemplate>) =>
      updateStoredTemplate(id, updates),
    deleteTemplate: (id: string) => deleteStoredTemplate(id),
    scheduleWorkout: (input: NewScheduledWorkout) => scheduleStoredWorkout(input),
    updateScheduledWorkout: (
      id: string,
      updates: Partial<NewScheduledWorkout>,
    ) => updateStoredScheduledWorkout(id, updates),
    deleteScheduledWorkout: (id: string) => deleteStoredScheduledWorkout(id),
    addResult: (input: NewWorkoutResult) => addStoredResult(input),
    updateResult: (id: string, updates: Partial<NewWorkoutResult>) =>
      updateStoredResult(id, updates),
    deleteResult: (id: string) => deleteStoredResult(id),
    resetData: () => resetHyroxData(),
  };
}

