"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildEnginnExtra,
  ENGINN_EXTRA_DURATIONS,
  ENGINN_EXTRA_FOCUS_LABELS,
  replaceEnginnExtraExercise,
} from "@/lib/enginn-extra";
import type {
  EnginnExtraDurationMinutes,
  EnginnExtraExercise,
  EnginnExtraFocus,
  EnginnExtraResult,
  EquipmentId,
} from "@/lib/types";

const FOCUSES: EnginnExtraFocus[] = ["core", "grip", "legs", "cardio", "mobility", "recovery"];

function formatClock(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const rest = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

type Props = {
  equipment: EquipmentId[];
  seed: string;
  locationLabel?: string;
  onComplete: (result: EnginnExtraResult) => void;
};

export default function EnginnExtra({ equipment, seed, locationLabel, onComplete }: Props) {
  const [focus, setFocus] = useState<EnginnExtraFocus>("core");
  const [durationMinutes, setDurationMinutes] = useState<EnginnExtraDurationMinutes>(8);
  const [variant, setVariant] = useState(0);
  const [slotOverrides, setSlotOverrides] = useState<Record<number, EnginnExtraExercise>>({});
  const [replacementCounts, setReplacementCounts] = useState<Record<number, number>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);

  const plan = useMemo(
    () => buildEnginnExtra({ equipment, focus, durationMinutes, seed: `${seed}-variant-${variant}` }),
    [durationMinutes, equipment, focus, seed, variant],
  );
  const displayedExercises = useMemo(
    () => plan.exercises.map((exercise, index) => slotOverrides[index] ?? exercise),
    [plan.exercises, slotOverrides],
  );
  const activePlan = useMemo(
    () => ({ ...plan, exercises: displayedExercises }),
    [displayedExercises, plan],
  );

  useEffect(() => {
    if (!started) setRemainingSeconds(durationMinutes * 60);
  }, [durationMinutes, started]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!started || !running || remainingSeconds > 0 || completed) return;
    setRunning(false);
    setCompleted(true);
    onComplete({
      ...activePlan,
      completedAt: new Date().toISOString(),
      durationSeconds: durationMinutes * 60,
    });
  }, [activePlan, completed, durationMinutes, onComplete, remainingSeconds, running, started]);

  function resetExerciseChanges() {
    setSlotOverrides({});
    setReplacementCounts({});
  }

  function chooseFocus(nextFocus: EnginnExtraFocus) {
    setFocus(nextFocus);
    setVariant(0);
    resetExerciseChanges();
  }

  function chooseDuration(nextDuration: EnginnExtraDurationMinutes) {
    setDurationMinutes(nextDuration);
    setVariant(0);
    resetExerciseChanges();
  }

  function chooseAnotherPlan() {
    setVariant((current) => current + 1);
    resetExerciseChanges();
  }

  function replaceExercise(index: number) {
    const current = displayedExercises[index];
    if (!current) return;
    const nextCount = (replacementCounts[index] ?? 0) + 1;
    const replacement = replaceEnginnExtraExercise({
      equipment,
      focus,
      durationMinutes,
      currentExerciseId: current.exerciseId,
      excludedExerciseIds: displayedExercises
        .filter((_, exerciseIndex) => exerciseIndex !== index)
        .map((exercise) => exercise.exerciseId),
      seed: `${seed}-variant-${variant}-slot-${index}-replacement-${nextCount}`,
    });
    if (!replacement) return;
    setSlotOverrides((currentOverrides) => ({ ...currentOverrides, [index]: replacement }));
    setReplacementCounts((currentCounts) => ({ ...currentCounts, [index]: nextCount }));
  }

  function start() {
    setRemainingSeconds(durationMinutes * 60);
    setStarted(true);
    setCompleted(false);
    setRunning(true);
  }

  function finishEarly() {
    const plannedSeconds = durationMinutes * 60;
    const elapsed = Math.max(1, plannedSeconds - remainingSeconds);
    setRunning(false);
    setCompleted(true);
    onComplete({
      ...activePlan,
      completedAt: new Date().toISOString(),
      durationSeconds: elapsed,
    });
  }

  if (completed) {
    return (
      <section className="ui-card ui-card-accent p-5 text-left">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Enginn Extra</p>
        <h2 className="mt-1 text-xl font-black">Extra dokončeno</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {ENGINN_EXTRA_FOCUS_LABELS[focus]} · {durationMinutes} min. Doplněk je uložený u dnešního výsledku odděleně od hlavního benchmarku.
        </p>
      </section>
    );
  }

  return (
    <section className="ui-card ui-card-accent p-5 text-left">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Enginn Extra</p>
          <h2 className="mt-1 text-xl font-black">Ještě něco navíc?</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-400">Krátký blok podle času, cíle a vybavení, které máš právě k dispozici.</p>
        </div>
        {locationLabel && <span className="ui-chip shrink-0">{locationLabel}</span>}
      </div>

      {!started ? (
        <>
          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-wide text-zinc-500">Kolik máš času?</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ENGINN_EXTRA_DURATIONS.map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => chooseDuration(duration)}
                  className={durationMinutes === duration ? "ui-button ui-button-primary" : "ui-button ui-button-outline"}
                >
                  {duration} min
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-wide text-zinc-500">Na co se zaměřit?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FOCUSES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => chooseFocus(item)}
                  className={focus === item ? "ui-chip ui-chip-accent" : "ui-chip"}
                >
                  {ENGINN_EXTRA_FOCUS_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="ui-inset mt-5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-black">{ENGINN_EXTRA_FOCUS_LABELS[focus]} · {durationMinutes} min</p>
                <p className="mt-0.5 text-xs text-zinc-500">Opakuj cviky plynule do vypršení času.</p>
              </div>
              <span className="font-mono text-xl font-black text-accent">{String(durationMinutes).padStart(2, "0")}:00</span>
            </div>
            {displayedExercises.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {displayedExercises.map((exercise, index) => (
                  <li key={`${index}-${exercise.exerciseId}`} className="rounded-xl bg-surface px-3 py-2.5">
                    <div className="flex gap-3">
                      <span className="font-black text-accent">{index + 1}.</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/exercises/${encodeURIComponent(exercise.exerciseId)}`} className="font-bold text-white underline-offset-4 hover:underline">
                          {exercise.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-zinc-400">{exercise.prescription}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => replaceExercise(index)}
                      className="mt-2 text-xs font-bold text-accent hover:underline"
                    >
                      ↻ Vyměnit cvik
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-amber-300">Pro tuto kombinaci zatím nemám vhodný cvik. Zkus jiné zaměření nebo uprav vybavení místa.</p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              onClick={chooseAnotherPlan}
              disabled={displayedExercises.length === 0}
              className="ui-button ui-button-outline disabled:opacity-40"
            >
              Jiná sestava
            </button>
            <button type="button" onClick={start} disabled={displayedExercises.length === 0} className="ui-button ui-button-primary disabled:opacity-40">
              Spustit Enginn Extra
            </button>
          </div>
        </>
      ) : (
        <div className="mt-5">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{ENGINN_EXTRA_FOCUS_LABELS[focus]}</p>
            <p className="mt-2 font-mono text-6xl font-black text-accent">{formatClock(remainingSeconds)}</p>
            <p className="mt-2 text-sm text-zinc-400">Opakuj sestavu vlastním tempem. Kvalita pohybu má přednost před počtem kol.</p>
          </div>
          <ol className="mt-5 grid gap-2">
            {displayedExercises.map((exercise, index) => (
              <li key={`${index}-${exercise.exerciseId}`} className="ui-inset flex items-center gap-3 px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent-soft font-black text-accent">{index + 1}</span>
                <div>
                  <p className="font-black">{exercise.name}</p>
                  <p className="text-xs text-zinc-500">{exercise.prescription}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setRunning((value) => !value)} className="ui-button ui-button-outline">
              {running ? "Pozastavit" : "Pokračovat"}
            </button>
            <button type="button" onClick={finishEarly} className="ui-button ui-button-primary">Dokončit</button>
          </div>
        </div>
      )}
    </section>
  );
}
