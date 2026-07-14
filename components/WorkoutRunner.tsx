"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StepSplit, WorkoutTemplate } from "@/lib/types";
import ConfirmDialog from "@/components/ConfirmDialog";
import WorkoutResultForm from "@/components/WorkoutResultForm";

type RunnableStep = {
  blockId: string;
  stepId: string;
  blockTitle: string;
  round: number;
  roundCount: number;
  name: string;
  detail: string;
  durationSeconds?: number;
  emomMinute?: number;
  emomMinutes?: number;
};

type WorkoutRunnerProps = {
  template: WorkoutTemplate;
  scheduledWorkoutId?: string;
};

function flattenTemplate(template: WorkoutTemplate): RunnableStep[] {
  return template.blocks.flatMap((block) => {
    if (block.type === "emom") {
      if (block.steps.length === 0) return [];
      return Array.from({ length: block.minutes }, (_, minute) => {
        const step = block.steps[minute % block.steps.length];
        return {
          blockId: block.id,
          stepId: step.id,
          blockTitle: block.title,
          round: minute + 1,
          roundCount: block.minutes,
          name: step.name,
          detail: step.detail,
          durationSeconds: 60,
          emomMinute: minute + 1,
          emomMinutes: block.minutes,
        };
      });
    }

    return Array.from({ length: block.repeat }, (_, round) =>
      block.steps.map((step) => ({
        blockId: block.id,
        stepId: step.id,
        blockTitle: block.title,
        round: round + 1,
        roundCount: block.repeat,
        name: step.name,
        detail: step.detail,
      })),
    ).flat();
  });
}

function formatClock(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}

