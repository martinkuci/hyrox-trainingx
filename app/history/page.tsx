"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import { blockFeedbackLabel } from "@/lib/block-feedback";
import { ENGINN_EXTRA_FOCUS_LABELS } from "@/lib/enginn-extra";
import {
  buildCategoryInsights,
  buildComparableWorkouts,
  buildTrainingPeriodComparison,
  buildWeeklyActivity,
  buildWorkoutBenchmarks,
} from "@/lib/training-insights";
import type { CategoryInsight, ComparableWorkout, TrainingPeriodComparison, WeeklyActivity, WorkoutBenchmark } from "@/lib/training-insights";
import type { StepSplit, WorkoutCategory, WorkoutResult } from "@/lib/types";

const insightPeriods = [4, 8, 12] as const;

const categoryLabels: Record<WorkoutCategory | "other", string> = {
  "base-engine": "Aerobní základ",
  "base-builder": "Technika a přechody",
  strength: "Síla",
  threshold: "Prahový běh",
  "race-simulation": "Závodní simulace",
  "long-engine": "Dlouhá vytrvalost",
  recovery: "Regenerace",
  mixed: "Kombinovaný trénink",
  other: "Ostatní",
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  const parts = hours > 0 ? [hours, minutes, remaining] : [minutes, remaining];
  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}

