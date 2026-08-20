import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import {
  EXERCISE_CATEGORY_LABELS,
  getExercise,
} from "@/lib/exercise-catalog";
import { EQUIPMENT_LABELS } from "@/lib/training-context";

const TEAM_MODE_LABELS: Record<string, string> = {
  solo: "Sólo",
  simultaneous: "Současně",
  "shared-reps": "Sdílená opakování",
  "shared-distance": "Sdílená vzdálenost",
  relay: "Štafeta",
  "you-go-i-go": "You go / I go",
};

function RelatedExercise({ id, label }: { id: string; label?: string }) {
  const exercise = getExercise(id);
  if (!exercise) return <span className="ui-chip">{label ?? id}</span>;
  return (
    <Link href={`/exercises/${encodeURIComponent(exercise.id)}`} className="ui-chip hover:border-accent/40 hover:text-accent">
      {label ?? exercise.name}
    </Link>
  );
}

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exercise = getExercise(id);
  if (!exercise) notFound();

  return (
    <PlanningShell
      eyebrow="3B · Jak na to"
      title={exercise.name}
      description={exercise.purposes.join(" · ")}
      backHref="/exercises"
    >
      <section className="ui-card p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <span className="ui-chip ui-chip-accent">{EXERCISE_CATEGORY_LABELS[exercise.category]}</span>
          <span className="ui-chip">{exercise.movementFamily}</span>
          {exercise.tags.includes("finisher") && <span className="ui-chip">Enginn Extra</span>}
        </div>

        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Potřebné vybavení</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {exercise.equipment.length === 0 ? (
              <span className="ui-chip">Bez vybavení</span>
            ) : exercise.equipment.map((requirement, index) => (
              <span key={`${exercise.id}-equipment-${index}`} className="ui-chip">
                {requirement.anyOf.map((item) => item === "none" ? "volitelné" : EQUIPMENT_LABELS[item]).join(" / ")}
              </span>
            ))}
          </div>
        </div>

        <div className="ui-inset mt-5 p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Jak na to</p>
          <ol className="mt-4 space-y-3">
            {exercise.instructions.map((instruction, index) => (
              <li key={instruction} className="flex gap-3 text-sm leading-6 text-zinc-300">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft font-black text-accent">{index + 1}</span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        </div>

        {exercise.cues.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Klíčové pokyny</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {exercise.cues.map((cue) => <span key={cue} className="ui-chip ui-chip-accent">{cue}</span>)}
            </div>
          </div>
        )}

        {exercise.commonMistakes.length > 0 && (
          <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Časté chyby</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
              {exercise.commonMistakes.map((mistake) => <li key={mistake}>• {mistake}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="ui-inset p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Regrese</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {exercise.regressions.length > 0
                ? exercise.regressions.map((item) => <RelatedExercise key={item} id={item} />)
                : <span className="text-sm text-zinc-500">Bez definované jednodušší varianty.</span>}
            </div>
          </div>
          <div className="ui-inset p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Progrese</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {exercise.progressions.length > 0
                ? exercise.progressions.map((item) => <RelatedExercise key={item} id={item} />)
                : <span className="text-sm text-zinc-500">Bez definované těžší varianty.</span>}
            </div>
          </div>
        </div>

        {exercise.alternatives.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Alternativy</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {exercise.alternatives.map((item) => <RelatedExercise key={item} id={item} />)}
            </div>
          </div>
        )}

        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Zapojené partie</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {exercise.primaryMuscles.map((muscle) => <span key={muscle} className="ui-chip">{muscle}</span>)}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Týmové použití</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {exercise.team.modes.map((mode) => <span key={mode} className="ui-chip">{TEAM_MODE_LABELS[mode] ?? mode}</span>)}
          </div>
          {exercise.team.requiresSingleStation && <p className="mt-2 text-xs text-zinc-500">Jedna stanice · vhodné pro střídání nebo sdílenou práci.</p>}
        </div>
      </section>
    </PlanningShell>
  );
}
