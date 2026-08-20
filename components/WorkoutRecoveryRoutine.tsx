"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildWorkoutRecoveryPlan,
  RECOVERY_DURATIONS,
  RECOVERY_INTENT_LABELS,
  replaceRecoveryPlanExercise,
  type RecoveryDurationMinutes,
  type RecoveryPlan,
} from "@/lib/recovery-builder";
import type { EquipmentId, RecoveryRoutineResult, WorkoutTemplate } from "@/lib/types";

type Props = {
  template: WorkoutTemplate;
  equipment: EquipmentId[];
  when: "before" | "after";
  locationLabel?: string;
  seed: string;
  defaultDuration?: RecoveryDurationMinutes;
  onComplete: (result: RecoveryRoutineResult) => void;
  onSkip: () => void;
};

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export default function WorkoutRecoveryRoutine({
  template,
  equipment,
  when,
  locationLabel,
  seed,
  defaultDuration = 8,
  onComplete,
  onSkip,
}: Props) {
  const [durationMinutes, setDurationMinutes] = useState<RecoveryDurationMinutes>(defaultDuration);
  const [variant, setVariant] = useState(0);
  const generated = useMemo(
    () => buildWorkoutRecoveryPlan({
      template,
      equipment,
      when,
      durationMinutes,
      seed: `${seed}-${variant}`,
    }),
    [durationMinutes, equipment, seed, template, variant, when],
  );
  const [plan, setPlan] = useState<RecoveryPlan>(generated);
  const [stage, setStage] = useState<"preview" | "running">("preview");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => { setPlan(generated); }, [generated]);

  const itemDurations = useMemo(() => {
    const count = Math.max(1, plan.exercises.length);
    const total = durationMinutes * 60;
    const base = Math.floor(total / count);
    return plan.exercises.map((_, index) => index === count - 1 ? total - base * (count - 1) : base);
  }, [durationMinutes, plan.exercises]);

  function start() {
    if (plan.exercises.length === 0) return;
    setCurrentIndex(0);
    setElapsedSeconds(0);
    setSecondsLeft(itemDurations[0] ?? 60);
    setPaused(false);
    setStage("running");
  }

  function finish(actualSeconds = elapsedSeconds) {
    onComplete({
      intent: plan.intent,
      area: plan.area,
      durationMinutes: plan.durationMinutes,
      exercises: plan.exercises.map((item) => ({ ...item })),
      completedAt: new Date().toISOString(),
      durationSeconds: Math.max(1, actualSeconds),
    });
  }

  function nextExercise() {
    if (currentIndex >= plan.exercises.length - 1) {
      finish(elapsedSeconds);
      return;
    }
    const next = currentIndex + 1;
    setCurrentIndex(next);
    setSecondsLeft(itemDurations[next] ?? 60);
  }

  useEffect(() => {
    if (stage !== "running" || paused) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused, stage]);

  useEffect(() => {
    if (stage !== "running" || secondsLeft > 0) return;
    if (currentIndex >= plan.exercises.length - 1) {
      finish(elapsedSeconds);
      return;
    }
    const next = currentIndex + 1;
    setCurrentIndex(next);
    setSecondsLeft(itemDurations[next] ?? 60);
    // onComplete is intentionally driven by the current routine state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, stage]);

  const title = when === "before" ? "Příprava před workoutem" : "Zklidnění & kompenzace";
  const subtitle = when === "before"
    ? "Enginn vybral oblasti, které bude tento workout nejvíc potřebovat."
    : "Krátký blok podle skutečného obsahu právě dokončeného workoutu.";

  if (stage === "running") {
    const current = plan.exercises[currentIndex];
    return (
      <section className="ui-card ui-card-accent p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{title}</p>
            <h2 className="mt-1 text-2xl font-black">{current?.name}</h2>
            <p className="mt-2 text-sm text-zinc-400">{current?.prescription}</p>
          </div>
          <span className="ui-chip ui-chip-accent shrink-0">{currentIndex + 1}/{plan.exercises.length}</span>
        </div>

        <div className="ui-inset mt-5 p-5 text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Čas tohoto cviku</p>
          <p className="mt-2 font-mono text-5xl font-black text-accent">{formatClock(secondsLeft)}</p>
          <p className="mt-2 text-xs text-zinc-500">Celkem {formatClock(elapsedSeconds)} · {durationMinutes} min plán</p>
        </div>

        {current?.exerciseId && (
          <Link href={`/exercises/${encodeURIComponent(current.exerciseId)}`} className="ui-button ui-button-outline mt-4 w-full">
            Jak na to
          </Link>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setPaused((value) => !value)} className="ui-button ui-button-secondary">
            {paused ? "Pokračovat" : "Pozastavit"}
          </button>
          <button type="button" onClick={nextExercise} className="ui-button ui-button-primary">
            {currentIndex === plan.exercises.length - 1 ? "Dokončit" : "Další →"}
          </button>
        </div>
        <button type="button" onClick={() => finish(elapsedSeconds)} className="ui-button ui-button-ghost mt-2 w-full text-sm">
          Ukončit blok dříve
        </button>
      </section>
    );
  }

  return (
    <section className="ui-card ui-card-accent p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">3B.2 · {RECOVERY_INTENT_LABELS[plan.intent]}</p>
          <h2 className="mt-1 text-2xl font-black">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{subtitle}</p>
        </div>
        <span className="ui-chip ui-chip-accent shrink-0">{durationMinutes} min</span>
      </div>

      {generated.inferredAreas.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {generated.inferredAreas.map((item) => <span key={item.area} className="ui-chip text-[10px]">{item.label}</span>)}
        </div>
      )}
      {locationLabel && <p className="mt-3 text-xs text-zinc-500">Vybavení podle místa: {locationLabel}</p>}

      <div className="mt-5 grid grid-cols-4 gap-2">
        {RECOVERY_DURATIONS.map((duration) => (
          <button
            key={duration}
            type="button"
            aria-pressed={durationMinutes === duration}
            onClick={() => { setDurationMinutes(duration); setVariant(0); }}
            className={durationMinutes === duration ? "ui-button ui-button-primary px-2" : "ui-button ui-button-outline px-2"}
          >
            {duration} min
          </button>
        ))}
      </div>

      <ol className="mt-5 space-y-2">
        {plan.exercises.map((exercise, index) => (
          <li key={`${exercise.exerciseId}-${index}`} className="ui-inset p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent-soft font-black text-accent">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/exercises/${encodeURIComponent(exercise.exerciseId)}`} className="font-black text-zinc-100 underline-offset-4 hover:underline">
                  {exercise.name}
                </Link>
                <p className="mt-1 text-sm leading-5 text-zinc-400">{exercise.prescription}</p>
                <p className="mt-1 text-xs text-zinc-500">{exercise.reason}</p>
              </div>
              <button
                type="button"
                onClick={() => setPlan((current) => replaceRecoveryPlanExercise({ plan: current, equipment, index, seed: `${seed}-${variant}-${index}` }))}
                className="ui-button ui-button-ghost ui-button-sm shrink-0 px-2 text-xs"
              >
                Vyměnit
              </button>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setVariant((value) => value + 1)} className="ui-button ui-button-outline">Jiná sestava</button>
        <button type="button" onClick={start} disabled={plan.exercises.length === 0} className="ui-button ui-button-primary disabled:opacity-40">Spustit {durationMinutes} min</button>
      </div>
      <button type="button" onClick={onSkip} className="ui-button ui-button-ghost mt-2 w-full text-sm">
        {when === "before" ? "Přejít rovnou na workout" : "Přeskočit a pokračovat"}
      </button>
      <p className="mt-4 text-[11px] leading-5 text-zinc-500">Tréninková podpora, ne diagnostika ani léčba. Při ostré nebo nezvyklé bolesti cvik ukonči.</p>
    </section>
  );
}