function formatTrainingVolume(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00.000Z`),
  );
}

export default function HistoryPage() {
  const { data, ready, deleteResult } = useHyroxData();
  const [insightPeriod, setInsightPeriod] = useState<(typeof insightPeriods)[number]>(4);
  const [pendingDelete, setPendingDelete] = useState<WorkoutResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<Record<string, "chronological" | "exercise">>({});
  const results = useMemo(() => [...data.results].sort((a, b) => b.completedAt.localeCompare(a.completedAt)), [data.results]);
  const insights = useMemo(() => {
    if (!ready) return null;
    const now = new Date();
    return {
      period: buildTrainingPeriodComparison(data.results, data.templates, now, insightPeriod),
      categories: buildCategoryInsights(data.results, data.templates, now, insightPeriod),
      weeks: buildWeeklyActivity(data.results, now, insightPeriod),
      comparisons: buildComparableWorkouts(data.results),
      benchmarks: buildWorkoutBenchmarks(data.results),
    };
  }, [data.results, data.templates, insightPeriod, ready]);
  const benchmarkResultIds = useMemo(
    () => new Set(insights?.benchmarks.flatMap((benchmark) => benchmark.bestResultIds) ?? []),
    [insights?.benchmarks],
  );

  function describeSplit(result: WorkoutResult, split: StepSplit) {
    const template = data.templates.find((item) => item.id === result.templateId);
    const block = template?.blocks.find((item) => item.id === split.blockId);
    const step = block?.steps.find((item) => item.id === split.stepId);
    return {
      blockTitle: block?.title ?? split.blockTitle ?? "Neznámý blok",
      stepTitle: step?.name ?? split.stepName ?? "Neznámý cvik",
      detail: step?.detail ?? split.stepDetail ?? "",
      round: split.round,
      isEmom: block?.type === "emom",
    };
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

        {insights && results.length > 0 && (
          <TrainingInsights
            period={insights.period}
            periodWeeks={insightPeriod}
            categories={insights.categories}
            weeks={insights.weeks}
            comparisons={insights.comparisons}
            benchmarks={insights.benchmarks}
            onPeriodChange={setInsightPeriod}
          />
        )}

        {results.length > 0 && (
          <div className="mb-4 mt-9 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Záznamy</p>
              <h2 className="mt-1 text-2xl font-black">Historie tréninků</h2>
            </div>
            <span className="ui-chip">{results.length} celkem</span>
          </div>
        )}

        <div className={`${results.length > 0 ? "space-y-4" : ""}`}>
          {results.map((result) => {
            const expanded = expandedId === result.id;
            const mode = viewMode[result.id] ?? "chronological";
            const described = result.splits.map((split, index) => ({ split, index, info: describeSplit(result, split) }));
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
                  <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-accent">{new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.completedAt))}</p><h2 className="mt-1 text-2xl font-black">{result.workoutTitle}</h2></div><div className="flex shrink-0 flex-col items-end gap-2">{benchmarkResultIds.has(result.id) && <span className="ui-chip ui-chip-accent">Nejkratší čas</span>}{result.source === "screenshot" ? <span className="ui-chip ui-chip-accent">Screenshot</span> : result.sourceImageName ? <span className="ui-chip border-sky-400/20 bg-sky-400/10 text-sky-300">Data doplněna</span> : null}<span className="ui-chip text-sm">RPE {result.rpe}</span></div></div>
                  <div className="ui-inset mt-5 flex items-end justify-between p-4"><div><p className="text-sm text-zinc-400">Celkový čas</p><p className="mt-1 font-mono text-3xl font-black">{formatDuration(result.durationSeconds)}</p></div><span className="text-sm text-zinc-500">{result.splits.length} úseků</span></div>
                  {result.metrics && Object.values(result.metrics).some((value) => value !== undefined) && <div className="mt-4 grid grid-cols-2 gap-2">{result.metrics.averageHeartRate !== undefined && <ResultMetric label="Průměrný tep" value={result.metrics.averageHeartRate + " bpm"} />}{result.metrics.maxHeartRate !== undefined && <ResultMetric label="Maximální tep" value={result.metrics.maxHeartRate + " bpm"} />}{result.metrics.calories !== undefined && <ResultMetric label="Kalorie" value={result.metrics.calories + " kcal"} />}{result.metrics.distanceKm !== undefined && <ResultMetric label="Vzdálenost" value={result.metrics.distanceKm.toLocaleString("cs-CZ", { maximumFractionDigits: 2 }) + " km"} />}{result.metrics.watchDurationSeconds !== undefined && <ResultMetric label="Čas podle hodinek" value={formatDuration(result.metrics.watchDurationSeconds)} />}</div>}
                  {result.weights && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Váhy</p><p className="mt-1 text-zinc-200">{result.weights}</p></div>}
                  {result.notes && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Poznámka</p><p className="mt-1 whitespace-pre-wrap text-zinc-300">{result.notes}</p></div>}
                  {result.enginnExtra && (
                    <section className="mt-4 rounded-2xl border border-accent/20 bg-accent-soft p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Enginn Extra</p>
                          <p className="mt-1 font-black text-zinc-100">{ENGINN_EXTRA_FOCUS_LABELS[result.enginnExtra.focus]} · plán {result.enginnExtra.durationMinutes} min</p>
                        </div>
                        <span className="font-mono text-sm font-black text-accent">{formatDuration(result.enginnExtra.durationSeconds)}</span>
                      </div>
                      <ol className="mt-3 space-y-2">
                        {result.enginnExtra.exercises.map((exercise, index) => (
                          <li key={`${result.id}-extra-${index}-${exercise.exerciseId}`} className="flex items-start gap-3 rounded-xl bg-surface/70 px-3 py-2.5">
                            <span className="font-black text-accent">{index + 1}.</span>
                            <div className="min-w-0">
                              <Link href={`/exercises/${encodeURIComponent(exercise.exerciseId)}`} className="font-bold text-zinc-100 underline-offset-4 hover:underline">{exercise.name}</Link>
                              <p className="mt-0.5 text-xs text-zinc-500">{exercise.prescription}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
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

function TrainingInsights({
  period,
  periodWeeks,
  categories,
  weeks,
  comparisons,
  benchmarks,
  onPeriodChange,
}: {
  period: TrainingPeriodComparison;
  periodWeeks: (typeof insightPeriods)[number];
  categories: CategoryInsight[];
  weeks: WeeklyActivity[];
  comparisons: ComparableWorkout[];
  benchmarks: WorkoutBenchmark[];
  onPeriodChange: (weeks: (typeof insightPeriods)[number]) => void;
}) {
  const maxWeeklyDuration = Math.max(...weeks.map((week) => week.durationSeconds), 1);
  const maxCategoryDuration = Math.max(...categories.map((category) => category.durationSeconds), 1);

  return (
    <div className="space-y-4">
      <section className="ui-card ui-card-accent p-5 sm:p-6" aria-labelledby="insight-overview-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Zvolené období</p>
            <h2 id="insight-overview-title" className="mt-1 text-2xl font-black">Tréninkový přehled</h2>
          </div>
          <span className="ui-chip ui-chip-accent">Pozorovaná data</span>
        </div>

        <div className="ui-segmented mt-5 grid grid-cols-3" aria-label="Období tréninkových statistik">
          {insightPeriods.map((weeks) => (
            <button
              key={weeks}
              type="button"
              className="ui-choice min-h-11 px-2 py-2 text-sm"
              aria-pressed={periodWeeks === weeks}
              onClick={() => onPeriodChange(weeks)}
            >
              {weeks} týdnů
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          {formatShortDate(period.currentStartDate)}–{formatShortDate(period.currentEndDate)} · srovnání s předchozími {periodWeeks} týdny
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-2">
          <InsightMetric label="Tréninky" value={String(period.current.sessionCount)} comparison={formatCountChange(period.current.sessionCount, period.previous.sessionCount)} />
          <InsightMetric label="Celkový čas" value={formatTrainingVolume(period.current.durationSeconds)} comparison={formatPercentChange(period.current.durationSeconds, period.previous.durationSeconds)} />
          <InsightMetric label="Průměrné RPE" value={period.current.averageRpe?.toLocaleString("cs-CZ", { maximumFractionDigits: 1 }) ?? "—"} comparison={formatRpeChange(period.current.averageRpe, period.previous.averageRpe)} />
          <InsightMetric
            label="RPE v cíli"
            value={period.current.targetRpeCount > 0 ? `${period.current.targetRpeMatches} z ${period.current.targetRpeCount}` : "Bez cíle"}
            comparison="v aktuálním období"
          />
        </dl>
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Souhrn vychází jen z uložených tréninků. Změna nahoru nebo dolů sama o sobě neznamená lepší ani horší výsledek.
        </p>
      </section>

      <section className="ui-card p-5 sm:p-6" aria-labelledby="weekly-activity-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Pravidelnost</p>
            <h2 id="weekly-activity-title" className="mt-1 text-xl font-black">Aktivita po týdnech</h2>
          </div>
          <span className="text-xs text-zinc-500">{periodWeeks} týdnů · výška = čas</span>
        </div>
        <div className="-mx-1 mt-6 overflow-x-auto px-1 pb-1">
          <ol
            className="grid h-40 items-end gap-2"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(2.75rem, 1fr))`, minWidth: weeks.length > 5 ? `${weeks.length * 52}px` : undefined }}
            aria-label={`Tréninková aktivita za ${periodWeeks} týdnů`}
          >
            {weeks.map((week) => {
              const height = week.durationSeconds > 0
                ? Math.max(10, Math.round((week.durationSeconds / maxWeeklyDuration) * 100))
                : 2;
              return (
                <li key={week.startDate} className="flex h-full min-w-0 flex-col justify-end text-center">
                  <span className="mb-2 text-xs font-black text-zinc-300">{week.sessionCount}×</span>
                  <div className="flex h-24 items-end justify-center rounded-xl bg-white/[0.025] px-1" title={`${week.sessionCount} tréninků · ${formatTrainingVolume(week.durationSeconds)}`}>
                    <span
                      className={`block w-full max-w-10 rounded-t-lg ${week.current ? "bg-accent" : "bg-zinc-600"}`}
                      style={{ height: `${height}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className={`mt-2 truncate text-[10px] font-bold ${week.current ? "text-accent" : "text-zinc-500"}`}>
                    {week.current ? "Teď" : formatShortDate(week.startDate)}
                  </span>
                  <span className="sr-only">{formatShortDate(week.startDate)} až {formatShortDate(week.endDate)}, {week.sessionCount} tréninků, {formatTrainingVolume(week.durationSeconds)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="ui-card p-5 sm:p-6" aria-labelledby="categories-title">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Skladba přípravy</p>
        <h2 id="categories-title" className="mt-1 text-xl font-black">Tréninky podle zaměření</h2>
        {categories.length === 0 ? (
          <div className="ui-feedback mt-5 text-sm">Ve zvoleném období zatím není žádný dokončený trénink.</div>
        ) : (
          <ol className="mt-5 space-y-3">
            {categories.map((category) => (
              <CategoryInsightRow key={category.category} insight={category} maxDuration={maxCategoryDuration} />
            ))}
          </ol>
        )}
      </section>

      <section className="ui-card ui-card-accent p-5 sm:p-6" aria-labelledby="benchmarks-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Fáze 4C</p>
            <h2 id="benchmarks-title" className="mt-1 text-xl font-black">Osobní benchmarky</h2>
          </div>
          <span className="ui-chip ui-chip-accent">Stejná verze</span>
        </div>
        {benchmarks.length === 0 ? (
          <div className="ui-feedback mt-5 text-sm leading-6">
            Benchmark se objeví po druhém platném dokončení stejné verze tréninku.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {benchmarks.map((benchmark) => <WorkoutBenchmarkCard key={benchmark.key} benchmark={benchmark} />)}
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Nejkratší čas je pouze osobní záznam. Nezohledňuje podmínky, změnu zátěže ani kvalitu provedení.
        </p>
      </section>

      <section className="ui-card p-5 sm:p-6" aria-labelledby="comparisons-title">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Vývoj výkonu</p>
        <h2 id="comparisons-title" className="mt-1 text-xl font-black">Opakované tréninky</h2>
        {comparisons.length === 0 ? (
          <div className="ui-feedback mt-5 text-sm leading-6">
            Srovnání se objeví po druhém dokončení stejného tréninku. Podobný název sám o sobě ke spojení výsledků nestačí.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {comparisons.map((comparison) => (
              <WorkoutComparison key={comparison.key} comparison={comparison} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function WorkoutBenchmarkCard({ benchmark }: { benchmark: WorkoutBenchmark }) {
  const status = benchmark.latestStatus === "new-best"
    ? `Nové minimum ${formatSignedPercent(benchmark.latestDifferencePercent)}`
    : benchmark.latestStatus === "matched-best"
      ? "Vyrovnané minimum"
      : `${formatSignedPercent(benchmark.latestDifferencePercent)} nad minimem`;

  return (
    <article className="ui-inset p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-zinc-100">{benchmark.title}</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {benchmark.workoutCode && benchmark.templateVersion
              ? `${benchmark.workoutCode} · verze ${benchmark.templateVersion}`
              : "Stejná původní šablona"}
          </p>
        </div>
        <span className={`ui-chip shrink-0 ${benchmark.latestStatus === "new-best" ? "ui-chip-accent" : ""}`}>
          {benchmark.attemptCount}×
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <ResultMetric label="Nejkratší čas" value={formatDuration(benchmark.bestDurationSeconds)} />
        <ResultMetric label="Poslední pokus" value={formatDuration(benchmark.latestDurationSeconds)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-accent">{status}</span>
        <span className="text-zinc-500">poprvé {formatShortDate(benchmark.bestCompletedAt)}</span>
      </div>
    </article>
  );
}

function formatSignedPercent(value: number) {
  if (value === 0) return "0 %";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("cs-CZ")} %`;
}

function InsightMetric({ label, value, comparison }: { label: string; value: string; comparison?: string }) {
  return (
    <div className="ui-inset min-w-0 p-4">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 truncate text-lg font-black text-zinc-100">{value}</dd>
      {comparison && <dd className="mt-1 text-[10px] leading-4 text-zinc-500">{comparison}</dd>}
    </div>
  );
}

function CategoryInsightRow({ insight, maxDuration }: { insight: CategoryInsight; maxDuration: number }) {
  const targetLabel = insight.targetRpeCount > 0
    ? `${insight.targetRpeMatches}/${insight.targetRpeCount} v cíli`
    : "bez cílového RPE";
  const width = insight.durationSeconds > 0
    ? Math.max(6, Math.round((insight.durationSeconds / maxDuration) * 100))
    : 0;

  return (
    <li className="ui-inset p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-zinc-100">{categoryLabels[insight.category]}</h3>
          <p className="mt-1 text-xs text-zinc-500">{formatTrainingVolume(insight.durationSeconds)} · RPE {insight.averageRpe?.toLocaleString("cs-CZ", { maximumFractionDigits: 1 }) ?? "—"} · {targetLabel}</p>
        </div>
        <span className="ui-chip shrink-0">{insight.sessionCount}×</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
        <span className="block h-full rounded-full bg-accent/70" style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

function formatCountChange(current: number, previous: number) {
  const delta = current - previous;
  if (previous === 0) return current === 0 ? "stejně jako předtím" : "předtím bez tréninku";
  if (delta === 0) return "stejně jako předtím";
  return `${delta > 0 ? "+" : ""}${delta} proti předchozímu období`;
}

function formatPercentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "stejně jako předtím" : "předtím bez záznamu";
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return "stejně jako předtím";
  return `${change > 0 ? "+" : ""}${change} % proti předchozímu období`;
}

function formatRpeChange(current: number | null, previous: number | null) {
  if (current === null || previous === null) return "bez úplného srovnání";
  const change = Math.round((current - previous) * 10) / 10;
  if (change === 0) return "stejně jako předtím";
  return `${change > 0 ? "+" : ""}${change.toLocaleString("cs-CZ")} proti předchozímu období`;
}

function WorkoutComparison({ comparison }: { comparison: ComparableWorkout }) {
  const change = comparison.durationChangePercent;
  const changeLabel = change < 0
    ? `Čas −${Math.abs(change).toLocaleString("cs-CZ")} %`
    : change > 0
      ? `Čas +${change.toLocaleString("cs-CZ")} %`
      : "Stejný čas jako minule";
  const maxDuration = Math.max(...comparison.attempts.map((attempt) => attempt.durationSeconds), 1);

  return (
    <article className="ui-inset p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-black text-zinc-100">{comparison.title}</h3>
          <p className="mt-1 text-sm text-zinc-500">Poslední dva platné výsledky stejné jednotky</p>
        </div>
        <span className="ui-chip self-start">
          {changeLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ResultMetric label="Naposledy" value={formatDuration(comparison.latestDurationSeconds)} />
        <ResultMetric label="Předtím" value={formatDuration(comparison.previousDurationSeconds)} />
      </div>
      {(comparison.latestRpe !== null || comparison.previousRpe !== null) && (
        <p className="mt-3 text-xs text-zinc-500">
          RPE naposledy {comparison.latestRpe ?? "—"} · předtím {comparison.previousRpe ?? "—"}
        </p>
      )}

      <ol className="mt-4 space-y-2" aria-label={`Časový trend: ${comparison.title}`}>
        {comparison.attempts.map((attempt) => (
          <li key={attempt.id} className="grid grid-cols-[3.2rem_1fr_auto] items-center gap-2 text-xs">
            <span className="text-zinc-500">{formatShortDate(attempt.completedAt)}</span>
            <span className="h-2 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-accent/70"
                style={{ width: `${Math.max(8, Math.round((attempt.durationSeconds / maxDuration) * 100))}%` }}
              />
            </span>
            <span className="font-mono font-bold text-zinc-200">{formatDuration(attempt.durationSeconds)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[10px] text-zinc-600">Délka sloupce odpovídá času. Rozdíl nezohledňuje změnu podmínek, zátěže ani provedení.</p>
    </article>
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
