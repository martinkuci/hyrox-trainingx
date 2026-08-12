"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { WorkoutTemplate } from "@/lib/types";
import { categoryLabel } from "@/lib/workout-metadata";

export default function WorkoutsPage() {
  const { data, ready, createTemplate, deleteTemplate } = useHyroxData();
  const [pendingDelete, setPendingDelete] = useState<WorkoutTemplate | null>(null);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");

  const tags = useMemo(
    () => Array.from(new Set(data.templates.flatMap((template) => template.tags ?? []))).sort(),
    [data.templates],
  );

  const templates = useMemo(
    () =>
      data.templates.filter((template) => {
        const metadata = template.metadata;
        const haystack = `${template.title} ${template.description} ${(template.tags ?? []).join(" ")} ${metadata?.workoutCode ?? ""} ${metadata?.goal ?? ""} ${metadata?.category ?? ""}`.toLowerCase();
        return haystack.includes(query.toLowerCase()) && (tag === "all" || (template.tags ?? []).includes(tag));
      }),
    [data.templates, query, tag],
  );

  function duplicate(template: WorkoutTemplate) {
    createTemplate({
      title: `${template.title} – kopie`,
      description: template.description,
      durationMinutes: template.durationMinutes,
      tags: template.tags,
      metadata: template.metadata
        ? { ...template.metadata, workoutCode: "", templateVersion: 1 }
        : undefined,
      blocks: template.blocks.map((block) => ({
        ...block,
        id: crypto.randomUUID(),
        steps: block.steps.map((step) => ({ ...step, id: crypto.randomUUID() })),
      })),
    });
  }

  return (
    <PlanningShell
      eyebrow="Knihovna"
      title="Trénovat"
      description="Vyber hotový trénink, uprav si vlastní nebo rovnou začni dnešní jednotku."
      action={
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Link href="/import" className="flex min-h-12 items-center justify-center rounded-2xl border border-white/12 px-4 py-3 text-sm font-black text-zinc-200">
            Import
          </Link>
          <Link href="/workouts/editor" className="flex min-h-12 items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-black text-zinc-950">
            + Nový
          </Link>
        </div>
      }
    >
      <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.1)]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Hledat název, HYX kód, cíl…"
          className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-lime-400"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {["all", ...tags].map((item) => (
            <button
              key={item}
              onClick={() => setTag(item)}
              className={`shrink-0 rounded-full px-3 py-2 text-sm font-bold ${tag === item ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}
            >
              {item === "all" ? "Vše" : item}
            </button>
          ))}
        </div>
      </section>

      {!ready && <div className="h-48 animate-pulse rounded-3xl bg-zinc-900" />}

      {ready && templates.length === 0 && (
        <section className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 p-8 text-center">
          <h2 className="text-xl font-black">Žádný odpovídající trénink</h2>
          <p className="mt-2 text-zinc-400">Změň filtr nebo vytvoř nový WOD.</p>
        </section>
      )}

      <div className="space-y-4">
        {templates.map((template) => {
          const metadata = template.metadata;
          return (
            <article key={template.id} className="rounded-[1.75rem] border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                {metadata?.workoutCode && (
                  <span className="rounded-full bg-lime-400 px-3 py-1 text-xs font-black text-zinc-950">
                    {metadata.workoutCode}-V{metadata.templateVersion}
                  </span>
                )}
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-300">
                  {categoryLabel(metadata?.category)}
                </span>
                {metadata && (
                  <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-300">
                    Level {metadata.difficultyLevel}
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{template.title}</h2>
                  <p className="mt-2 leading-6 text-zinc-400">{template.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-semibold">
                  {template.durationMinutes} min
                </span>
              </div>

              {metadata && (
                <div className="mt-5 rounded-2xl border border-lime-400/15 bg-zinc-800/70 p-4">
                  <p className="font-bold text-zinc-100">{metadata.goal || "Cíl zatím není vyplněný."}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-zinc-400">
                    <p>Cílové RPE <b className="text-white">{metadata.targetRpeMin}–{metadata.targetRpeMax}</b></p>
                    <p>Čas <b className="text-white">{metadata.expectedDurationMin}–{metadata.expectedDurationMax} min</b></p>
                    {metadata.runningTarget && <p className="col-span-2">Běh: <b className="text-white">{metadata.runningTarget}</b></p>}
                    {metadata.primaryMetric && <p className="col-span-2">Sledujeme: <b className="text-white">{metadata.primaryMetric}</b></p>}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {template.tags.map((item) => (
                  <span key={item} className="rounded-full bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Link href={`/workout/${template.id}`} className="rounded-2xl bg-lime-400 px-4 py-3.5 text-center font-black text-zinc-950">
                  Spustit
                </Link>
                <Link href={`/workouts/editor?id=${template.id}`} className="rounded-2xl bg-zinc-800 px-4 py-3.5 text-center font-bold">
                  Upravit
                </Link>
                <button onClick={() => duplicate(template)} className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300">
                  Duplikovat
                </button>
                <button onClick={() => setPendingDelete(template)} className="rounded-2xl border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-300">
                  Smazat
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Smazat trénink?"
        description="Smaže se také jeho naplánování v kalendáři. Uložené výsledky zůstanou v historii."
        confirmLabel="Smazat"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteTemplate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </PlanningShell>
  );
}
