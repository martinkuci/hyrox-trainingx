"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import {
  EXERCISE_CATEGORY_LABELS,
  EXERCISE_LIBRARY,
  exerciseCatalogStats,
  type ExerciseCategory,
} from "@/lib/exercise-catalog";
import { EQUIPMENT_LABELS } from "@/lib/training-context";

const QUICK_FILTERS = [
  { id: "all", label: "Vše" },
  { id: "bodyweight", label: "Vlastní váha" },
  { id: "core", label: "Core / břicho" },
  { id: "finisher", label: "Finisher" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "dumbbell", label: "Dumbbell" },
  { id: "barbell", label: "Osa" },
  { id: "machine", label: "Stroje" },
  { id: "crossfit", label: "CrossFit" },
  { id: "prehab", label: "Kompenzace / prehab" },
] as const;

type QuickFilter = typeof QUICK_FILTERS[number]["id"];

export default function ExerciseLibraryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const stats = useMemo(() => exerciseCatalogStats(), []);

  const exercises = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("cs");
    return EXERCISE_LIBRARY.filter((exercise) => {
      const equipmentText = exercise.equipment.flatMap((requirement) => requirement.anyOf.map((item) => EQUIPMENT_LABELS[item]));
      const haystack = [
        exercise.name,
        ...exercise.aliases,
        ...exercise.tags,
        ...exercise.purposes,
        ...exercise.primaryMuscles,
        ...equipmentText,
      ].join(" ").toLocaleLowerCase("cs");
      const quickMatches = quickFilter === "all"
        || exercise.tags.includes(quickFilter)
        || (quickFilter === "prehab" && (exercise.tags.includes("prehab") || exercise.category === "compensation"));
      return (category === "all" || exercise.category === category) && quickMatches && (!normalized || haystack.includes(normalized));
    }).sort((a, b) => a.name.localeCompare(b.name, "cs"));
  }, [category, query, quickFilter]);

  return (
    <PlanningShell
      eyebrow="3B · Knihovna"
      title="Cviky a pohyby"
      description="Katalog pro skládání workoutů po jednotlivých cvicích, změny podle vybavení, finishery, kompenzaci a budoucí týmové tréninky."
      backHref="/workouts"
    >
      <section className="ui-card p-4 sm:p-5">
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="ui-inset p-3"><p className="text-xl font-black">{stats.total}</p><p className="text-[10px] uppercase tracking-wide text-zinc-500">cviků</p></div>
          <div className="ui-inset p-3"><p className="text-xl font-black">{stats.finisher}</p><p className="text-[10px] uppercase tracking-wide text-zinc-500">finisherů</p></div>
          <div className="ui-inset p-3"><p className="text-xl font-black">{stats.machine}</p><p className="text-[10px] uppercase tracking-wide text-zinc-500">strojových</p></div>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Hledat cvik, sval, vybavení nebo účel…"
          className="ui-field"
        />
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Rychlý výběr</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {QUICK_FILTERS.map((filter) => (
            <button key={filter.id} type="button" aria-pressed={quickFilter === filter.id} onClick={() => setQuickFilter(filter.id)} className="ui-choice min-h-10 shrink-0 rounded-full px-3 py-2 text-sm">{filter.label}</button>
          ))}
        </div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Typ cvičení</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")} className="ui-choice min-h-10 shrink-0 rounded-full px-3 py-2 text-sm">Vše</button>
          {(Object.entries(EXERCISE_CATEGORY_LABELS) as Array<[ExerciseCategory, string]>).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)} className="ui-choice min-h-10 shrink-0 rounded-full px-3 py-2 text-sm">{label}</button>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">Zobrazeno {exercises.length} z {stats.total} cviků.</p>
      </section>

      <div className="mt-5 space-y-4">
        {exercises.map((exercise) => (
          <article key={exercise.id} className="ui-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="ui-chip ui-chip-accent">{EXERCISE_CATEGORY_LABELS[exercise.category]}</span>
              <span className="ui-chip">{exercise.movementFamily}</span>
              {exercise.tags.includes("finisher") && <span className="ui-chip">Finisher</span>}
              {exercise.team.modes.some((mode) => mode !== "solo") && <span className="ui-chip">Týmově připraveno</span>}
            </div>
            <h2 className="mt-4 text-2xl font-black">{exercise.name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{exercise.purposes.join(" · ")}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {exercise.equipment.length === 0 ? (
                <span className="ui-chip">Bez vybavení</span>
              ) : exercise.equipment.map((requirement, index) => (
                <span key={`${exercise.id}-eq-${index}`} className="ui-chip">
                  {requirement.anyOf.map((item) => item === "none" ? "volitelné" : EQUIPMENT_LABELS[item]).join(" / ")}
                </span>
              ))}
            </div>

            <div className="ui-inset mt-5 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Jak na to</p>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                {exercise.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
              </ol>
              <p className="mt-4 text-sm text-zinc-400"><b className="text-zinc-200">Cues:</b> {exercise.cues.join(" · ")}</p>
            </div>

            {exercise.commonMistakes.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-bold">Časté chyby</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{exercise.commonMistakes.join(" · ")}</p>
              </div>
            )}

            <div className="mt-4">
              <p className="text-sm font-bold">Týmové režimy</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {exercise.team.modes.map((mode) => <span key={mode} className="ui-chip">{mode}</span>)}
              </div>
            </div>

            <Link href={`/exercises/${encodeURIComponent(exercise.id)}`} className="ui-button ui-button-outline mt-5 w-full">
              Otevřít detail cviku
            </Link>
          </article>
        ))}
      </div>
    </PlanningShell>
  );
}
