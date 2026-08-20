"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import {
  EQUIPMENT_LABELS,
  TRAINING_LOCATION_PRESETS,
  resolveTrainingLocation,
} from "@/lib/training-context";
import {
  buildGeneratedWorkout,
  GENERATED_WORKOUT_DURATIONS,
  GENERATED_WORKOUT_GOAL_LABELS,
  type GeneratedWorkoutDurationMinutes,
  type GeneratedWorkoutGoal,
} from "@/lib/workout-composer";
import type { ScheduledTrainingLocation } from "@/lib/types";

const GOALS = Object.keys(GENERATED_WORKOUT_GOAL_LABELS) as GeneratedWorkoutGoal[];
const PRESET_LOCATIONS: ScheduledTrainingLocation[] = ["standard-gym", "hybrid-gym", "outdoor", "home"];

export default function GeneratedWorkoutPage() {
  const router = useRouter();
  const { data, ready, createTemplate } = useHyroxData();
  const [goal, setGoal] = useState<GeneratedWorkoutGoal>("mixed");
  const [durationMinutes, setDurationMinutes] = useState<GeneratedWorkoutDurationMinutes>(45);
  const [locationId, setLocationId] = useState<ScheduledTrainingLocation>("standard-gym");
  const [variant, setVariant] = useState(0);
  const [savedMessage, setSavedMessage] = useState<string>();

  const locationChoices = useMemo(() => [
    ...PRESET_LOCATIONS.map((id) => ({ id, label: TRAINING_LOCATION_PRESETS[id].label })),
    ...(data.trainingLocations ?? []).map((location) => ({ id: location.id as ScheduledTrainingLocation, label: location.name })),
  ], [data.trainingLocations]);

  const location = useMemo(
    () => resolveTrainingLocation(locationId, data.trainingLocations ?? []),
    [data.trainingLocations, locationId],
  );
  const equipment = location?.equipment ?? ["none"];
  const preview = useMemo(
    () => buildGeneratedWorkout({
      equipment,
      goal,
      durationMinutes,
      seed: `${locationId}-${goal}-${durationMinutes}-variant-${variant}`,
      locationLabel: location?.label,
    }),
    [durationMinutes, equipment, goal, location?.label, locationId, variant],
  );
  const stepCount = preview.blocks.reduce((sum, block) => sum + block.steps.length, 0);

  function changeGoal(nextGoal: GeneratedWorkoutGoal) {
    setGoal(nextGoal);
    setVariant(0);
    setSavedMessage(undefined);
  }

  function changeDuration(nextDuration: GeneratedWorkoutDurationMinutes) {
    setDurationMinutes(nextDuration);
    setVariant(0);
    setSavedMessage(undefined);
  }

  function changeLocation(nextLocation: ScheduledTrainingLocation) {
    setLocationId(nextLocation);
    setVariant(0);
    setSavedMessage(undefined);
  }

  function saveTemplate() {
    const created = createTemplate(preview);
    setSavedMessage(`Uloženo jako ${created.title}.`);
    return created;
  }

  function saveAndStart() {
    const created = saveTemplate();
    router.push(`/workout/${encodeURIComponent(created.id)}`);
  }

  return (
    <PlanningShell
      eyebrow="3B · Generátor"
      title="Sestavit workout"
      description="Enginn skládá nový workout z jednotlivých cviků podle cíle, času a vybavení konkrétního místa."
      backHref="/workouts"
    >
      <section className="ui-card p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">1 · Cíl tréninku</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {GOALS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={goal === item}
              onClick={() => changeGoal(item)}
              className={goal === item ? "ui-chip ui-chip-accent" : "ui-chip"}
            >
              {GENERATED_WORKOUT_GOAL_LABELS[item]}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">2 · Kolik máš času?</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {GENERATED_WORKOUT_DURATIONS.map((duration) => (
            <button
              key={duration}
              type="button"
              aria-pressed={durationMinutes === duration}
              onClick={() => changeDuration(duration)}
              className={durationMinutes === duration ? "ui-button ui-button-primary px-2" : "ui-button ui-button-outline px-2"}
            >
              {duration} min
            </button>
          ))}
        </div>

        <label className="mt-6 block text-xs font-black uppercase tracking-[0.18em] text-zinc-500" htmlFor="generated-location">
          3 · Kde budeš cvičit?
        </label>
        <select
          id="generated-location"
          value={locationId}
          onChange={(event) => changeLocation(event.target.value as ScheduledTrainingLocation)}
          className="ui-field mt-3"
        >
          {locationChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
        </select>

        {location && (
          <div className="mt-3 flex flex-wrap gap-2">
            {location.equipment.slice(0, 8).map((item) => <span key={item} className="ui-chip text-[10px]">{EQUIPMENT_LABELS[item]}</span>)}
            {location.equipment.length > 8 && <span className="ui-chip text-[10px]">+ {location.equipment.length - 8} další</span>}
          </div>
        )}
      </section>

      <section className="ui-card ui-card-accent mt-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Návrh Enginn</p>
            <h2 className="mt-1 text-2xl font-black">{preview.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{preview.description}</p>
          </div>
          <span className="ui-chip ui-chip-accent shrink-0">{stepCount} cviků</span>
        </div>

        <div className="mt-5 space-y-4">
          {preview.blocks.map((block, blockIndex) => (
            <section key={block.id} className="ui-inset p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Blok {blockIndex + 1}</p>
                  <h3 className="mt-1 font-black text-zinc-100">{block.title}</h3>
                </div>
                <span className="ui-chip text-[10px]">
                  {block.type === "amrap" ? `${block.minutes} min AMRAP` : block.type === "manual" ? `${block.repeat}×` : block.type}
                </span>
              </div>
              <ol className="mt-3 space-y-2">
                {block.steps.map((step, index) => (
                  <li key={step.id} className="rounded-xl bg-surface px-3 py-2.5">
                    <div className="flex items-start gap-3">
                      <span className="font-black text-accent">{index + 1}.</span>
                      <div className="min-w-0 flex-1">
                        {step.exerciseId ? (
                          <Link href={`/exercises/${encodeURIComponent(step.exerciseId)}`} className="font-bold text-zinc-100 underline-offset-4 hover:underline">
                            {step.name}
                          </Link>
                        ) : (
                          <p className="font-bold text-zinc-100">{step.name}</p>
                        )}
                        <p className="mt-0.5 text-xs leading-5 text-zinc-500">{step.detail}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        {savedMessage && <p className="ui-feedback ui-feedback-success mt-4 text-sm">{savedMessage}</p>}

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => { setVariant((current) => current + 1); setSavedMessage(undefined); }} className="ui-button ui-button-outline">
            Jiná sestava
          </button>
          <button type="button" onClick={saveTemplate} disabled={!ready || stepCount === 0} className="ui-button ui-button-secondary disabled:opacity-40">
            Uložit do knihovny
          </button>
          <button type="button" onClick={saveAndStart} disabled={!ready || stepCount === 0} className="ui-button ui-button-primary disabled:opacity-40">
            Uložit a spustit
          </button>
        </div>
      </section>
    </PlanningShell>
  );
}
