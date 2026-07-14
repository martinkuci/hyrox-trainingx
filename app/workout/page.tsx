"use client";

import { useEffect, useState } from "react";
import WorkoutResult from "./WorkoutResult";

type Exercise = {
  section: string;
  title: string;
  detail: string;
  duration?: number;
  autoAdvance?: boolean;
};

const exercises: Exercise[] = [
  { section: "Warm-up", title: "5 min lehký běh nebo veslo", detail: "Klidné tempo" },
  { section: "Warm-up", title: "2 kola rozcvičení", detail: "Squat · lunge · push-up · plank" },

  ...[1, 2, 3].flatMap((round) => [
    {
      section: `Kolo ${round}/3`,
      title: "600 m běh",
      detail: "Tempo přibližně 75–80 %",
    },
    {
      section: `Kolo ${round}/3`,
      title: "10 burpee broad jumps",
      detail: "Plynule a kontrolovaně",
    },
    {
      section: `Kolo ${round}/3`,
      title: "16 walking lunges",
      detail: "8 na každou nohu",
    },
    {
      section: `Kolo ${round}/3`,
      title: "12 wall balls",
      detail: "Zvol udržitelnou váhu",
    },
    {
      section: `Kolo ${round}/3`,
      title: "250 m veslo",
      detail: "Silné a rovnoměrné tempo",
    },
  ]),

  ...Array.from({ length: 6 }, (_, minute) => ({
    section: `EMOM ${minute + 1}/6`,
    title:
      minute % 2 === 0
        ? "12 kettlebell swings"
        : "10 box step-overs",
    detail: "Další cvik se zobrazí automaticky",
    duration: 60,
    autoAdvance: true,
  })),

  {
    section: "Cooldown",
    title: "Vychození a protažení",
    detail: "3 minuty",
  },
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

function playBeep() {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.frequency.value = 880;
    gain.gain.value = 0.15;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
    oscillator.onended = () => audioContext.close();
  } catch {
    // Pokud prohlížeč zvuk nepovolí, časovač pokračuje bez něj.
  }
}

export default function WorkoutPage() {
  const [currentExercise, setCurrentExercise] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [exerciseTime, setExerciseTime] = useState(0);
  const [finished, setFinished] = useState(false);
  const [paused, setPaused] = useState(false);

  const exercise = exercises[currentExercise];

  useEffect(() => {
    if (finished || paused) return;

    const timer = window.setInterval(() => {
      setTotalTime((time) => time + 1);
      setExerciseTime((time) => time + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finished, paused]);

  useEffect(() => {
    if (
      !exercise.autoAdvance ||
      !exercise.duration ||
      exerciseTime < exercise.duration
    ) {
      return;
    }

    playBeep();
    setExerciseTime(0);

    if (currentExercise === exercises.length - 1) {
      setFinished(true);
    } else {
      setCurrentExercise((current) => current + 1);
    }
  }, [exercise, exerciseTime, currentExercise]);

  function nextExercise() {
    if (currentExercise === exercises.length - 1) {
      setFinished(true);
      return;
    }

    const nextExerciseNumber = currentExercise + 1;

    if (exercises[nextExerciseNumber].autoAdvance) {
      playBeep();
    }

    setCurrentExercise(nextExerciseNumber);
    setExerciseTime(0);
  }

  const displayedExerciseTime =
    exercise.autoAdvance && exercise.duration
      ? Math.max(exercise.duration - exerciseTime, 0)
      : exerciseTime;

 if (finished) {
  return <WorkoutResult totalTime={totalTime} />;
}

  return (
    <main className="min-h-screen bg-zinc-950 p-5 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col">
        <header className="flex items-center justify-between">
          <a href="/" className="text-zinc-400">
            ← Ukončit
          </a>

          <button
            onClick={() => setPaused((value) => !value)}
            className="rounded-full bg-zinc-800 px-4 py-2 text-sm"
          >
            {paused ? "Pokračovat" : "Pozastavit"}
          </button>

          <span className="font-mono text-zinc-300">
            {formatTime(totalTime)}
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-lime-400">
            {exercise.section}
          </p>

          <h1 className="mt-5 text-4xl font-bold leading-tight">
            {exercise.title}
          </h1>

          <p className="mt-4 text-lg text-zinc-400">
            {paused ? "Časovač je pozastavený" : exercise.detail}
          </p>

          <div className="mt-10 font-mono text-6xl font-bold">
            {formatTime(displayedExerciseTime)}
          </div>

          <p className="mt-3 text-sm text-zinc-500">
            {exercise.autoAdvance ? "Zbývá v minutě" : "Čas aktuálního cviku"}
          </p>

          <p className="mt-2 text-sm text-zinc-600">
            Cvik {currentExercise + 1} z {exercises.length}
          </p>
        </section>

        <button
          onClick={nextExercise}
          className="w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-bold text-zinc-950"
        >
          {exercise.autoAdvance
            ? "Přeskočit minutu →"
            : currentExercise === exercises.length - 1
              ? "Dokončit trénink"
              : "Hotovo →"}
        </button>
      </div>
    </main>
  );
}