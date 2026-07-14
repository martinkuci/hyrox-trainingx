"use client";

import { useEffect, useState } from "react";

type WorkoutResult = {
  id: string;
  workoutId: string;
  workoutName: string;
  completedAt: string;
  durationSeconds: number;
  rpe: number;
  weights: string;
  notes: string;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

export default function HistoryPage() {
  const [results, setResults] = useState<WorkoutResult[] | null>(null);

  useEffect(() => {
    const storedResults = localStorage.getItem("hyrox-results");

    if (!storedResults) {
      setResults([]);
      return;
    }

    try {
      setResults(JSON.parse(storedResults));
    } catch {
      setResults([]);
    }
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 p-5 text-white">
      <div className="mx-auto max-w-md">
        <header className="mb-8">
          <a href="/" className="text-zinc-400">
            ← Zpět
          </a>

          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.25em] text-lime-400">
            HYROX Training
          </p>

          <h1 className="mt-2 text-4xl font-bold">Historie</h1>
        </header>

        {results === null && (
          <p className="text-zinc-400">Načítám výsledky…</p>
        )}

        {results?.length === 0 && (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-7 text-center">
            <div className="text-4xl">📊</div>
            <h2 className="mt-4 text-xl font-bold">
              Zatím žádné výsledky
            </h2>
            <p className="mt-2 text-zinc-400">
              Dokončený trénink se zobrazí tady.
            </p>
          </section>
        )}

        <div className="space-y-4">
          {results?.map((result) => (
            <article
              key={result.id}
              className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-lime-400">
                    {new Intl.DateTimeFormat("cs-CZ", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(result.completedAt))}
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {result.workoutName}
                  </h2>
                </div>

                <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm">
                  RPE {result.rpe}
                </span>
              </div>

              <div className="mt-5 rounded-2xl bg-zinc-800 p-4">
                <p className="text-sm text-zinc-400">Celkový čas</p>
                <p className="mt-1 font-mono text-3xl font-bold">
                  {formatTime(result.durationSeconds)}
                </p>
              </div>

              {result.weights && (
                <div className="mt-4">
                  <p className="text-sm text-zinc-500">Použité váhy</p>
                  <p className="mt-1">{result.weights}</p>
                </div>
              )}

              {result.notes && (
                <div className="mt-4">
                  <p className="text-sm text-zinc-500">Poznámka</p>
                  <p className="mt-1 text-zinc-300">{result.notes}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}