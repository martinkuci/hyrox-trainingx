"use client";

import { useState } from "react";

type WorkoutResultProps = {
  totalTime: number;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

export default function WorkoutResult({
  totalTime,
}: WorkoutResultProps) {
  const [rpe, setRpe] = useState(0);
  const [weights, setWeights] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  function saveResult() {
    const storedResults = localStorage.getItem("hyrox-results");
    const previousResults = storedResults
      ? JSON.parse(storedResults)
      : [];

    const result = {
      id: crypto.randomUUID(),
      workoutId: "hyrox-02",
      workoutName: "HYROX 02",
      completedAt: new Date().toISOString(),
      durationSeconds: totalTime,
      rpe,
      weights,
      notes,
    };

    localStorage.setItem(
      "hyrox-results",
      JSON.stringify([result, ...previousResults])
    );

    setSaved(true);
  }

  if (saved) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-5 text-white">
        <section className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-7 text-center">
          <div className="text-5xl">✓</div>

          <h1 className="mt-5 text-3xl font-bold">
            Výsledek uložen
          </h1>

          <p className="mt-3 text-zinc-400">
            Trénink najdeš v historii.
          </p>

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
      <section className="mx-auto max-w-md">
        <p className="text-sm font-semibold uppercase tracking-widest text-lime-400">
          Trénink dokončen
        </p>

        <h1 className="mt-3 text-5xl font-bold">
          {formatTime(totalTime)}
        </h1>

        <p className="mt-2 text-zinc-400">Celkový čas</p>

        <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <label className="text-lg font-semibold">
            Náročnost RPE
          </label>

          <p className="mt-1 text-sm text-zinc-400">
            1 = velmi lehké, 10 = maximum
          </p>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, index) => {
              const value = index + 1;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRpe(value)}
                  className={`rounded-xl py-3 font-bold ${
                    rpe === value
                      ? "bg-lime-400 text-zinc-950"
                      : "bg-zinc-800 text-white"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>

          <label className="mt-7 block font-semibold">
            Použité váhy
          </label>

          <input
            value={weights}
            onChange={(event) => setWeights(event.target.value)}
            placeholder="Např. wall ball 9 kg, KB 24 kg"
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-lime-400"
          />

          <label className="mt-6 block font-semibold">
            Poznámka
          </label>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Co bylo nejtěžší? Jak ses cítil?"
            rows={4}
            className="mt-2 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-lime-400"
          />

          <button
            type="button"
            onClick={saveResult}
            disabled={rpe === 0}
            className="mt-7 w-full rounded-2xl bg-lime-400 px-5 py-4 font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Uložit výsledek
          </button>
        </div>
      </section>
    </main>
  );
}