export default function WorkoutRunner({ template, scheduledWorkoutId }: WorkoutRunnerProps) {
  const router = useRouter();
  const steps = useMemo(() => flattenTemplate(template), [template]);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);
  const [splits, setSplits] = useState<StepSplit[]>([]);

  const currentIndexRef = useRef(0);
  const totalAccumulatedRef = useRef(0);
  const totalStartedAtRef = useRef<number | null>(null);
  const stepAccumulatedRef = useRef(0);
  const stepStartedAtRef = useRef<number | null>(null);
  const splitsRef = useRef<StepSplit[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentStep = steps[currentIndex];

  function ensureAudio() {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
  }

  function beep(frequency = 880) {
    const context = audioContextRef.current;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.22);
  }

  function elapsed(accumulated: number, startedAt: number | null, now: number) {
    return accumulated + (startedAt === null ? 0 : now - startedAt);
  }

  function recordSplit(step: RunnableStep, durationMilliseconds: number) {
    const split: StepSplit = {
      blockId: step.blockId,
      stepId: step.stepId,
      round: step.round,
      durationSeconds: Math.max(0, Math.round(durationMilliseconds / 1000)),
    };
    splitsRef.current = [...splitsRef.current, split];
    setSplits(splitsRef.current);
  }

  function completeWorkout(now: number) {
    const finalDuration = elapsed(totalAccumulatedRef.current, totalStartedAtRef.current, now);
    totalAccumulatedRef.current = finalDuration;
    totalStartedAtRef.current = null;
    stepStartedAtRef.current = null;
    setTotalElapsed(finalDuration);
    setFinished(true);
    setPaused(false);
    beep(1040);
  }

  function advanceManual() {
    ensureAudio();
    const now = Date.now();
    const step = steps[currentIndexRef.current];
    recordSplit(step, elapsed(stepAccumulatedRef.current, stepStartedAtRef.current, now));

    if (currentIndexRef.current >= steps.length - 1) {
      completeWorkout(now);
      return;
    }

    const nextIndex = currentIndexRef.current + 1;
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    stepAccumulatedRef.current = 0;
    stepStartedAtRef.current = now;
    setStepElapsed(0);
    if (steps[nextIndex].durationSeconds) beep();
  }

  function start() {
    if (steps.length === 0) return;
    ensureAudio();
    const now = Date.now();
    totalStartedAtRef.current = now;
    stepStartedAtRef.current = now;
    setStarted(true);
    if (steps[0].durationSeconds) beep();
  }

  function togglePause() {
    ensureAudio();
    const now = Date.now();
    if (paused) {
      totalStartedAtRef.current = now;
      stepStartedAtRef.current = now;
      setPaused(false);
      return;
    }

    totalAccumulatedRef.current = elapsed(
      totalAccumulatedRef.current,
      totalStartedAtRef.current,
      now,
    );
    stepAccumulatedRef.current = elapsed(
      stepAccumulatedRef.current,
      stepStartedAtRef.current,
      now,
    );
    totalStartedAtRef.current = null;
    stepStartedAtRef.current = null;
    setTotalElapsed(totalAccumulatedRef.current);
    setStepElapsed(stepAccumulatedRef.current);
    setPaused(true);
  }

  useEffect(() => {
    if (!started || paused || finished) return;

    const tick = () => {
      const now = Date.now();
      const total = elapsed(totalAccumulatedRef.current, totalStartedAtRef.current, now);
      let stepTime = elapsed(stepAccumulatedRef.current, stepStartedAtRef.current, now);
      let index = currentIndexRef.current;
      let step = steps[index];

      while (step?.durationSeconds && stepTime >= step.durationSeconds * 1000) {
        recordSplit(step, step.durationSeconds * 1000);
        stepTime -= step.durationSeconds * 1000;
        beep();

        if (index >= steps.length - 1) {
          completeWorkout(now);
          return;
        }

        index += 1;
        step = steps[index];
        currentIndexRef.current = index;
        setCurrentIndex(index);
        stepAccumulatedRef.current = 0;
        stepStartedAtRef.current = now - stepTime;

        if (!step.durationSeconds) break;
      }

      setTotalElapsed(total);
      setStepElapsed(stepTime);
    };

    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
    // completeWorkout only reads refs and stable state setters; restarting this
    // interval on every render would make the stopwatch less reliable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, paused, started, steps]);

  useEffect(() => {
    if (!started || finished) return;
    const preventClose = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventClose);
    return () => window.removeEventListener("beforeunload", preventClose);
  }, [finished, started]);

  useEffect(() => () => {
    void audioContextRef.current?.close();
  }, []);

  if (finished) {
    return (
      <WorkoutResultForm
        template={template}
        scheduledWorkoutId={scheduledWorkoutId}
        durationSeconds={Math.max(1, Math.round(totalElapsed / 1000))}
        splits={splits}
      />
    );
  }

  if (!started) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-950 p-5 text-white">
        <section className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-7">
          <button onClick={() => router.back()} className="text-sm text-zinc-400">
            ← Zpět
          </button>
          <p className="mt-10 text-sm font-bold uppercase tracking-[0.22em] text-lime-400">
            Připraven?
          </p>
          <h1 className="mt-2 text-4xl font-black">{template.title}</h1>
          <p className="mt-3 leading-6 text-zinc-400">{template.description}</p>
          <div className="mt-6 flex gap-3 text-sm text-zinc-300">
            <span className="rounded-full bg-zinc-800 px-3 py-1.5">{steps.length} úseků</span>
            <span className="rounded-full bg-zinc-800 px-3 py-1.5">cca {template.durationMinutes} min</span>
          </div>
          <button
            type="button"
            onClick={start}
            disabled={steps.length === 0}
            className="mt-10 w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-black text-zinc-950 disabled:opacity-40"
          >
            Spustit trénink
          </button>
        </section>
      </main>
    );
  }

  const shownTime = currentStep.durationSeconds
    ? currentStep.durationSeconds * 1000 - stepElapsed
    : stepElapsed;

  return (
    <main className="min-h-dvh bg-zinc-950 p-5 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-40px)] max-w-md flex-col">
        <header className="grid grid-cols-3 items-center">
          <button
            type="button"
            onClick={() => setShowQuit(true)}
            className="justify-self-start text-sm text-zinc-400"
          >
            × Ukončit
          </button>
          <button
            type="button"
            onClick={togglePause}
            className="justify-self-center rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold"
          >
            {paused ? "Pokračovat" : "Pauza"}
          </button>
          <span className="justify-self-end font-mono text-sm text-zinc-300">
            {formatClock(totalElapsed)}
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-400">
            {currentStep.blockTitle}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {currentStep.emomMinute
              ? `Minuta ${currentStep.emomMinute} z ${currentStep.emomMinutes}`
              : currentStep.roundCount > 1
                ? `Kolo ${currentStep.round} z ${currentStep.roundCount}`
                : `Úsek ${currentIndex + 1} z ${steps.length}`}
          </p>
          <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl">
            {currentStep.name}
          </h1>
          {currentStep.detail && (
            <p className="mt-4 text-lg leading-7 text-zinc-400">{currentStep.detail}</p>
          )}
          <div className="mt-10 font-mono text-6xl font-black tracking-tight">
            {formatClock(shownTime)}
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            {paused
              ? "Časovač je pozastavený"
              : currentStep.durationSeconds
                ? "Zbývá v minutě"
                : "Čas aktuálního úseku"}
          </p>
          <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-lime-400 transition-[width] duration-200"
              style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        </section>

        <button
          type="button"
          onClick={advanceManual}
          disabled={paused}
          className="w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-black text-zinc-950 transition disabled:opacity-40"
        >
          {currentIndex === steps.length - 1
            ? "Dokončit trénink"
            : currentStep.durationSeconds
              ? "Přeskočit minutu →"
              : "Hotovo →"}
        </button>
      </div>

      <ConfirmDialog
        open={showQuit}
        title="Ukončit trénink?"
        description="Aktuální čas a mezičasy se neuloží."
        confirmLabel="Ukončit"
        destructive
        onCancel={() => setShowQuit(false)}
        onConfirm={() => router.push("/")}
      />
    </main>
  );
}

