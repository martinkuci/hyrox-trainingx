"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockFeedback, BlockFeedbackRating, StepSplit, WorkoutBlock, WorkoutTemplate } from "@/lib/types";
import BlockFeedbackPrompt from "@/components/BlockFeedbackPrompt";
import ConfirmDialog from "@/components/ConfirmDialog";
import RunnerBrandButton from "@/components/RunnerBrandButton";
import { EnginnWordmark } from "@/components/EnginnBrand";
import WorkoutRecoveryDialog from "@/components/WorkoutRecoveryDialog";
import WorkoutResultForm from "@/components/WorkoutResultForm";
import {
  clearWorkoutCheckpoint,
  loadWorkoutCheckpoint,
  makeWorkoutKey,
  restoreCheckpointRuntime,
  saveWorkoutCheckpoint,
  type CheckpointRunnerMode,
  type WorkoutCheckpoint,
} from "@/lib/workout-checkpoint";
import { countdownCueSecond, flattenWorkoutTemplate, type RunnableStep } from "@/lib/workout-runner-steps";

type RunnerMode = "overview" | "block-preview" | "block-feedback" | "countdown" | "running" | "finished";

type WorkoutRunnerProps = { template: WorkoutTemplate; scheduledWorkoutId?: string };

function formatClock(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}

function elapsedMilliseconds(accumulated: number, startedAt: number | null, now: number) {
  return accumulated + (startedAt === null ? 0 : now - startedAt);
}

function isCheckpointMode(mode: RunnerMode): mode is CheckpointRunnerMode {
  return mode === "block-preview" || mode === "block-feedback" || mode === "countdown" || mode === "running";
}

function LocalSaveStatus({ failed, notice }: { failed: boolean; notice?: string }) {
  return (
    <p className={`mt-4 text-center text-sm ${failed ? "text-amber-300" : "text-zinc-500"}`} role="status">
      {failed ? "Průběh se nepodařilo uložit. Nezavírej aplikaci." : notice ?? "Průběh se automaticky ukládá do tohoto zařízení."}
    </p>
  );
}

function blockSummary(block: WorkoutBlock) {
  switch (block.type) {
    case "manual": return `${block.repeat}× opakovat`;
    case "for-time": return `${block.rounds} kol · odpočinek ${block.restSeconds} s`;
    case "interval": return `${block.rounds} intervalů · ${block.workSeconds}/${block.restSeconds} s`;
    case "tabata": return `TABATA ${block.rounds}× · ${block.workSeconds}/${block.restSeconds} s`;
    case "emom": return `${block.minutes} min EMOM`;
    case "amrap": return `${block.minutes} min AMRAP`;
  }
}

function stepProgressLabel(step: RunnableStep, currentIndex: number, stepCount: number) {
  if (step.emomMinute) return `Minuta ${step.emomMinute} z ${step.emomMinutes}`;
  if (step.mode === "interval" || step.mode === "tabata") return `Interval ${step.round} z ${step.roundCount}`;
  if (step.mode === "amrap") return "Opakuj sestavu dokola";
  if (step.roundCount > 1) return `Kolo ${step.round} z ${step.roundCount}`;
  return `Úsek ${currentIndex + 1} z ${stepCount}`;
}

function stepTimeLabel(step: RunnableStep, paused: boolean) {
  if (paused) return "Časovač je pozastavený";
  if (step.kind === "rest") return step.mode === "interval" || step.mode === "tabata" ? "Zbývá do dalšího intervalu" : "Zbývá do dalšího kola";
  if (step.mode === "amrap") return "Zbývá v AMRAP";
  if (step.mode === "interval" || step.mode === "tabata") return "Zbývá v pracovním intervalu";
  if (step.mode === "emom") return "Zbývá v minutě";
  return "Čas aktuálního úseku";
}

