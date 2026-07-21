"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StepSplit, WorkoutBlock, WorkoutTemplate } from "@/lib/types";
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

function blockSummary(block: WorkoutBlock) {
  return block.type === "emom" ? `${block.minutes} min EMOM` : `${block.repeat}× opakovat`;
}

function WorkoutOutline({ template, activeBlockId }: { template: WorkoutTemplate; activeBlockId?: string }) {
  return (
    <div className="space-y-3">
      {template.blocks.map((block, index) => (
        <details
          key={block.id}
          open={block.id === activeBlockId || undefined}
          className={`group overflow-hidden rounded-2xl border ${block.id === activeBlockId ? "border-lime-400/50 bg-lime-400/5" : "border-transparent bg-zinc-800"}`}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-lime-400">Blok {index + 1}</p>
              <h2 className="mt-1 text-xl font-black">{block.title}</h2>
              <p className="mt-1 text-sm text-zinc-400">{blockSummary(block)}</p>
            </div>
            <span className="shrink-0 text-2xl text-zinc-400 transition group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <ol className="space-y-2 border-t border-zinc-700/70 px-4 py-4">
            {block.steps.map((step, stepIndex) => (
              <li key={step.id} className="flex gap-3 rounded-xl bg-zinc-900/70 p-3">
                <span className="font-black text-lime-400">{stepIndex + 1}.</span>
                <div>
                  <p className="text-lg font-black text-white">{step.name}</p>
                  {step.detail && <p className="mt-1 text-base leading-6 text-zinc-300">{step.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

export default function WorkoutRunner({ template, scheduledWorkoutId }: WorkoutRunnerProps) {
  const router = useRouter();
  const steps = useMemo(() => flattenTemplate(template), [template]);
  const [mode, setMode] = useState<RunnerMode>("overview");
  const [paused, setPaused] = useState(false);
  const [countdownPaused, setCountdownPaused] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [resumeAfterOverview, setResumeAfterOverview] = useState(false);
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
  const workoutStarted = currentIndex > 0 || totalElapsed > 0 || splits.length > 0;

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
    setCountdownPaused(false);
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
    setCountdownPaused(false);
    setMode("running");
    tone(1320, 0.55, 0.24);
  }

  function pauseRunning() {
    const now = Date.now();
    totalAccumulatedRef.current = elapsed(totalAccumulatedRef.current, totalStartedAtRef.current, now);
    stepAccumulatedRef.current = elapsed(stepAccumulatedRef.current, stepStartedAtRef.current, now);
    totalStartedAtRef.current = null;
    stepStartedAtRef.current = null;
    setTotalElapsed(totalAccumulatedRef.current);
    setStepElapsed(stepAccumulatedRef.current);
    setPaused(true);
  }

  function resumeRunning() {
    const now = Date.now();
    totalStartedAtRef.current = now;
    stepStartedAtRef.current = now;
    setPaused(false);
  }

  function togglePause() {
    ensureAudio();
    if (paused) resumeRunning();
    else pauseRunning();
  }

  function openWorkoutOverview() {
    const shouldResume = mode === "running" && !paused;
    if (shouldResume) pauseRunning();
    setResumeAfterOverview(shouldResume);
    setShowOverview(true);
  }

  function closeWorkoutOverview() {
    setShowOverview(false);
    if (resumeAfterOverview && mode === "running") resumeRunning();
    setResumeAfterOverview(false);
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

  useEffect(() => {
    if (mode !== "countdown" || countdownPaused) return;
    if (countdown <= 0) {
      const startTimer = window.setTimeout(beginRunning, 0);
      return () => window.clearTimeout(startTimer);
    }
    tone(countdown <= 3 ? 1080 : 720, countdown <= 3 ? 0.24 : 0.14, countdown <= 3 ? 0.2 : 0.1);
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, countdownPaused, mode]);

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
    <main className="safe-screen min-h-dvh bg-zinc-950 px-5 text-white">
      <section className="mx-auto w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 sm:p-7">
        <button onClick={() => workoutStarted ? setMode("block-preview") : router.back()} className="min-h-11 rounded-xl pr-4 text-base font-semibold text-zinc-300">← Zpět</button>
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.22em] text-lime-400">Přehled tréninku</p>
        <h1 className="mt-2 text-4xl font-black">{template.title}</h1>
        <p className="mt-3 leading-6 text-zinc-400">{template.description}</p>
        <div className="mt-6"><WorkoutOutline template={template} activeBlockId={workoutStarted ? currentStep?.blockId : undefined} /></div>
        <button type="button" onClick={() => setMode("block-preview")} disabled={steps.length === 0} className="mt-8 w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-black text-zinc-950 disabled:opacity-40">{workoutStarted ? "Zpět na aktuální blok" : "Připravit první blok"}</button>
      </section>
    </main>
  );

  if (mode === "block-preview" && currentStep && currentBlock) return (
    <main className="safe-screen min-h-dvh bg-zinc-950 px-5 text-white">
      <section className="mx-auto w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 sm:p-7">
        <button type="button" onClick={() => setMode("overview")} className="min-h-11 rounded-xl pr-4 text-base font-semibold text-zinc-300">← Celý trénink</button>
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.22em] text-lime-400">Následuje blok</p>
        <h1 className="mt-2 text-4xl font-black">{currentBlock.title}</h1>
        <p className="mt-2 text-lg text-zinc-400">{currentBlock.type === "emom" ? `${currentBlock.minutes} minut` : `${currentBlock.repeat} kol`}</p>
        <ol className="mt-6 space-y-3">{currentBlock.steps.map((step, index) => <li key={step.id} className="flex gap-3 rounded-2xl bg-zinc-800 p-4"><span className="text-lg font-black text-lime-400">{index + 1}.</span><div><p className="text-xl font-bold">{step.name}</p>{step.detail && <p className="mt-1 text-base leading-6 text-zinc-300">{step.detail}</p>}</div></li>)}</ol>
        <div className="mt-6 grid gap-3"><button type="button" onClick={beginCountdown} className="w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-black text-zinc-950">Odpočet 10 s</button><button type="button" onClick={beginRunning} className="w-full rounded-2xl border border-zinc-700 px-5 py-4 text-lg font-black text-zinc-100">Začít hned</button></div>
      </section>
    </main>
  );

  if (mode === "countdown" && currentStep) return (
    <main className="safe-screen flex min-h-dvh flex-col bg-zinc-950 px-5 text-center text-white">
      <header className="mx-auto grid w-full max-w-md grid-cols-3 items-center gap-2">
        <button type="button" onClick={() => { setCountdownPaused(false); setCountdown(10); setMode("block-preview"); }} className="min-h-11 justify-self-start rounded-xl pr-3 text-left text-base font-semibold text-zinc-300">← Zpět</button>
        <button type="button" onClick={() => setCountdownPaused((value) => !value)} aria-pressed={countdownPaused} className="min-h-11 justify-self-center rounded-full bg-zinc-800 px-4 text-sm font-bold text-white">{countdownPaused ? "Pokračovat" : "Pozastavit"}</button>
        <span className="justify-self-end text-sm font-semibold text-zinc-500">10 s</span>
      </header>
      <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-lime-400">{countdownPaused ? "Odpočet stojí" : "Připrav se"}</p>
        <p className="mt-4 text-8xl font-black tabular-nums">{countdown}</p>
        <h1 className="mt-8 text-5xl font-black leading-tight">{currentStep.name}</h1>
        {currentStep.detail && <p className="mt-3 text-2xl font-semibold leading-8 text-zinc-300">{currentStep.detail}</p>}
        <button type="button" onClick={beginRunning} className="mt-10 w-full rounded-2xl border border-lime-400/40 px-5 py-4 text-lg font-black text-lime-300">Přeskočit odpočet</button>
      </section>
    </main>
  );

  if (!currentStep) return null;
  const shownTime = currentStep.durationSeconds ? currentStep.durationSeconds * 1000 - stepElapsed : stepElapsed;
  return (
    <main className="safe-screen flex min-h-dvh flex-col bg-zinc-950 px-5 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button type="button" onClick={openWorkoutOverview} className="min-h-11 justify-self-start rounded-xl pr-3 text-left text-base font-semibold text-zinc-300">← Přehled</button>
          <button type="button" onClick={togglePause} aria-pressed={paused} className="min-h-11 justify-self-center rounded-full bg-zinc-800 px-4 text-sm font-semibold">{paused ? "Pokračovat" : "Pauza"}</button>
          <span className="justify-self-end font-mono text-base text-zinc-300">{formatClock(totalElapsed)}</span>
        </header>
        <section className="flex flex-1 flex-col justify-center py-6 text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-400">{currentStep.blockTitle}</p>
          <p className="mt-2 text-base text-zinc-500">{currentStep.emomMinute ? `Minuta ${currentStep.emomMinute} z ${currentStep.emomMinutes}` : currentStep.roundCount > 1 ? `Kolo ${currentStep.round} z ${currentStep.roundCount}` : `Úsek ${currentIndex + 1} z ${steps.length}`}</p>
          <h1 className="mt-6 text-5xl font-black leading-none sm:text-6xl">{currentStep.name}</h1>
          {currentStep.detail && <p className="mt-4 text-2xl font-semibold leading-8 text-zinc-300">{currentStep.detail}</p>}
          <div className="mt-9 font-mono text-6xl font-black tracking-tight">{formatClock(shownTime)}</div>
          <p className="mt-3 text-base text-zinc-500">{paused ? "Časovač je pozastavený" : currentStep.durationSeconds ? "Zbývá v minutě" : "Čas aktuálního úseku"}</p>
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-500">Následuje</p>
            {nextStep ? <><p className="mt-2 text-2xl font-black leading-tight">{nextStep.blockId === currentStep.blockId ? nextStep.name : `Pauza před blokem ${nextStep.blockTitle}`}</p>{nextStep.blockId === currentStep.blockId && nextStep.detail && <p className="mt-2 text-lg leading-7 text-zinc-300">{nextStep.detail}</p>}</> : <p className="mt-2 text-2xl font-black">Dokončení tréninku</p>}
          </div>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-lime-400 transition-[width] duration-200" style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }} /></div>
        </section>
        <button type="button" onClick={advanceManual} disabled={paused} className="w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-black text-zinc-950 transition disabled:opacity-40">{currentIndex === steps.length - 1 ? "Dokončit trénink" : currentStep.durationSeconds ? "Přeskočit minutu →" : "Hotovo →"}</button>
      </div>

      {showOverview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950 text-left text-white" role="dialog" aria-modal="true" aria-labelledby="runner-overview-title">
          <div className="safe-screen mx-auto min-h-dvh w-full max-w-md px-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Čas je pozastavený</p>
                <h2 id="runner-overview-title" className="mt-1 text-3xl font-black">Přehled tréninku</h2>
              </div>
              <span className="font-mono text-lg font-black text-zinc-300">{formatClock(totalElapsed)}</span>
            </div>
            <p className="mt-3 text-zinc-400">Aktuální blok je zvýrazněný. Jednotlivé bloky můžeš rozbalit.</p>
            <div className="mt-6"><WorkoutOutline template={template} activeBlockId={currentStep.blockId} /></div>
            <div className="mt-6 grid gap-3">
              <button type="button" onClick={closeWorkoutOverview} className="w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-black text-zinc-950">{resumeAfterOverview ? "Zpět a pokračovat" : "Zpět do tréninku"}</button>
              <button type="button" onClick={() => setShowQuit(true)} className="w-full rounded-2xl border border-red-500/30 px-5 py-4 font-bold text-red-300">Ukončit trénink</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={showQuit} title="Ukončit trénink?" description="Aktuální čas a mezičasy se neuloží." confirmLabel="Ukončit" destructive onCancel={() => setShowQuit(false)} onConfirm={() => router.push("/")} />
    </main>
  );
}
