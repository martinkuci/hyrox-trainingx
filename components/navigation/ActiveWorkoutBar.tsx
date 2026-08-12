"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ACTIVE_WORKOUT_CHANGE_EVENT,
  ACTIVE_WORKOUT_STORAGE_KEY,
  loadWorkoutCheckpoint,
  type WorkoutCheckpoint,
} from "@/lib/workout-checkpoint";

function formatClock(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}

function workoutHref(checkpoint: WorkoutCheckpoint) {
  const scheduleQuery = checkpoint.scheduledWorkoutId
    ? `?scheduleId=${encodeURIComponent(checkpoint.scheduledWorkoutId)}`
    : "";
  return `/workout/${encodeURIComponent(checkpoint.templateId)}${scheduleQuery}`;
}

export function ActiveWorkoutBar() {
  const [checkpoint, setCheckpoint] = useState<WorkoutCheckpoint | null>(null);

  useEffect(() => {
    const refresh = () => setCheckpoint(loadWorkoutCheckpoint());
    const initialRefresh = window.setTimeout(refresh, 0);
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_WORKOUT_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", refreshFromStorage);
    window.addEventListener(ACTIVE_WORKOUT_CHANGE_EVENT, refresh);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("storage", refreshFromStorage);
      window.removeEventListener(ACTIVE_WORKOUT_CHANGE_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("has-active-workout", Boolean(checkpoint));
    return () => document.documentElement.classList.remove("has-active-workout");
  }, [checkpoint]);

  if (!checkpoint) return null;

  return (
    <aside
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[45] border-t border-accent/25 bg-[#11150f]/96 px-3 py-2 text-white shadow-[0_-10px_28px_rgba(0,0,0,0.3)] backdrop-blur-xl"
      aria-label="Pozastavený trénink"
    >
      <div className="mx-auto flex min-h-14 w-full max-w-2xl items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent" aria-hidden="true">▶</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{checkpoint.templateTitle}</p>
          <p className="mt-0.5 text-xs font-semibold text-zinc-400">
            Pozastaveno · <span className="font-mono text-zinc-300">{formatClock(checkpoint.totalElapsedMilliseconds)}</span>
          </p>
        </div>
        <Link href={workoutHref(checkpoint)} className="ui-button ui-button-primary min-h-11 shrink-0 px-4 text-sm">
          Pokračovat
        </Link>
      </div>
    </aside>
  );
}
