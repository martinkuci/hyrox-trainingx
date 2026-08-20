"use client";

import { useMemo, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import {
  EXERCISE_CATEGORY_LABELS,
  EXERCISE_LIBRARY,
  type ExerciseCategory,
} from "@/lib/exercise-library";
import { EQUIPMENT_LABELS } from "@/lib/training-context";

export default function ExerciseLibraryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");

  const exercises = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("cs");
    return EXERCISE_LIBRARY.filter((exercise) => {
      const haystack = [
        exercise.name,
        ...exercise.aliases,
        ...exercise.tags,
        ...exercise.purposes,
        ...exercise.primaryMuscles,
      ].join(" ").toLocaleLowerCase("cs");
      return (category === "all" || exercise.category === category) && (!normalized || haystack.includes(normalized));
    });
  }, [category, query]);

  return (
    <PlanningShell
      eyebrow="3B · Knihovna"
      title="Cviky a pohyby"
      description="Strukturovaný katalog pro skládání tréninků, změny podle vybavení, kompenzace a budoucí týmové workouty."
      backHref="/workouts"
    >
      <section className="ui-card p-4 sm:p-5">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Hledat cvik, svalovou skupinu nebo účel…"
          className="ui-field"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")} className="ui-choice min-h-10 shrink-0 rounded-full px-3 py-2 text-sm">Vše</button>
          {(Object.entries(EXERCISE_CATEGORY_LABELS) as Array<[ExerciseCategory, string]>).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)} className="ui-choice min-h-10 shrink-0 rounded-full px-3 py-2 text-sm">{label}</button>
          ))}
        </div>
      </section>

      <div className="mt-5 space-y-4">
        {exercises.map((exercise) => (
          <article key={exercise.id} className="ui-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="ui-chip ui-chip-accent">{EXERCISE_CATEGORY_LABELS[exercise.category]}</span>
              <span className="ui-chip">{exercise.movementFamily}</span>
              {exercise.team.modes.some((mode) => mode !== "solo") && <span className="ui-chip">Týmově připraveno</span>}
            </div>
            <h2 className="mt-4 text-2xl font-black">{exercise.name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{exercise.purposes.join(" · ")}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {exercise.equipment.length === 0 ? (
                <span className="ui-chip">Bez vybavení</span>
              ) : exercise.equipment.map((requirement, index) => (
                <span key={`${exercise.id}-eq-${index}`} className="ui-chip">
                  {requirement.anyOf.map((item) => EQUIPMENT_LABELS[item]).join(" / ")}
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
          </article>
        ))}
      </div>
    </PlanningShell>
  );
}
