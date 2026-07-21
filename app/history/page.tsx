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
  const [viewMode, setViewMode] = useState<Record<string, "chronological" | "exercise">>({});
  const results = useMemo(() => [...data.results].sort((a, b) => b.completedAt.localeCompare(a.completedAt)), [data.results]);

  function describeSplit(result: WorkoutResult, blockId: string, stepId: string, round: number) {
    const template = data.templates.find((item) => item.id === result.templateId);
    const block = template?.blocks.find((item) => item.id === blockId);
    const step = block?.steps.find((item) => item.id === stepId);
    return { blockTitle: block?.title ?? "Neznámý blok", stepTitle: step?.name ?? "Neznámý cvik", detail: step?.detail ?? "", round, isEmom: block?.type === "emom" };
  }

  return (
    <main className="min-h-dvh bg-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-400">HYROX Training</p>
        <h1 className="mt-2 text-4xl font-black">Historie</h1>
        <p className="mt-2 text-zinc-400">Výsledky a mezičasy tvých tréninků.</p>
        <Link href="/results/import" className="mt-5 block rounded-2xl bg-lime-400 px-5 py-4 text-center font-black text-zinc-950">
          Načíst výsledek ze screenshotu
        </Link>

        {!ready && <p className="mt-10 text-zinc-400">Načítám výsledky…</p>}
        {ready && results.length === 0 && <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center"><div className="text-4xl">◷</div><h2 className="mt-4 text-xl font-bold">Zatím žádné výsledky</h2><p className="mt-2 text-zinc-400">Dokončený trénink se zobrazí tady.</p><Link href="/" className="mt-7 block rounded-2xl bg-lime-400 px-5 py-4 font-bold text-zinc-950">Vybrat trénink</Link></section>}

        <div className="mt-8 space-y-4">
          {results.map((result) => {
            const expanded = expandedId === result.id;
            const mode = viewMode[result.id] ?? "chronological";
            const described = result.splits.map((split, index) => ({ split, index, info: describeSplit(result, split.blockId, split.stepId, split.round) }));
            const groups = Array.from(described.reduce((map, item) => {
              const key = `${item.split.blockId}::${item.split.stepId}`;
              const group = map.get(key) ?? { key, title: item.info.stepTitle, detail: item.info.detail, blockTitle: item.info.blockTitle, isEmom: item.info.isEmom, items: [] as typeof described };
              group.items.push(item);
              map.set(key, group);
              return map;
            }, new Map<string, { key: string; title: string; detail: string; blockTitle: string; isEmom: boolean; items: typeof described }>()).values());

            return (
              <article key={result.id} className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-lime-400">{new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.completedAt))}</p><h2 className="mt-1 text-2xl font-black">{result.workoutTitle}</h2></div><div className="flex shrink-0 flex-col items-end gap-2">{result.source === "screenshot" ? <span className="rounded-full bg-lime-400/15 px-3 py-1 text-xs font-black text-lime-300">Screenshot</span> : result.sourceImageName ? <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-black text-sky-300">Data doplněna</span> : null}<span className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-semibold">RPE {result.rpe}</span></div></div>
                  <div className="mt-5 flex items-end justify-between rounded-2xl bg-zinc-800 p-4"><div><p className="text-sm text-zinc-400">Celkový čas</p><p className="mt-1 font-mono text-3xl font-black">{formatDuration(result.durationSeconds)}</p></div><span className="text-sm text-zinc-500">{result.splits.length} úseků</span></div>
                  {result.metrics && Object.values(result.metrics).some((value) => value !== undefined) && <div className="mt-4 grid grid-cols-2 gap-2">{result.metrics.averageHeartRate !== undefined && <ResultMetric label="Průměrný tep" value={result.metrics.averageHeartRate + " bpm"} />}{result.metrics.maxHeartRate !== undefined && <ResultMetric label="Maximální tep" value={result.metrics.maxHeartRate + " bpm"} />}{result.metrics.calories !== undefined && <ResultMetric label="Kalorie" value={result.metrics.calories + " kcal"} />}{result.metrics.distanceKm !== undefined && <ResultMetric label="Vzdálenost" value={result.metrics.distanceKm.toLocaleString("cs-CZ", { maximumFractionDigits: 2 }) + " km"} />}{result.metrics.watchDurationSeconds !== undefined && <ResultMetric label="Čas podle hodinek" value={formatDuration(result.metrics.watchDurationSeconds)} />}</div>}
                  {result.weights && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Váhy</p><p className="mt-1 text-zinc-200">{result.weights}</p></div>}
                  {result.notes && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Poznámka</p><p className="mt-1 whitespace-pre-wrap text-zinc-300">{result.notes}</p></div>}
                  <div className="mt-5 space-y-3"><Link href={`/results/import?resultId=${encodeURIComponent(result.id)}`} className="block rounded-xl border border-lime-400/40 px-4 py-3 text-center text-sm font-black text-lime-300">Doplnit data ze screenshotu</Link><div className="grid grid-cols-[1fr_auto] gap-3"><button type="button" onClick={() => setExpandedId(expanded ? null : result.id)} className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200">{expanded ? "Skrýt mezičasy" : "Zobrazit mezičasy"}</button><button type="button" onClick={() => setPendingDelete(result)} className="rounded-xl border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-300">Smazat</button></div></div>
                </div>

                {expanded && <div className="border-t border-zinc-800 bg-zinc-950/50 px-6 py-5">
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-900 p-1"><button type="button" onClick={() => setViewMode((current) => ({ ...current, [result.id]: "chronological" }))} className={`rounded-xl px-3 py-2 text-sm font-bold ${mode === "chronological" ? "bg-lime-400 text-zinc-950" : "text-zinc-400"}`}>Chronologicky</button><button type="button" onClick={() => setViewMode((current) => ({ ...current, [result.id]: "exercise" }))} className={`rounded-xl px-3 py-2 text-sm font-bold ${mode === "exercise" ? "bg-lime-400 text-zinc-950" : "text-zinc-400"}`}>Podle cviků</button></div>

                  {result.splits.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Bez zaznamenaných mezičasů.</p> : mode === "chronological" ? (
                    <ol className="mt-4 space-y-2">{described.map(({ split, index, info }) => <li key={`${split.blockId}-${split.stepId}-${split.round}-${index}`} className="rounded-xl bg-zinc-900 px-4 py-3 text-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-lime-400">{info.blockTitle}</p><p className="mt-1 font-bold text-zinc-100">{info.stepTitle}</p><p className="mt-1 text-xs text-zinc-500">{info.isEmom ? `Minuta ${info.round}` : `Kolo ${info.round}`}{info.detail ? ` · ${info.detail}` : ""}</p></div><span className="font-mono font-bold">{formatDuration(split.durationSeconds)}</span></div></li>)}</ol>
                  ) : (
                    <div className="mt-4 space-y-4">{groups.map((group) => {
                      const times = group.items.map((item) => item.split.durationSeconds);
                      const best = Math.min(...times);
                      const average = Math.round(times.reduce((sum, value) => sum + value, 0) / times.length);
                      const last = times[times.length - 1];
                      const drop = best > 0 ? Math.round(((last - best) / best) * 100) : 0;
                      return <section key={group.key} className="rounded-2xl bg-zinc-900 p-4"><p className="text-xs font-bold uppercase tracking-wider text-lime-400">{group.blockTitle}</p><h3 className="mt-1 text-lg font-black">{group.title}</h3>{group.detail && <p className="mt-1 text-sm text-zinc-500">{group.detail}</p>}<div className="mt-4 grid grid-cols-4 gap-2 text-center"><Stat label="Nejlepší" value={formatDuration(best)} /><Stat label="Průměr" value={formatDuration(average)} /><Stat label="Poslední" value={formatDuration(last)} /><Stat label="Propad" value={`${drop > 0 ? "+" : ""}${drop}%`} /></div><ol className="mt-4 space-y-2">{group.items.map(({ split, index, info }) => <li key={`${group.key}-${index}`} className="flex items-center justify-between rounded-xl bg-zinc-800 px-3 py-2 text-sm"><span className="text-zinc-400">{info.isEmom ? `Minuta ${info.round}` : `Kolo ${info.round}`}</span><span className="font-mono font-bold">{formatDuration(split.durationSeconds)}</span></li>)}</ol></section>;
                    })}</div>
                  )}
                </div>}
              </article>
            );
          })}
        </div>
      </div>
      <ConfirmDialog open={pendingDelete !== null} title="Smazat výsledek?" description="Tento záznam už nepůjde obnovit." confirmLabel="Smazat" destructive onCancel={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) deleteResult(pendingDelete.id); setPendingDelete(null); }} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-zinc-800 px-2 py-3"><p className="font-mono text-sm font-black text-zinc-100">{value}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">{label}</p></div>;
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-zinc-800 px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 font-black text-zinc-100">{value}</p></div>;
}
