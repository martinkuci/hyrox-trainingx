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

type RunnerMode = "overview" | "block-preview" | "countdown" | "running" | "finished";

type WorkoutRunnerProps = { template: WorkoutTemplate; scheduledWorkoutId?: string };

function flattenTemplate(template: WorkoutTemplate): RunnableStep[] {
  return template.blocks.flatMap((block) => {
    if (block.type === "emom") {
      if (block.steps.length === 0) return [];
      return Array.from({ length: block.minutes }, (_, minute) => {
        const step = block.steps[minute % block.steps.length];
        return { blockId: block.id, stepId: step.id, blockTitle: block.title, round: minute + 1, roundCount: block.minutes, name: step.name, detail: step.detail, durationSeconds: 60, emomMinute: minute + 1, emomMinutes: block.minutes };
      });
    }
    return Array.from({ length: block.repeat }, (_, round) => block.steps.map((step) => ({ blockId: block.id, stepId: step.id, blockTitle: block.title, round: round + 1, roundCount: block.repeat, name: step.name, detail: step.detail }))).flat();
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
  const [mode, setMode] = useState<RunnerMode>("overview");
  const [paused, setPaused] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);
  const [splits, setSplits] = useState<StepSplit[]>([]);
  const [countdown, setCountdown] = useState(10);

  const currentIndexRef = useRef(0);
  const totalAccumulatedRef = useRef(0);
  const totalStartedAtRef = useRef<number | null>(null);
  const stepAccumulatedRef = useRef(0);
  const stepStartedAtRef = useRef<number | null>(null);
  const splitsRef = useRef<StepSplit[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentStep = steps[currentIndex];
  const nextStep = steps[currentIndex + 1];
  const currentBlock = template.blocks.find((block) => block.id === currentStep?.blockId);

  function ensureAudio() {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
  }

  function tone(frequency = 880, duration = 0.2, volume = 0.16) {
    const context = audioContextRef.current;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }

  function elapsed(accumulated: number, startedAt: number | null, now: number) {
    return accumulated + (startedAt === null ? 0 : now - startedAt);
  }

  function recordSplit(step: RunnableStep, durationMilliseconds: number) {
    const split: StepSplit = { blockId: step.blockId, stepId: step.stepId, round: step.round, durationSeconds: Math.max(0, Math.round(durationMilliseconds / 1000)) };
    splitsRef.current = [...splitsRef.current, split];
    setSplits(splitsRef.current);
  }

  function beginCountdown() {
    if (!currentStep) return;
    ensureAudio();
    setCountdown(10);
    setMode("countdown");
  }

  function beginRunning() {
    if (mode === "running") return;
    ensureAudio();
    const now = Date.now();
    if (totalStartedAtRef.current === null) totalStartedAtRef.current = now;
    stepStartedAtRef.current = now;
    stepAccumulatedRef.current = 0;
    setStepElapsed(0);
    setPaused(false);
    setMode("running");
    tone(1320, 0.55, 0.24);
  }

  function completeWorkout(now: number) {
    const finalDuration = elapsed(totalAccumulatedRef.current, totalStartedAtRef.current, now);
    totalAccumulatedRef.current = finalDuration;
    totalStartedAtRef.current = null;
    stepStartedAtRef.current = null;
    setTotalElapsed(finalDuration);
    setPaused(false);
    setMode("finished");
    tone(1040, 0.6, 0.22);
  }

  function moveToNextStep(now: number, leftoverMilliseconds = 0) {
    if (currentIndexRef.current >= steps.length - 1) return completeWorkout(now);
    const previous = steps[currentIndexRef.current];
    const nextIndex = currentIndexRef.current + 1;
    const next = steps[nextIndex];
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    stepAccumulatedRef.current = 0;
    stepStartedAtRef.current = null;
    setStepElapsed(0);
    if (previous.blockId !== next.blockId) {
      totalAccumulatedRef.current = elapsed(totalAccumulatedRef.current, totalStartedAtRef.current, now);
      totalStartedAtRef.current = null;
      setTotalElapsed(totalAccumulatedRef.current);
      setMode("block-preview");
      return;
    }
    stepStartedAtRef.current = now - leftoverMilliseconds;
    if (next.durationSeconds) tone(880, 0.18, 0.14);
  }

  function advanceManual() {
    ensureAudio();
    const now = Date.now();
    const step = steps[currentIndexRef.current];
    recordSplit(step, elapsed(stepAccumulatedRef.current, stepStartedAtRef.current, now));
    moveToNextStep(now);
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
    totalAccumulatedRef.current = elapsed(totalAccumulatedRef.current, totalStartedAtRef.current, now);
    stepAccumulatedRef.current = elapsed(stepAccumulatedRef.current, stepStartedAtRef.current, now);
    totalStartedAtRef.current = null;
    stepStartedAtRef.current = null;
    setTotalElapsed(totalAccumulatedRef.current);
    setStepElapsed(stepAccumulatedRef.current);
    setPaused(true);
  }

  useEffect(() => {
    if (mode !== "countdown") return;
    if (countdown <= 0) {
      const startTimer = window.setTimeout(beginRunning, 0);
      return () => window.clearTimeout(startTimer);
    }
    tone(countdown <= 3 ? 1080 : 720, countdown <= 3 ? 0.24 : 0.14, countdown <= 3 ? 0.2 : 0.1);
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, mode]);

  useEffect(() => {
    if (mode !== "running" || paused) return;
    const tick = () => {
      const now = Date.now();
      const total = elapsed(totalAccumulatedRef.current, totalStartedAtRef.current, now);
      let stepTime = elapsed(stepAccumulatedRef.current, stepStartedAtRef.current, now);
      let index = currentIndexRef.current;
      let step = steps[index];
      while (step?.durationSeconds && stepTime >= step.durationSeconds * 1000) {
        recordSplit(step, step.durationSeconds * 1000);
        stepTime -= step.durationSeconds * 1000;
        tone(900, 0.15, 0.14);
        if (index >= steps.length - 1) return completeWorkout(now);
        const next = steps[index + 1];
        if (next.blockId !== step.blockId) {
          currentIndexRef.current = index + 1;
          setCurrentIndex(index + 1);
          stepAccumulatedRef.current = 0;
          stepStartedAtRef.current = null;
          totalAccumulatedRef.current = total;
          totalStartedAtRef.current = null;
          setTotalElapsed(total);
          setStepElapsed(0);
          setMode("block-preview");
          return;
        }
        index += 1;
        step = next;
        currentIndexRef.current = index;
        setCurrentIndex(index);
        stepAccumulatedRef.current = 0;
        stepStartedAtRef.current = now - stepTime;
      }
      setTotalElapsed(total);
      setStepElapsed(stepTime);
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, paused, steps]);

  useEffect(() => {
    if (!["running", "countdown", "block-preview"].includes(mode)) return;
    const preventClose = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventClose);
    return () => window.removeEventListener("beforeunload", preventClose);
  }, [mode]);

  useEffect(() => () => { void audioContextRef.current?.close(); }, []);

  if (mode === "finished") return <WorkoutResultForm template={template} scheduledWorkoutId={scheduledWorkoutId} durationSeconds={Math.max(1, Math.round(totalElapsed / 1000))} splits={splits} />;

  if (mode === "overview") return (
    <main className="min-h-dvh bg-zinc-950 p-5 text-white"><section className="mx-auto w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-7">
      <button onClick={() => router.back()} className="text-sm text-zinc-400">← Zpět</button>
      <p className="mt-8 text-sm font-bold uppercase tracking-[0.22em] text-lime-400">Přehled tréninku</p><h1 className="mt-2 text-4xl font-black">{template.title}</h1><p className="mt-3 leading-6 text-zinc-400">{template.description}</p>
      <div className="mt-6 space-y-3">{template.blocks.map((block, index) => <div key={block.id} className="rounded-2xl bg-zinc-800 p-4"><p className="text-xs font-bold uppercase tracking-wider text-lime-400">Blok {index + 1}</p><h2 className="mt-1 text-lg font-black">{block.title}</h2><p className="mt-1 text-sm text-zinc-400">{block.type === "emom" ? `${block.minutes} min EMOM` : `${block.repeat}× opakovat`}</p></div>)}</div>
      <button type="button" onClick={() => setMode("block-preview")} disabled={steps.length === 0} className="mt-8 w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-black text-zinc-950 disabled:opacity-40">Připravit první blok</button>
    </section></main>
  );

  if (mode === "block-preview" && currentStep && currentBlock) return (
    <main className="min-h-dvh bg-zinc-950 p-5 text-white"><section className="mx-auto w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-7">
      <p className="text-sm font-bold uppercase tracking-[0.22em] text-lime-400">Následuje blok</p><h1 className="mt-2 text-4xl font-black">{currentBlock.title}</h1><p className="mt-2 text-zinc-400">{currentBlock.type === "emom" ? `${currentBlock.minutes} minut` : `${currentBlock.repeat} kol`}</p>
      <ol className="mt-6 space-y-3">{currentBlock.steps.map((step, index) => <li key={step.id} className="flex gap-3 rounded-2xl bg-zinc-800 p-4"><span className="font-black text-lime-400">{index + 1}.</span><div><p className="font-bold">{step.name}</p>{step.detail && <p className="mt-1 text-sm text-zinc-400">{step.detail}</p>}</div></li>)}</ol>
      <div className="mt-6 grid gap-3"><button type="button" onClick={beginCountdown} className="w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-black text-zinc-950">Odpočet 10 s</button><button type="button" onClick={beginRunning} className="w-full rounded-2xl border border-zinc-700 px-5 py-4 font-black text-zinc-100">Začít hned</button></div>
    </section></main>
  );

  if (mode === "countdown" && currentStep) return (
    <main className="grid min-h-dvh place-items-center bg-zinc-950 p-5 text-center text-white"><section className="w-full max-w-sm"><p className="text-sm font-black uppercase tracking-[0.25em] text-lime-400">Připrav se</p><p className="mt-4 text-8xl font-black tabular-nums">{countdown}</p><h1 className="mt-8 text-3xl font-black">{currentStep.name}</h1>{currentStep.detail && <p className="mt-2 text-lg text-zinc-400">{currentStep.detail}</p>}<button type="button" onClick={beginRunning} className="mt-10 w-full rounded-2xl border border-lime-400/40 px-5 py-4 font-black text-lime-300">Přeskočit odpočet</button></section></main>
  );

  if (!currentStep) return null;
  const shownTime = currentStep.durationSeconds ? currentStep.durationSeconds * 1000 - stepElapsed : stepElapsed;
  return (
    <main className="min-h-dvh bg-zinc-950 p-5 text-white"><div className="mx-auto flex min-h-[calc(100dvh-40px)] max-w-md flex-col">
      <header className="grid grid-cols-3 items-center"><button type="button" onClick={() => setShowQuit(true)} className="justify-self-start text-sm text-zinc-400">× Ukončit</button><button type="button" onClick={togglePause} className="justify-self-center rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold">{paused ? "Pokračovat" : "Pauza"}</button><span className="justify-self-end font-mono text-sm text-zinc-300">{formatClock(totalElapsed)}</span></header>
      <section className="flex flex-1 flex-col justify-center py-6 text-center"><p className="text-sm font-black uppercase tracking-[0.22em] text-lime-400">{currentStep.blockTitle}</p><p className="mt-2 text-sm text-zinc-500">{currentStep.emomMinute ? `Minuta ${currentStep.emomMinute} z ${currentStep.emomMinutes}` : currentStep.roundCount > 1 ? `Kolo ${currentStep.round} z ${currentStep.roundCount}` : `Úsek ${currentIndex + 1} z ${steps.length}`}</p><h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl">{currentStep.name}</h1>{currentStep.detail && <p className="mt-4 text-lg leading-7 text-zinc-400">{currentStep.detail}</p>}<div className="mt-10 font-mono text-6xl font-black tracking-tight">{formatClock(shownTime)}</div><p className="mt-3 text-sm text-zinc-500">{paused ? "Časovač je pozastavený" : currentStep.durationSeconds ? "Zbývá v minutě" : "Čas aktuálního úseku"}</p>
      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left"><p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Následuje</p>{nextStep ? <><p className="mt-2 text-lg font-black">{nextStep.blockId === currentStep.blockId ? nextStep.name : `Pauza před blokem ${nextStep.blockTitle}`}</p>{nextStep.blockId === currentStep.blockId && nextStep.detail && <p className="mt-1 text-sm text-zinc-400">{nextStep.detail}</p>}</> : <p className="mt-2 text-lg font-black">Dokončení tréninku</p>}</div>
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-lime-400 transition-[width] duration-200" style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }} /></div></section>
      <button type="button" onClick={advanceManual} disabled={paused} className="w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-black text-zinc-950 transition disabled:opacity-40">{currentIndex === steps.length - 1 ? "Dokončit trénink" : currentStep.durationSeconds ? "Přeskočit minutu →" : "Hotovo →"}</button>
    </div><ConfirmDialog open={showQuit} title="Ukončit trénink?" description="Aktuální čas a mezičasy se neuloží." confirmLabel="Ukončit" destructive onCancel={() => setShowQuit(false)} onConfirm={() => router.push("/")} /></main>
  );
}
