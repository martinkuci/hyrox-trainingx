"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { WorkoutResult } from "@/lib/types";

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  const parts = hours > 0 ? [hours, minutes, remaining] : [minutes, remaining];
  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}

export default function HistoryPage() {
  const { data, ready, deleteResult } = useHyroxData();
  const [pendingDelete, setPendingDelete] = useState<WorkoutResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const results = useMemo(
    () => [...data.results].sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    [data.results],
  );

  function describeSplit(result: WorkoutResult, blockId: string, stepId: string, round: number) {
    const template = data.templates.find((item) => item.id === result.templateId);
    const block = template?.blocks.find((item) => item.id === blockId);
    const step = block?.steps.find((item) => item.id === stepId);
    return {
      blockTitle: block?.title ?? "Neznámý blok",
      stepTitle: step?.name ?? "Neznámý cvik",
      detail: step?.detail ?? "",
      round,
      isEmom: block?.type === "emom",
    };
  }

  return (
    <main className="min-h-dvh bg-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm text-zinc-400">← Zpět</Link>
        <p className="mt-9 text-sm font-black uppercase tracking-[0.22em] text-lime-400">HYROX Training</p>
        <h1 className="mt-2 text-4xl font-black">Historie</h1>
        <p className="mt-2 text-zinc-400">Výsledky a mezičasy tvých tréninků.</p>

        {!ready && <p className="mt-10 text-zinc-400">Načítám výsledky…</p>}

        {ready && results.length === 0 && (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="text-4xl">◷</div>
            <h2 className="mt-4 text-xl font-bold">Zatím žádné výsledky</h2>
            <p className="mt-2 text-zinc-400">Dokončený trénink se zobrazí tady.</p>
            <Link href="/" className="mt-7 block rounded-2xl bg-lime-400 px-5 py-4 font-bold text-zinc-950">Vybrat trénink</Link>
          </section>
        )}

        <div className="mt-8 space-y-4">
          {results.map((result) => {
            const expanded = expandedId === result.id;
            return (
              <article key={result.id} className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-lime-400">{new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.completedAt))}</p>
                      <h2 className="mt-1 text-2xl font-black">{result.workoutTitle}</h2>
                    </div>
                    <span className="shrink-0 rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-semibold">RPE {result.rpe}</span>
                  </div>

                  <div className="mt-5 flex items-end justify-between rounded-2xl bg-zinc-800 p-4">
                    <div><p className="text-sm text-zinc-400">Celkový čas</p><p className="mt-1 font-mono text-3xl font-black">{formatDuration(result.durationSeconds)}</p></div>
                    <span className="text-sm text-zinc-500">{result.splits.length} úseků</span>
                  </div>

                  {result.weights && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Váhy</p><p className="mt-1 text-zinc-200">{result.weights}</p></div>}
                  {result.notes && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Poznámka</p><p className="mt-1 whitespace-pre-wrap text-zinc-300">{result.notes}</p></div>}

                  <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
                    <button type="button" onClick={() => setExpandedId(expanded ? null : result.id)} className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200">{expanded ? "Skrýt mezičasy" : "Zobrazit mezičasy"}</button>
                    <button type="button" aria-label="Smazat výsledek" onClick={() => setPendingDelete(result)} className="rounded-xl border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-300">Smazat</button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-zinc-800 bg-zinc-950/50 px-6 py-5">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Mezičasy</h3>
                    {result.splits.length === 0 ? (
                      <p className="mt-3 text-sm text-zinc-500">Bez zaznamenaných mezičasů.</p>
                    ) : (
                      <ol className="mt-3 space-y-2">
                        {result.splits.map((split, index) => {
                          const info = describeSplit(result, split.blockId, split.stepId, split.round);
                          return (
                            <li key={`${split.blockId}-${split.stepId}-${split.round}-${index}`} className="rounded-xl bg-zinc-900 px-4 py-3 text-sm">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wider text-lime-400">{info.blockTitle}</p>
                                  <p className="mt-1 font-bold text-zinc-100">{info.stepTitle}</p>
                                  <p className="mt-1 text-xs text-zinc-500">{info.isEmom ? `Minuta ${info.round}` : `Kolo ${info.round}`}{info.detail ? ` · ${info.detail}` : ""}</p>
                                </div>
                                <span className="font-mono font-bold">{formatDuration(split.durationSeconds)}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <ConfirmDialog open={pendingDelete !== null} title="Smazat výsledek?" description="Tento záznam už nepůjde obnovit." confirmLabel="Smazat" destructive onCancel={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) deleteResult(pendingDelete.id); setPendingDelete(null); }} />
    </main>
  );
}
