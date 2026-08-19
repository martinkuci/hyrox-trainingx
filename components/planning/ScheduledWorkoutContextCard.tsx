"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/planning/StatusBadge";
import {
  EQUIPMENT_LABELS,
  findLocationAlternatives,
  requiredEquipmentForTemplate,
  resolveTrainingLocation,
  templateFitsLocation,
  TRAINING_LOCATION_PRESETS,
  workoutContentSummary,
} from "@/lib/training-context";
import type {
  ScheduledTrainingLocation,
  ScheduledWorkout,
  ScheduledWorkoutStatus,
  TrainingLocationProfile,
  WorkoutTemplate,
} from "@/lib/types";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

type Props = {
  item: ScheduledWorkout;
  template: WorkoutTemplate;
  templates: WorkoutTemplate[];
  locations: TrainingLocationProfile[];
  onUpdate: (updates: Partial<Omit<ScheduledWorkout, "id">>) => void;
  onDelete: () => void;
};

export function ScheduledWorkoutContextCard({
  item,
  template,
  templates,
  locations,
  onUpdate,
  onDelete,
}: Props) {
  const location: ScheduledTrainingLocation = item.trainingLocation ?? "hybrid-gym";
  const equipment = requiredEquipmentForTemplate(template);
  const content = workoutContentSummary(template);
  const alternatives = findLocationAlternatives({
    current: template,
    templates,
    location,
    customLocations: locations,
  });
  const locationProfile = resolveTrainingLocation(location, locations)
    ?? resolveTrainingLocation("hybrid-gym", locations)!;
  const fitsLocation = templateFitsLocation(template, location, locations);

  function changeLocation(next: ScheduledTrainingLocation) {
    onUpdate({ trainingLocation: next });
  }

  function changeWorkout(templateId: string) {
    if (!templateId || templateId === template.id) return;
    onUpdate({
      templateId,
      originalTemplateId: item.originalTemplateId ?? item.templateId,
    });
  }

  return (
    <article className="ui-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="capitalize text-sm font-bold text-accent">{dateLabel(item.date)}</p>
          <h3 className="mt-1 text-2xl font-black">{template.title}</h3>
          <p className="mt-1 text-sm text-zinc-500">{template.durationMinutes} min</p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <details className="ui-inset mt-4 p-4" open={item.status === "planned"}>
        <summary className="cursor-pointer list-none font-black">Obsah tréninku a vybavení</summary>
        <p className="mt-2 text-sm text-zinc-400">{template.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {equipment.length === 0 ? (
            <span className="ui-chip">Bez speciálního vybavení</span>
          ) : (
            equipment.map((equipmentId) => (
              <span key={equipmentId} className="ui-chip">{EQUIPMENT_LABELS[equipmentId]}</span>
            ))
          )}
        </div>
        <div className="mt-4 space-y-2">
          {content.map((block) => (
            <div key={block.id} className="border-t border-white/10 pt-2 first:border-0 first:pt-0">
              <p className="text-sm font-bold text-white">{block.title}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{block.detail}</p>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Kde budu cvičit</span>
          <select
            value={location}
            onChange={(event) => changeLocation(event.target.value as ScheduledTrainingLocation)}
            className="ui-field mt-2 px-3 py-3 text-sm"
          >
            <optgroup label="Rychlé profily">
              {Object.entries(TRAINING_LOCATION_PRESETS).map(([value, preset]) => (
                <option key={value} value={value}>{preset.label}</option>
              ))}
            </optgroup>
            {locations.length > 0 && (
              <optgroup label="Moje místa">
                {locations.map((custom) => (
                  <option key={custom.id} value={custom.id}>{custom.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Rychlá změna tréninku</span>
          <select
            value=""
            onChange={(event) => changeWorkout(event.target.value)}
            className="ui-field mt-2 px-3 py-3 text-sm"
          >
            <option value="">Vybrat kompatibilní alternativu</option>
            {alternatives.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title} · {candidate.durationMinutes} min
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{locationProfile.description}</p>
      {!fitsLocation && item.status === "planned" && (
        <p className="ui-feedback ui-feedback-warning mt-3 text-sm font-bold">
          Na tomto místě chybí část vybavení pro aktuální trénink. Vyber kompatibilní alternativu nebo jiné místo.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label>
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Přesunout na</span>
          <input type="date" value={item.date} onChange={(event) => onUpdate({ date: event.target.value })} className="ui-field mt-2 px-3 py-3 text-sm" />
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Čas</span>
          <input type="time" value={item.time} onChange={(event) => onUpdate({ time: event.target.value })} className="ui-field mt-2 px-3 py-3 text-sm" />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Stav</span>
        <select value={item.status} onChange={(event) => onUpdate({ status: event.target.value as ScheduledWorkoutStatus })} className="ui-field mt-2 px-3 py-3 text-sm">
          <option value="planned">Naplánováno</option>
          <option value="completed">Dokončeno</option>
          <option value="skipped">Vynecháno</option>
        </select>
      </label>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
        <Link href={`/workout/${template.id}?scheduleId=${item.id}`} className="ui-button ui-button-accent">Spustit</Link>
        <button type="button" onClick={onDelete} className="ui-button ui-button-danger">Smazat</button>
      </div>
    </article>
  );
}
