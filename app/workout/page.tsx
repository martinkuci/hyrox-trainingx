"use client";

import { useEffect, useState } from "react";

const exercises = [
  { section: "Warm-up", title: "5 min lehký běh nebo veslo", detail: "Klidné tempo" },
  { section: "Warm-up", title: "2 kola rozcvičení", detail: "Squat · lunge · push-up · plank" },

  { section: "Kolo 1/3", title: "600 m běh", detail: "Tempo přibližně 75–80 %" },
  { section: "Kolo 1/3", title: "10 burpee broad jumps", detail: "Plynule a kontrolovaně" },
  { section: "Kolo 1/3", title: "16 walking lunges", detail: "8 na každou nohu" },
  { section: "Kolo 1/3", title: "12 wall balls", detail: "Zvol udržitelnou váhu" },
  { section: "Kolo 1/3", title: "250 m veslo", detail: "Silné, rovnoměrné tempo" },

  { section: "Kolo 2/3", title: "600 m běh", detail: "Drž stejné tempo" },
  { section: "Kolo 2/3", title: "10 burpee broad jumps", detail: "Plynule a kontrolovaně" },
  { section: "Kolo 2/3", title: "16 walking lunges", detail: "8 na každou nohu" },
  { section: "Kolo 2/3", title: "12 wall balls", detail: "Bez dlouhých pauz" },
  { section: "Kolo 2/3", title: "250 m veslo", detail: "Silné, rovnoměrné tempo" },

  { section: "Kolo 3/3", title: "600 m běh", detail: "Poslední běžecký úsek" },
  { section: "Kolo 3/3", title: "10 burpee broad jumps", detail: "Plynule a kontrolovaně" },
  { section: "Kolo 3/3", title: "16 walking lunges", detail: "8 na každou nohu" },
  { section: "Kolo 3/3", title: "12 wall balls", detail: "Poslední wall balls" },
  { section: "Kolo 3/3", title: "250 m veslo", detail: "Dokonči hlavní část" },

  { section: "EMOM 6", title: "12 kettlebell swings", detail: "1., 3. a 5. minuta" },
  { section: "EMOM 6", title: "10 box step-overs", detail: "2., 4. a 6. minuta" },
  { section: "Cooldown", title: "Vychození a protažení", detail: "3 minuty" },
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

export default function WorkoutPage() {
  const [currentExercise, setCurrentExercise] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [exerciseTime, setExerciseTime] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (finished) return;

    const timer = window.setInterval(() => {
      setTotalTime((time) => time + 1);
      setExerciseTime((time) => time + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finished]);

  function nextExercise() {
    if (currentExercise === exercises.length - 1) {
      setFinished(true);
      return;
    }

    setCurrentExercise((exercise) => exercise + 1);
    setExerciseTime(0);
  }

  const exercise = exercises[currentExercise];

  if (finished) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-5 text-white">
        <section className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-7 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-lime-400">
            Trénink dokončen
          </p>
          <h1 className="mt-4 text-5xl font-bold">{formatTime(totalTime)}</h1>
          <p className="mt-3 text-zinc-400">Celkový čas tréninku</p>

          <a
            href="/"
            className="mt-8 block rounded-2xl bg-lime-400 px-5 py-4 font-bold text-zinc-950"
          >
            Zpět na přehled
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-5 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col">
        <header className="flex items-center justify-between">
          <a href="/" className="text-zinc-400">
            ← Ukončit
          </a>
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

          <p className="mt-4 text-lg text-zinc-400">{exercise.detail}</p>

          <div className="mt-10 font-mono text-6xl font-bold">
            {formatTime(exerciseTime)}
          </div>

          <p className="mt-3 text-sm text-zinc-500">
            Cvik {currentExercise + 1} z {exercises.length}
          </p>
        </section>

        <button
          onClick={nextExercise}
          className="w-full rounded-2xl bg-lime-400 px-5 py-5 text-xl font-bold text-zinc-950"
        >
          {currentExercise === exercises.length - 1
            ? "Dokončit trénink"
            : "Hotovo →"}
        </button>
      </div>
    </main>
  );
}