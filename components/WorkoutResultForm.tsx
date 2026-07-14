"use client";

import Link from "next/link";
import { useState } from "react";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { StepSplit, WorkoutTemplate } from "@/lib/types";

type WorkoutResultFormProps = {
  template: WorkoutTemplate;
  scheduledWorkoutId?: string;
  durationSeconds: number;
  splits: StepSplit[];
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export default function WorkoutResultForm({
  template,
  scheduledWorkoutId,
  durationSeconds,
  splits,
}: WorkoutResultFormProps) {
  const { addResult, updateScheduledWorkout } = useHyroxData();
  const [rpe, setRpe] = useState(7);
  const [weights, setWeights] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  function save() {
    addResult({
      templateId: template.id,
      workoutTitle: template.title,
      scheduledWorkoutId,
      completedAt: new Date().toISOString(),
      durationSeconds,
      rpe,
      weights: weights.trim(),
      notes: notes.trim(),
      splits,
    });

    if (scheduledWorkoutId) {
      updateScheduledWorkout(scheduledWorkoutId, { status: "completed" });
    }

    setSaved(true);
  }

  if (saved) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-950 p-5 text-white">
        <section className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-7 text-center shadow-2xl">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-lime-400 text-3xl font-black text-zinc-950">
            ✓
          </div>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-lime-400">
            Hotovo
          </p>
          <h1 className="mt-2 text-3xl font-bold">Výsledek je uložený</h1>
          <p className="mt-3 text-zinc-400">
            Výkon najdeš v historii a plánovaný trénink je označený jako dokončený.
          </p>
          <div className="mt-8 grid gap-3">
            <Link
              href="/history"
              className="rounded-2xl bg-lime-400 px-5 py-4 font-bold text-zinc-950"
            >
              Zobrazit historii
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-zinc-700 px-5 py-4 font-semibold text-zinc-200"
            >
              Zpět na přehled
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-zinc-950 px-5 py-8 text-white">
      <section className="mx-auto max-w-md">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-lime-400">
          Trénink dokončen
        </p>
        <h1 className="mt-2 text-3xl font-bold">{template.title}</h1>

        <div className="mt-6 rounded-3xl border border-lime-400/20 bg-lime-400/10 p-6">
          <p className="text-sm text-lime-200">Celkový čas</p>
          <p className="mt-1 font-mono text-5xl font-black tracking-tight">
            {formatDuration(durationSeconds)}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {splits.length} zaznamenaných úseků
          </p>
        </div>

        <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <fieldset>
            <legend className="text-lg font-bold">Jak náročné to bylo?</legend>
            <p className="mt-1 text-sm text-zinc-400">RPE 1 = velmi lehké, 10 = maximum</p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={rpe === value}
                  onClick={() => setRpe(value)}
                  className={`rounded-xl py-3 font-bold transition ${
                    rpe === value
                      ? "bg-lime-400 text-zinc-950"
                      : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-7 block font-semibold" htmlFor="weights">
            Použité váhy
          </label>
          <input
            id="weights"
            value={weights}
            onChange={(event) => setWeights(event.target.value)}
            placeholder="Např. wall ball 9 kg, KB 24 kg"
            className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 outline-none placeholder:text-zinc-500 focus:border-lime-400"
          />

          <label className="mt-6 block font-semibold" htmlFor="notes">
            Poznámka
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Co bylo nejtěžší? Jak ses cítil?"
            rows={4}
            className="mt-2 w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 outline-none placeholder:text-zinc-500 focus:border-lime-400"
          />

          <button
            type="button"
            onClick={save}
            className="mt-7 w-full rounded-2xl bg-lime-400 px-5 py-4 text-lg font-bold text-zinc-950 transition hover:bg-lime-300"
          >
            Uložit výsledek
          </button>
        </div>
      </section>
    </main>
  );
}

