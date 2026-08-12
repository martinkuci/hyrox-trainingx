"use client";

import { useEffect, useRef } from "react";

type Props = {
  currentWorkoutTitle: string;
  savedWorkoutTitle: string;
  sameWorkout: boolean;
  onResume: () => void;
  onStartFresh: () => void;
};

export default function WorkoutRecoveryDialog({
  currentWorkoutTitle,
  savedWorkoutTitle,
  sameWorkout,
  onResume,
  onStartFresh,
}: Props) {
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <section
        aria-describedby="workout-recovery-description"
        aria-labelledby="workout-recovery-title"
        aria-modal="true"
        className="ui-card w-full max-w-sm p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
        role="dialog"
      >
        <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 12a7 7 0 1 0 2.05-4.95M5 5v7h7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Lokálně uloženo</p>
        <h2 id="workout-recovery-title" className="mt-2 text-2xl font-black tracking-tight">
          {sameWorkout ? "Pokračovat v tréninku?" : "Jiný trénink je rozpracovaný"}
        </h2>
        <p id="workout-recovery-description" className="mt-3 leading-6 text-zinc-400">
          {sameWorkout
            ? `Našli jsme uložený postup pro „${savedWorkoutTitle}“. Můžeš navázat od posledního kroku.`
            : `Nejdřív dokonči „${savedWorkoutTitle}“, nebo jeho uložený postup zahoď a začni „${currentWorkoutTitle}“.`}
        </p>
        <div className="mt-7 grid gap-3">
          <button ref={resumeRef} type="button" onClick={onResume} className="ui-button ui-button-primary ui-button-lg w-full">
            {sameWorkout ? "Pokračovat" : "Otevřít rozpracovaný trénink"}
          </button>
          <button type="button" onClick={onStartFresh} className="ui-button ui-button-outline w-full">
            {sameWorkout ? "Začít znovu" : "Zahodit postup a začít nový"}
          </button>
        </div>
      </section>
    </div>
  );
}
