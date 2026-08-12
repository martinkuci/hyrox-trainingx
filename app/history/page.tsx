"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import { blockFeedbackLabel } from "@/lib/block-feedback";
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
    <PlanningShell
      eyebrow="Výsledky"
      title="Historie výkonů"
      description="Výsledky, mezičasy a vývoj výkonu na jednom místě."
      backHref="/"
      action={
        <Link href="/results/import" className="ui-button ui-button-primary ui-button-sm w-full sm:w-auto">
          Načíst screenshot
        </Link>
      }
    >
      <div className="mx-auto max-w-lg">

        {!ready && <div className="ui-card h-48 animate-pulse" aria-label="Načítám výsledky" />}
        {ready && results.length === 0 && <section className="ui-card border-dashed p-8 text-center"><div className="app-empty-icon mx-auto"><ResultsIcon /></div><h2 className="mt-5 text-xl font-black">Zatím žádné výsledky</h2><p className="mt-2 text-zinc-400">Dokončený trénink se zobrazí tady včetně času, RPE a mezičasů.</p><Link href="/workouts" className="ui-button ui-button-accent mt-7 w-full">Vybrat trénink</Link></section>}

        <div className={`${results.length > 0 ? "space-y-4" : ""}`}>
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
              <article key={result.id} className="ui-card overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-accent">{new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.completedAt))}</p><h2 className="mt-1 text-2xl font-black">{result.workoutTitle}</h2></div><div className="flex shrink-0 flex-col items-end gap-2">{result.source === "screenshot" ? <span className="ui-chip ui-chip-accent">Screenshot</span> : result.sourceImageName ? <span className="ui-chip border-sky-400/20 bg-sky-400/10 text-sky-300">Data doplněna</span> : null}<span className="ui-chip text-sm">RPE {result.rpe}</span></div></div>
                  <div className="ui-inset mt-5 flex items-end justify-between p-4"><div><p className="text-sm text-zinc-400">Celkový čas</p><p className="mt-1 font-mono text-3xl font-black">{formatDuration(result.durationSeconds)}</p></div><span className="text-sm text-zinc-500">{result.splits.length} úseků</span></div>
                  {result.metrics && Object.values(result.metrics).some((value) => value !== undefined) && <div className="mt-4 grid grid-cols-2 gap-2">{result.metrics.averageHeartRate !== undefined && <ResultMetric label="Průměrný tep" value={result.metrics.averageHeartRate + " bpm"} />}{result.metrics.maxHeartRate !== undefined && <ResultMetric label="Maximální tep" value={result.metrics.maxHeartRate + " bpm"} />}{result.metrics.calories !== undefined && <ResultMetric label="Kalorie" value={result.metrics.calories + " kcal"} />}{result.metrics.distanceKm !== undefined && <ResultMetric label="Vzdálenost" value={result.metrics.distanceKm.toLocaleString("cs-CZ", { maximumFractionDigits: 2 }) + " km"} />}{result.metrics.watchDurationSeconds !== undefined && <ResultMetric label="Čas podle hodinek" value={formatDuration(result.metrics.watchDurationSeconds)} />}</div>}
                  {result.weights && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Váhy</p><p className="mt-1 text-zinc-200">{result.weights}</p></div>}
                  {result.notes && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Poznámka</p><p className="mt-1 whitespace-pre-wrap text-zinc-300">{result.notes}</p></div>}
                  <div className="mt-5 space-y-3"><Link href={`/results/import?resultId=${encodeURIComponent(result.id)}`} className="ui-button ui-button-outline ui-button-sm w-full">Doplnit data ze screenshotu</Link><div className="grid grid-cols-[1fr_auto] gap-3"><button type="button" onClick={() => setExpandedId(expanded ? null : result.id)} className="ui-button ui-button-secondary ui-button-sm">{expanded ? "Skrýt detail" : "Zobrazit detail"}</button><button type="button" onClick={() => setPendingDelete(result)} className="ui-button ui-button-danger ui-button-sm">Smazat</button></div></div>
                </div>

                {expanded && <div className="border-t border-white/8 bg-zinc-950/50 px-6 py-5">
                  {(result.blockFeedbacks?.length ?? 0) > 0 && <section className="mb-5"><h3 className="text-sm font-black uppercase tracking-wider text-zinc-400">Hodnocení bloků</h3><ol className="mt-3 space-y-2">{result.blockFeedbacks?.map((feedback) => { const template = data.templates.find((item) => item.id === result.templateId); const block = template?.blocks.find((item) => item.id === feedback.blockId); return <li key={feedback.blockId} className="ui-inset flex items-center justify-between gap-3 px-4 py-3"><div><p className="font-black text-zinc-100">{block?.title ?? "Blok"}</p><p className="mt-1 text-sm text-zinc-500">{blockFeedbackLabel(feedback.rating)}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft font-black text-accent">{feedback.rating}</span></li>; })}</ol></section>}
                  <div className="ui-segmented grid grid-cols-2"><button type="button" aria-pressed={mode === "chronological"} onClick={() => setViewMode((current) => ({ ...current, [result.id]: "chronological" }))} className="ui-choice px-3 py-2 text-sm">Chronologicky</button><button type="button" aria-pressed={mode === "exercise"} onClick={() => setViewMode((current) => ({ ...current, [result.id]: "exercise" }))} className="ui-choice px-3 py-2 text-sm">Podle cviků</button></div>

                  {result.splits.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Bez zaznamenaných mezičasů.</p> : mode === "chronological" ? (
                    <ol className="mt-4 space-y-2">{described.map(({ split, index, info }) => <li key={`${split.blockId}-${split.stepId}-${split.round}-${index}`} className="ui-inset px-4 py-3 text-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-accent">{info.blockTitle}</p><p className="mt-1 font-bold text-zinc-100">{info.stepTitle}</p><p className="mt-1 text-xs text-zinc-500">{info.isEmom ? `Minuta ${info.round}` : `Kolo ${info.round}`}{info.detail ? ` · ${info.detail}` : ""}</p></div><span className="font-mono font-bold">{formatDuration(split.durationSeconds)}</span></div></li>)}</ol>
                  ) : (
                    <div className="mt-4 space-y-4">{groups.map((group) => {
                      const times = group.items.map((item) => item.split.durationSeconds);
                      const best = Math.min(...times);
                      const average = Math.round(times.reduce((sum, value) => sum + value, 0) / times.length);
                      const last = times[times.length - 1];
                      const drop = best > 0 ? Math.round(((last - best) / best) * 100) : 0;
                      return <section key={group.key} className="ui-inset p-4"><p className="text-xs font-bold uppercase tracking-wider text-accent">{group.blockTitle}</p><h3 className="mt-1 text-lg font-black">{group.title}</h3>{group.detail && <p className="mt-1 text-sm text-zinc-500">{group.detail}</p>}<div className="mt-4 grid grid-cols-4 gap-2 text-center"><Stat label="Nejlepší" value={formatDuration(best)} /><Stat label="Průměr" value={formatDuration(average)} /><Stat label="Poslední" value={formatDuration(last)} /><Stat label="Propad" value={`${drop > 0 ? "+" : ""}${drop}%`} /></div><ol className="mt-4 space-y-2">{group.items.map(({ split, index, info }) => <li key={`${group.key}-${index}`} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-sm"><span className="text-zinc-400">{info.isEmom ? `Minuta ${info.round}` : `Kolo ${info.round}`}</span><span className="font-mono font-bold">{formatDuration(split.durationSeconds)}</span></li>)}</ol></section>;
                    })}</div>
                  )}
                </div>}
              </article>
            );
          })}
        </div>
      </div>
      <ConfirmDialog open={pendingDelete !== null} title="Smazat výsledek?" description="Tento záznam už nepůjde obnovit." confirmLabel="Smazat" destructive onCancel={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) deleteResult(pendingDelete.id); setPendingDelete(null); }} />
    </PlanningShell>
  );
}

function ResultsIcon() {
  return <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" strokeLinecap="round" /></svg>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="ui-inset px-2 py-3"><p className="font-mono text-sm font-black text-zinc-100">{value}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">{label}</p></div>;
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return <div className="ui-inset px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 font-black text-zinc-100">{value}</p></div>;
}
