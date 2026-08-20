"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import {
  buildRecoveryPlan,
  RECOVERY_AREA_LABELS,
  RECOVERY_DURATIONS,
  RECOVERY_INTENT_LABELS,
  type RecoveryArea,
  type RecoveryDurationMinutes,
  type RecoveryIntent,
} from "@/lib/recovery-builder";
import {
  EQUIPMENT_LABELS,
  TRAINING_LOCATION_PRESETS,
  resolveTrainingLocation,
} from "@/lib/training-context";
import type { ScheduledTrainingLocation, TrainingLocationPresetId } from "@/lib/types";

const INTENTS = Object.keys(RECOVERY_INTENT_LABELS) as RecoveryIntent[];
const AREAS = Object.keys(RECOVERY_AREA_LABELS) as RecoveryArea[];
const PRESET_LOCATIONS: TrainingLocationPresetId[] = ["standard-gym", "hybrid-gym", "outdoor", "home"];

export default function RecoveryPage() {
  const { data } = useHyroxData();
  const [intent, setIntent] = useState<RecoveryIntent>("cooldown");
  const [area, setArea] = useState<RecoveryArea>("full-body");
  const [durationMinutes, setDurationMinutes] = useState<RecoveryDurationMinutes>(8);
  const [locationId, setLocationId] = useState<ScheduledTrainingLocation>("home");
  const [variant, setVariant] = useState(0);

  const locationChoices = useMemo(() => [
    ...PRESET_LOCATIONS.map((id) => ({ id: id as ScheduledTrainingLocation, label: TRAINING_LOCATION_PRESETS[id].label })),
    ...(data.trainingLocations ?? []).map((location) => ({ id: location.id as ScheduledTrainingLocation, label: location.name })),
  ], [data.trainingLocations]);

  const location = useMemo(
    () => resolveTrainingLocation(locationId, data.trainingLocations ?? []),
    [data.trainingLocations, locationId],
  );
  const equipment = location?.equipment ?? ["none"];
  const plan = useMemo(
    () => buildRecoveryPlan({
      equipment,
      intent,
      area,
      durationMinutes,
      seed: `${locationId}-${intent}-${area}-${durationMinutes}-${variant}`,
    }),
    [area, durationMinutes, equipment, intent, locationId, variant],
  );

  return (
    <PlanningShell
      eyebrow="3B.2 · Regenerace"
      title="Regenerace & kompenzace"
      description="Krátké bloky pro přípravu, mobilitu, zklidnění a prehab podle času, oblasti a dostupného vybavení."
      backHref="/workouts"
    >
      <section className="ui-card p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">1 · Co potřebuješ?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTENTS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={intent === item}
              onClick={() => { setIntent(item); setVariant(0); }}
              className={intent === item ? "ui-chip ui-chip-accent" : "ui-chip"}
            >
              {RECOVERY_INTENT_LABELS[item]}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">2 · Zaměření</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {AREAS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={area === item}
              onClick={() => { setArea(item); setVariant(0); }}
              className={area === item ? "ui-chip ui-chip-accent" : "ui-chip"}
            >
              {RECOVERY_AREA_LABELS[item]}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">3 · Kolik máš času?</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {RECOVERY_DURATIONS.map((duration) => (
            <button
              key={duration}
              type="button"
              aria-pressed={durationMinutes === duration}
              onClick={() => { setDurationMinutes(duration); setVariant(0); }}
              className={durationMinutes === duration ? "ui-button ui-button-primary px-2" : "ui-button ui-button-outline px-2"}
            >
              {duration} min
            </button>
          ))}
        </div>

        <label className="mt-6 block text-xs font-black uppercase tracking-[0.18em] text-zinc-500" htmlFor="recovery-location">
          4 · Kde jsi?
        </label>
        <select
          id="recovery-location"
          value={locationId}
          onChange={(event) => { setLocationId(event.target.value as ScheduledTrainingLocation); setVariant(0); }}
          className="ui-field mt-3"
        >
          {locationChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
        </select>
        {location && (
          <div className="mt-3 flex flex-wrap gap-2">
            {location.equipment.slice(0, 6).map((item) => <span key={item} className="ui-chip text-[10px]">{EQUIPMENT_LABELS[item]}</span>)}
            {location.equipment.length > 6 && <span className="ui-chip text-[10px]">+ {location.equipment.length - 6} další</span>}
          </div>
        )}
      </section>

      <section className="ui-card ui-card-accent mt-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Návrh Enginn</p>
            <h2 className="mt-1 text-2xl font-black">{RECOVERY_INTENT_LABELS[intent]}</h2>
            <p className="mt-2 text-sm text-zinc-400">{RECOVERY_AREA_LABELS[area]} · {durationMinutes} min · {location?.label ?? "bez vybavení"}</p>
          </div>
          <span className="ui-chip ui-chip-accent shrink-0">{plan.exercises.length} cviků</span>
        </div>

        {plan.exercises.length > 0 ? (
          <ol className="mt-5 space-y-3">
            {plan.exercises.map((exercise, index) => (
              <li key={exercise.exerciseId} className="ui-inset p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent-soft font-black text-accent">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/exercises/${encodeURIComponent(exercise.exerciseId)}`} className="font-black text-zinc-100 underline-offset-4 hover:underline">
                      {exercise.name}
                    </Link>
                    <p className="mt-1 text-sm leading-5 text-zinc-400">{exercise.prescription}</p>
                    <p className="mt-2 text-xs text-zinc-500">{exercise.reason}</p>
                  </div>
                  <span className="ui-chip shrink-0 text-[10px]">Jak na to</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ui-feedback mt-5 text-sm">Pro tuto kombinaci zatím není dost vhodných cviků. Zkus celé tělo nebo jiné místo.</p>
        )}

        <button
          type="button"
          onClick={() => setVariant((current) => current + 1)}
          className="ui-button ui-button-outline mt-5 w-full"
        >
          Jiná sestava
        </button>

        <p className="mt-5 text-xs leading-5 text-zinc-500">
          Enginn Extra a kompenzační bloky slouží pro tréninkovou podporu, ne pro diagnostiku nebo léčbu. Ostrá nebo nezvyklá bolest je důvod cvik ukončit.
        </p>
      </section>
    </PlanningShell>
  );
}
