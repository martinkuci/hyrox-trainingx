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
  const [showAllTags, setShowAllTags] = useState(false);

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
  const visibleTags = showAllTags
    ? tags
    : Array.from(new Set([...tags.slice(0, 7), ...(tag !== "all" ? [tag] : [])]));

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
      description="Vyber hotový trénink, skládej ho z jednotlivých cviků nebo rovnou začni dnešní jednotku."
      action={
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
          <Link href="/exercises" className="ui-button ui-button-outline ui-button-sm">
            Cviky
          </Link>
          <Link href="/import" className="ui-button ui-button-outline ui-button-sm">
            Import
          </Link>
          <Link href="/workouts/editor" className="ui-button ui-button-primary ui-button-sm">
            + Nový
          </Link>
        </div>
      }
    >
      <section className="ui-card mb-5 p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Hledat název, EGN kód, cíl…"
          className="ui-field"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {["all", ...visibleTags].map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={tag === item}
              onClick={() => setTag(item)}
              className="ui-choice min-h-10 shrink-0 rounded-full px-3 py-2 text-sm"
            >
              {item === "all" ? "Vše" : item}
            </button>
          ))}
          {tags.length > 7 && (
            <button
              type="button"
              aria-expanded={showAllTags}
              onClick={() => setShowAllTags((value) => !value)}
              className="ui-button ui-button-ghost ui-button-sm rounded-full text-xs"
            >
              {showAllTags ? "Méně filtrů" : `+ ${tags.length - 7} dalších`}
            </button>
          )}
        </div>
      </section>

      {!ready && <div className="ui-card h-48 animate-pulse" />}

      {ready && templates.length === 0 && (
        <section className="ui-card border-dashed p-8 text-center">
          <h2 className="text-xl font-black">Žádný odpovídající trénink</h2>
          <p className="mt-2 text-zinc-400">Změň filtr nebo vytvoř nový WOD.</p>
        </section>
      )}

      <div className="space-y-4">
        {templates.map((template) => {
          const metadata = template.metadata;
          return (
            <article key={template.id} className="ui-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                {metadata?.workoutCode && (
                  <span className="ui-chip ui-chip-accent">
                    {metadata.workoutCode}-V{metadata.templateVersion}
                  </span>
                )}
                <span className="ui-chip">
                  {categoryLabel(metadata?.category)}
                </span>
                {metadata && (
                  <span className="ui-chip">
                    Level {metadata.difficultyLevel}
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{template.title}</h2>
                  <p className="mt-2 leading-6 text-zinc-400">{template.description}</p>
                </div>
                <span className="ui-chip shrink-0 text-sm">
                  {template.durationMinutes} min
                </span>
              </div>

              {metadata && (
                <div className="ui-inset mt-5 p-4">
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
                  <span key={item} className="ui-chip ui-chip-accent">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Link href={`/workout/${template.id}`} className="ui-button ui-button-accent">
                  Spustit
                </Link>
                <Link href={`/workouts/editor?id=${template.id}`} className="ui-button ui-button-secondary">
                  Upravit
                </Link>
                <button type="button" onClick={() => duplicate(template)} className="ui-button ui-button-outline text-sm">
                  Duplikovat
                </button>
                <button type="button" onClick={() => setPendingDelete(template)} className="ui-button ui-button-danger text-sm">
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