function advanceButtonLabel(step: RunnableStep, isLastStep: boolean) {
  if (isLastStep) return "Dokončit blok →";
  if (step.kind === "rest") return "Přeskočit odpočinek →";
  if (step.mode === "interval" || step.mode === "tabata") return "Přeskočit interval →";
  if (step.mode === "amrap") return "Dokončit AMRAP dříve →";
  if (step.mode === "emom") return "Přeskočit minutu →";
  return "Hotovo →";
}

function WorkoutOutline({ template, activeBlockId }: { template: WorkoutTemplate; activeBlockId?: string }) {
  return (
    <div className="space-y-2">
      {template.blocks.map((block, index) => (
        <details
          key={block.id}
          open={block.id === activeBlockId || undefined}
          className={`group overflow-hidden rounded-2xl border ${block.id === activeBlockId ? "border-accent/40 bg-accent-soft" : "border-white/8 bg-elevated"}`}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-accent">Blok {index + 1}</p>
              <h2 className="mt-0.5 text-lg font-black">{block.title}</h2>
              <p className="mt-0.5 text-xs text-zinc-400">{blockSummary(block)}</p>
            </div>
            <span className="shrink-0 text-2xl text-zinc-400 transition group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <ol className="space-y-2 border-t border-white/8 px-3 py-3">
            {block.steps.map((step, stepIndex) => (
              <li key={step.id} className="flex gap-3 rounded-xl bg-surface px-3 py-2.5">
                <span className="font-black text-accent">{stepIndex + 1}.</span>
                <div>
                  <p className="font-black text-white">{step.name}</p>
                  {step.detail && <p className="mt-0.5 text-sm leading-5 text-zinc-400">{step.detail}</p>}
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
  const steps = useMemo(() => flattenWorkoutTemplate(template), [template]);
  const workoutKey = useMemo(() => makeWorkoutKey(template.id, scheduledWorkoutId), [scheduledWorkoutId, template.id]);
  const [mode, setMode] = useState<RunnerMode>("overview");
  const [paused, setPaused] = useState(false);
  const [countdownPaused, setCountdownPaused] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [resumeAfterOverview, setResumeAfterOverview] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);
  const [splits, setSplits] = useState<StepSplit[]>([]);
  const [blockFeedbacks, setBlockFeedbacks] = useState<BlockFeedback[]>([]);
  const [feedbackBlockId, setFeedbackBlockId] = useState<string>();
  const [feedbackFinishesWorkout, setFeedbackFinishesWorkout] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [recoveryCheckpoint, setRecoveryCheckpoint] = useState<WorkoutCheckpoint | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string>();
  const [checkpointFailed, setCheckpointFailed] = useState(false);

  const currentIndexRef = useRef(0);
  const totalAccumulatedRef = useRef(0);
  const totalStartedAtRef = useRef<number | null>(null);
  const stepAccumulatedRef = useRef(0);
  const stepStartedAtRef = useRef<number | null>(null);
  const splitsRef = useRef<StepSplit[]>([]);
  const blockFeedbacksRef = useRef<BlockFeedback[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastCountdownCueRef = useRef("");
  const checkpointClosedRef = useRef(false);

  const currentStep = steps[currentIndex];
  const nextStep = steps[currentIndex + 1];
  const nextStepInBlock = nextStep?.blockId === currentStep?.blockId ? nextStep : undefined;
  const currentBlock = template.blocks.find((block) => block.id === currentStep?.blockId);
  const workoutStarted = currentIndex > 0 || totalElapsed > 0 || splits.length > 0;

  function ensureAudio() {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
  }

  const tone = useCallback((frequency = 880, duration = 0.2, volume = 0.2, waveform: OscillatorType = "triangle") => {
    const context = audioContextRef.current;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = waveform;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }, []);

  const vibrate = useCallback((pattern: number | number[]) => {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  }, []);

  const countdownCue = useCallback((seconds: number) => {
    const isLastSecond = seconds === 1;
    tone(isLastSecond ? 1440 : 1120, isLastSecond ? 0.34 : 0.25, isLastSecond ? 0.52 : 0.42, "square");
    vibrate(isLastSecond ? [90, 45, 90] : 70);
  }, [tone, vibrate]);

  const transitionCue = useCallback(() => {
    tone(1560, 0.55, 0.55, "square");
    vibrate([110, 55, 110]);
  }, [tone, vibrate]);

  function recordSplit(step: RunnableStep, durationMilliseconds: number) {
    const split: StepSplit = {
      blockId: step.blockId,
      stepId: step.stepId,
      round: step.round,
      durationSeconds: Math.max(0, Math.round(durationMilliseconds / 1000)),
      blockTitle: step.blockTitle,
      stepName: step.name,
      stepDetail: step.detail,
    };
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
    tone(1320, 0.55, 0.34, "square");
  }

  function pauseRunning() {
    const now = Date.now();
    totalAccumulatedRef.current = elapsedMilliseconds(totalAccumulatedRef.current, totalStartedAtRef.current, now);
    stepAccumulatedRef.current = elapsedMilliseconds(stepAccumulatedRef.current, stepStartedAtRef.current, now);
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

  function minimizeWorkout() {
    if (!isCheckpointMode(mode)) return;

    const now = Date.now();
    let savedTotalElapsed = elapsedMilliseconds(totalAccumulatedRef.current, totalStartedAtRef.current, now);
    let savedStepElapsed = elapsedMilliseconds(stepAccumulatedRef.current, stepStartedAtRef.current, now);
    const savedPaused = mode === "running" || mode === "block-feedback" ? true : paused;
    const savedCountdownPaused = mode === "countdown" ? true : countdownPaused;

    if (mode === "running") {
      totalAccumulatedRef.current = savedTotalElapsed;
      stepAccumulatedRef.current = savedStepElapsed;
      totalStartedAtRef.current = null;
      stepStartedAtRef.current = null;
      setTotalElapsed(savedTotalElapsed);
      setStepElapsed(savedStepElapsed);
      setPaused(true);
    } else {
      savedTotalElapsed = totalAccumulatedRef.current;
      savedStepElapsed = stepAccumulatedRef.current;
    }

    if (mode === "countdown") setCountdownPaused(true);

    const saved = saveWorkoutCheckpoint({
      version: 1,
      workoutKey,
      templateId: template.id,
      templateTitle: template.title,
      templateUpdatedAt: template.updatedAt,
      scheduledWorkoutId,
      mode,
      currentIndex: currentIndexRef.current,
      totalElapsedMilliseconds: savedTotalElapsed,
      stepElapsedMilliseconds: savedStepElapsed,
      splits: splitsRef.current,
      blockFeedbacks: blockFeedbacksRef.current,
      feedbackBlockId,
      feedbackFinishesWorkout,
      countdown,
      paused: savedPaused,
      countdownPaused: savedCountdownPaused,
      savedAt: now,
    });
    setCheckpointFailed(!saved);
    if (saved) router.push("/");
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
    const finalDuration = elapsedMilliseconds(totalAccumulatedRef.current, totalStartedAtRef.current, now);
    totalAccumulatedRef.current = finalDuration;
    totalStartedAtRef.current = null;
    stepStartedAtRef.current = null;
    setTotalElapsed(finalDuration);
    setPaused(false);
    checkpointClosedRef.current = true;
    clearWorkoutCheckpoint(workoutKey);
    setMode("finished");
    tone(1040, 0.6, 0.22);
  }

  function openBlockFeedback(blockId: string, finishesWorkout: boolean, now: number) {
    totalAccumulatedRef.current = elapsedMilliseconds(totalAccumulatedRef.current, totalStartedAtRef.current, now);
    totalStartedAtRef.current = null;
    stepAccumulatedRef.current = 0;
    stepStartedAtRef.current = null;
    setTotalElapsed(totalAccumulatedRef.current);
    setStepElapsed(0);
    setPaused(true);
    setFeedbackBlockId(blockId);
    setFeedbackFinishesWorkout(finishesWorkout);
    setMode("block-feedback");
  }

  function leaveBlockFeedback() {
    const finishesWorkout = feedbackFinishesWorkout;
    setFeedbackBlockId(undefined);
    setFeedbackFinishesWorkout(false);
    if (finishesWorkout) completeWorkout(Date.now());
    else setMode("block-preview");
  }

  function rateBlock(rating: BlockFeedbackRating) {
    if (!feedbackBlockId) return;
    const next = [
      ...blockFeedbacksRef.current.filter((feedback) => feedback.blockId !== feedbackBlockId),
      { blockId: feedbackBlockId, rating },
    ];
    blockFeedbacksRef.current = next;
    setBlockFeedbacks(next);
    leaveBlockFeedback();
  }

  function finishWorkoutNow() {
    const now = Date.now();
    const step = steps[currentIndexRef.current];
    const currentStepTime = elapsedMilliseconds(stepAccumulatedRef.current, stepStartedAtRef.current, now);
    if (step && currentStepTime > 0) recordSplit(step, currentStepTime);
    setShowFinish(false);
    setShowOverview(false);
    completeWorkout(now);
  }

  function moveToNextStep(now: number, leftoverMilliseconds = 0) {
    const previous = steps[currentIndexRef.current];
    if (currentIndexRef.current >= steps.length - 1) return openBlockFeedback(previous.blockId, true, now);
    const nextIndex = currentIndexRef.current + 1;
    const next = steps[nextIndex];
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    stepAccumulatedRef.current = 0;
    stepStartedAtRef.current = null;
    setStepElapsed(0);
    if (previous.blockId !== next.blockId) {
      openBlockFeedback(previous.blockId, false, now);
      return;
    }
    stepStartedAtRef.current = now - leftoverMilliseconds;
    if (next.durationSeconds) tone(880, 0.18, 0.14);
  }

  function advanceManual() {
    ensureAudio();
    const now = Date.now();
    const step = steps[currentIndexRef.current];
    recordSplit(step, elapsedMilliseconds(stepAccumulatedRef.current, stepStartedAtRef.current, now));
    moveToNextStep(now);
  }

  function resumeCheckpoint(checkpoint: WorkoutCheckpoint) {
    if (checkpoint.workoutKey !== workoutKey) {
      const scheduleQuery = checkpoint.scheduledWorkoutId
        ? `?scheduleId=${encodeURIComponent(checkpoint.scheduledWorkoutId)}`
        : "";
      router.push(`/workout/${encodeURIComponent(checkpoint.templateId)}${scheduleQuery}`);
      return;
    }

    const restored = restoreCheckpointRuntime(checkpoint);
    const now = restored.restoredAt;
    currentIndexRef.current = restored.currentIndex;
    totalAccumulatedRef.current = restored.totalElapsedMilliseconds;
    stepAccumulatedRef.current = restored.stepElapsedMilliseconds;
    splitsRef.current = restored.splits;
    blockFeedbacksRef.current = restored.blockFeedbacks;
    totalStartedAtRef.current = restored.mode === "running" && !restored.paused ? now : null;
    stepStartedAtRef.current = restored.mode === "running" && !restored.paused ? now : null;
    setCurrentIndex(restored.currentIndex);
    setTotalElapsed(restored.totalElapsedMilliseconds);
    setStepElapsed(restored.stepElapsedMilliseconds);
    setSplits(restored.splits);
    setBlockFeedbacks(restored.blockFeedbacks);
    setFeedbackBlockId(restored.feedbackBlockId);
    setFeedbackFinishesWorkout(restored.feedbackFinishesWorkout);
    setCountdown(restored.countdown);
    setPaused(restored.paused);
    setCountdownPaused(restored.countdownPaused);
    setMode(restored.mode);
    setRecoveryNotice("Trénink byl obnoven z posledního automatického uložení.");
    setRecoveryCheckpoint(null);
    setRecoveryReady(true);
  }

  function startFreshWorkout() {
    clearWorkoutCheckpoint();
    setRecoveryCheckpoint(null);
    setRecoveryReady(true);
    setRecoveryNotice(undefined);
  }

  useEffect(() => {
    const recoveryTimer = window.setTimeout(() => {
      const checkpoint = loadWorkoutCheckpoint();
      if (!checkpoint) {
        setRecoveryReady(true);
        return;
      }

      const isCurrentWorkout = checkpoint.workoutKey === workoutKey;
      const isCompatible = checkpoint.templateUpdatedAt === template.updatedAt
        && checkpoint.currentIndex < steps.length;
      if (isCurrentWorkout && !isCompatible) {
        clearWorkoutCheckpoint(workoutKey);
        setRecoveryNotice("Starší uložený postup nebyl kompatibilní s aktuální verzí tréninku a byl bezpečně odstraněn.");
        setRecoveryReady(true);
        return;
      }

      setRecoveryCheckpoint(checkpoint);
    }, 0);
    return () => window.clearTimeout(recoveryTimer);
  }, [steps.length, template.updatedAt, workoutKey]);

  useEffect(() => {
    if (!recoveryReady || !isCheckpointMode(mode)) return;

    const persist = () => {
      if (checkpointClosedRef.current) return;
      const now = Date.now();
      const saved = saveWorkoutCheckpoint({
        version: 1,
        workoutKey,
        templateId: template.id,
        templateTitle: template.title,
        templateUpdatedAt: template.updatedAt,
        scheduledWorkoutId,
        mode,
        currentIndex: currentIndexRef.current,
        totalElapsedMilliseconds: elapsedMilliseconds(totalAccumulatedRef.current, totalStartedAtRef.current, now),
        stepElapsedMilliseconds: elapsedMilliseconds(stepAccumulatedRef.current, stepStartedAtRef.current, now),
        splits: splitsRef.current,
        blockFeedbacks: blockFeedbacksRef.current,
        feedbackBlockId,
        feedbackFinishesWorkout,
        countdown,
        paused,
        countdownPaused,
        savedAt: now,
      });
      setCheckpointFailed(!saved);
    };

    const persistWhenHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    persist();
    const timer = window.setInterval(persist, 1000);
    document.addEventListener("visibilitychange", persistWhenHidden);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", persistWhenHidden);
    };
  }, [countdown, countdownPaused, feedbackBlockId, feedbackFinishesWorkout, mode, paused, recoveryReady, scheduledWorkoutId, template.id, template.title, template.updatedAt, workoutKey]);

  useEffect(() => {
    if (mode !== "countdown" || countdownPaused) return;
    if (countdown <= 0) {
      const startTimer = window.setTimeout(beginRunning, 0);
      return () => window.clearTimeout(startTimer);
    }
    if (countdown <= 3) countdownCue(countdown);
    else tone(760, 0.16, 0.16);
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, countdownPaused, mode]);

  useEffect(() => {
    if (mode !== "running" || paused) return;
    const tick = () => {
      const now = Date.now();
      const total = elapsedMilliseconds(totalAccumulatedRef.current, totalStartedAtRef.current, now);
      let stepTime = elapsedMilliseconds(stepAccumulatedRef.current, stepStartedAtRef.current, now);
      let index = currentIndexRef.current;
      let step = steps[index];
      while (step?.durationSeconds && stepTime >= step.durationSeconds * 1000) {
        recordSplit(step, step.durationSeconds * 1000);
        stepTime -= step.durationSeconds * 1000;
        transitionCue();
        if (index >= steps.length - 1) return openBlockFeedback(step.blockId, true, now);
        const next = steps[index + 1];
        if (next.blockId !== step.blockId) {
          currentIndexRef.current = index + 1;
          setCurrentIndex(index + 1);
          stepAccumulatedRef.current = 0;
          stepStartedAtRef.current = null;
          totalAccumulatedRef.current = total;
          totalStartedAtRef.current = null;
          openBlockFeedback(step.blockId, false, now);
          return;
        }
        index += 1;
        step = next;
        currentIndexRef.current = index;
        setCurrentIndex(index);
        stepAccumulatedRef.current = 0;
        stepStartedAtRef.current = now - stepTime;
      }
      if (step?.durationSeconds) {
        const cueSecond = countdownCueSecond(step.durationSeconds, stepTime);
        const cueKey = cueSecond ? `${index}:${cueSecond}` : "";
        if (cueSecond && cueKey !== lastCountdownCueRef.current) {
          lastCountdownCueRef.current = cueKey;
          countdownCue(cueSecond);
        }
      }
      setTotalElapsed(total);
      setStepElapsed(stepTime);
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [countdownCue, mode, paused, steps, transitionCue]);

  useEffect(() => () => { void audioContextRef.current?.close(); }, []);

  if (recoveryCheckpoint) return (
    <main className="runner-shell grid min-h-dvh place-items-center px-5 text-white">
      <WorkoutRecoveryDialog
        currentWorkoutTitle={template.title}
        savedWorkoutTitle={recoveryCheckpoint.templateTitle}
        sameWorkout={recoveryCheckpoint.workoutKey === workoutKey}
        onResume={() => resumeCheckpoint(recoveryCheckpoint)}
        onStartFresh={startFreshWorkout}
      />
    </main>
  );

  if (!recoveryReady) return (
    <main className="runner-shell grid min-h-dvh place-items-center text-zinc-400">
      Kontroluji uložený trénink…
    </main>
  );

  if (mode === "finished") return <WorkoutResultForm template={template} scheduledWorkoutId={scheduledWorkoutId} durationSeconds={Math.max(1, Math.round(totalElapsed / 1000))} splits={splits} blockFeedbacks={blockFeedbacks} />;

  if (mode === "block-feedback" && feedbackBlockId) {
    const feedbackBlock = template.blocks.find((block) => block.id === feedbackBlockId);
    if (feedbackBlock) return <BlockFeedbackPrompt blockTitle={feedbackBlock.title} finishesWorkout={feedbackFinishesWorkout} totalTime={formatClock(totalElapsed)} onMinimize={minimizeWorkout} onRate={rateBlock} onSkip={leaveBlockFeedback} />;
  }

  if (mode === "overview") return (
    <main className="runner-shell safe-screen min-h-dvh px-4 text-white">
      <section className="mx-auto w-full max-w-md">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center"><button type="button" onClick={() => workoutStarted ? setMode("block-preview") : router.back()} className="ui-button ui-button-ghost ui-button-sm -ml-3 justify-self-start">← Zpět</button><span role="img" aria-label="Enginn"><EnginnWordmark className="h-[1.05rem] w-auto" /></span><span /></header>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-accent">Přehled tréninku</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">{template.title}</h1>
        <p className="mt-2 text-sm leading-5 text-zinc-400">{template.description}</p>
        <div className="mt-4"><WorkoutOutline template={template} activeBlockId={workoutStarted ? currentStep?.blockId : undefined} /></div>
        <button type="button" onClick={() => setMode("block-preview")} disabled={steps.length === 0} className="ui-button ui-button-primary mt-5 w-full">{workoutStarted ? "Zpět na aktuální blok" : "Připravit první blok"}</button>
        {workoutStarted && <button type="button" onClick={() => setShowFinish(true)} className="ui-button ui-button-ghost mt-2 w-full">Dokončit trénink nyní</button>}
        {recoveryNotice && <LocalSaveStatus failed={checkpointFailed} notice={recoveryNotice} />}
        <ConfirmDialog open={showFinish} title="Dokončit trénink nyní?" description="Uloží se dosavadní čas a hotové úseky. Zbývající části se přeskočí." confirmLabel="Dokončit" onCancel={() => setShowFinish(false)} onConfirm={finishWorkoutNow} />
      </section>
    </main>
  );

  if (mode === "block-preview" && currentStep && currentBlock) return (
    <main className="runner-shell safe-screen min-h-dvh px-4 text-white">
      <section className="mx-auto w-full max-w-md">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center">
          <button type="button" onClick={() => setMode("overview")} className="ui-button ui-button-ghost ui-button-sm -ml-3 justify-self-start">← Přehled</button>
          <RunnerBrandButton onClick={minimizeWorkout} />
          <span className="justify-self-end font-mono text-sm text-zinc-400">{formatClock(totalElapsed)}</span>
        </header>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-accent">Následuje blok</p>
        <div className="mt-1 flex items-end justify-between gap-3"><h1 className="text-3xl font-black">{currentBlock.title}</h1><p className="shrink-0 text-right text-sm text-zinc-500">{blockSummary(currentBlock)}</p></div>
        <ol className="mt-4 space-y-2">{currentBlock.steps.map((step, index) => <li key={step.id} className="ui-inset flex gap-3 px-4 py-3"><span className="font-black text-accent">{index + 1}.</span><div><p className="font-bold">{step.name}</p>{step.detail && <p className="mt-0.5 text-sm leading-5 text-zinc-400">{step.detail}</p>}</div></li>)}</ol>
        <div className="mt-4 grid gap-2"><button type="button" onClick={beginCountdown} className="ui-button ui-button-primary w-full">Odpočet 10 s</button><button type="button" onClick={beginRunning} className="ui-button ui-button-outline w-full">Začít hned</button></div>
        {(checkpointFailed || recoveryNotice) && <LocalSaveStatus failed={checkpointFailed} notice={recoveryNotice} />}
      </section>
    </main>
  );

  if (mode === "countdown" && currentStep) return (
    <main className="runner-shell safe-screen flex min-h-dvh flex-col px-5 text-center text-white">
      <header className="mx-auto grid w-full max-w-md grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button type="button" onClick={() => { setCountdownPaused(false); setCountdown(10); setMode("block-preview"); }} className="ui-button ui-button-ghost ui-button-sm -ml-3 justify-self-start">← Zpět</button>
        <RunnerBrandButton onClick={minimizeWorkout} />
        <span className="justify-self-end text-sm font-semibold text-zinc-500">10 s</span>
      </header>
      <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-accent">{countdownPaused ? "Odpočet stojí" : "Připrav se"}</p>
        <p className="mt-4 text-8xl font-black tabular-nums">{countdown}</p>
        <h1 className="mt-8 text-5xl font-black leading-tight">{currentStep.name}</h1>
        {currentStep.detail && <p className="mt-3 text-2xl font-semibold leading-8 text-zinc-300">{currentStep.detail}</p>}
        <button type="button" onClick={() => setCountdownPaused((value) => !value)} aria-pressed={countdownPaused} className="ui-choice mx-auto mt-7 min-h-11 rounded-full px-5 text-sm">{countdownPaused ? "Pokračovat" : "Pozastavit"}</button>
        <button type="button" onClick={beginRunning} className="ui-button ui-button-outline mt-4 w-full text-lg">Přeskočit odpočet</button>
        {(checkpointFailed || recoveryNotice) && <LocalSaveStatus failed={checkpointFailed} notice={recoveryNotice} />}
      </section>
    </main>
  );

  if (!currentStep) return null;
  const shownTime = currentStep.durationSeconds ? currentStep.durationSeconds * 1000 - stepElapsed : stepElapsed;
  return (
    <main className="runner-shell safe-screen flex h-dvh max-h-dvh flex-col overflow-hidden px-4 text-white">
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button type="button" onClick={openWorkoutOverview} className="ui-button ui-button-ghost ui-button-sm -ml-3 justify-self-start">← Přehled</button>
          <RunnerBrandButton onClick={minimizeWorkout} />
          <span className="justify-self-end font-mono text-sm text-zinc-300">{formatClock(totalElapsed)}</span>
        </header>
        <section className="runner-active-content flex min-h-0 flex-1 flex-col justify-center py-2 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">{currentStep.blockTitle}</p>
          <p className="mt-1 text-sm text-zinc-500">{stepProgressLabel(currentStep, currentIndex, steps.length)}</p>
          <h1 className="runner-main-title mt-3 text-[clamp(2.25rem,10vw,3.75rem)] font-black leading-[0.95]">{currentStep.name}</h1>
          {currentStep.detail && <p className={`runner-step-detail mx-auto mt-2 max-w-sm text-lg font-semibold leading-6 text-zinc-300 ${currentStep.mode === "amrap" ? "max-h-24 overflow-y-auto" : ""}`}>{currentStep.detail}</p>}
          <div className="mt-4 font-mono text-5xl font-black tracking-tight">{formatClock(shownTime)}</div>
          <p className="mt-1 text-sm text-zinc-500">{stepTimeLabel(currentStep, paused)}</p>
          <button type="button" onClick={togglePause} aria-pressed={paused} className="ui-choice mx-auto mt-3 min-h-11 rounded-full px-5 text-sm">{paused ? "Pokračovat" : "Pauza"}</button>
          <div className="runner-next-card ui-inset mt-4 flex items-center justify-between gap-3 px-4 py-3 text-left">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Následuje</p>
              <p className="mt-0.5 font-black leading-5">{nextStepInBlock?.name ?? `Hodnocení bloku ${currentStep.blockTitle}`}</p>
              {nextStepInBlock?.detail && <p className="mt-0.5 truncate text-xs text-zinc-400">{nextStepInBlock.detail}</p>}
            </div>
            <span className="text-accent" aria-hidden="true">→</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }} /></div>
        </section>
        <button type="button" onClick={advanceManual} disabled={paused} className="ui-button ui-button-primary min-h-13 w-full text-lg">{advanceButtonLabel(currentStep, currentIndex === steps.length - 1)}</button>
        {(checkpointFailed || recoveryNotice) && <LocalSaveStatus failed={checkpointFailed} notice={recoveryNotice} />}
      </div>

      {showOverview && (
        <div className="runner-shell fixed inset-0 z-50 overflow-y-auto text-left text-white" role="dialog" aria-modal="true" aria-labelledby="runner-overview-title">
          <div className="safe-screen mx-auto min-h-dvh w-full max-w-md px-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Čas je pozastavený</p>
                <h2 id="runner-overview-title" className="mt-1 text-3xl font-black">Přehled tréninku</h2>
              </div>
              <span className="font-mono text-lg font-black text-zinc-300">{formatClock(totalElapsed)}</span>
            </div>
            <p className="mt-3 text-zinc-400">Aktuální blok je zvýrazněný. Jednotlivé bloky můžeš rozbalit.</p>
            <div className="mt-6"><WorkoutOutline template={template} activeBlockId={currentStep.blockId} /></div>
            <div className="mt-6 grid gap-3">
              <button type="button" onClick={closeWorkoutOverview} className="ui-button ui-button-primary ui-button-lg w-full text-xl">{resumeAfterOverview ? "Zpět a pokračovat" : "Zpět do tréninku"}</button>
              <button type="button" onClick={() => setShowFinish(true)} className="ui-button ui-button-outline w-full">Dokončit trénink nyní</button>
              <button type="button" onClick={() => setShowQuit(true)} className="ui-button ui-button-danger w-full">Zahodit průběh</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={showQuit} title="Zahodit průběh?" description="Lokálně uložený postup, aktuální čas a mezičasy se odstraní bez výsledku." confirmLabel="Zahodit" destructive onCancel={() => setShowQuit(false)} onConfirm={() => { checkpointClosedRef.current = true; clearWorkoutCheckpoint(workoutKey); router.push("/"); }} />
      <ConfirmDialog open={showFinish} title="Dokončit trénink nyní?" description="Uloží se dosavadní čas a hotové úseky. Zbývající části se přeskočí." confirmLabel="Dokončit" onCancel={() => setShowFinish(false)} onConfirm={finishWorkoutNow} />
    </main>
  );
}
