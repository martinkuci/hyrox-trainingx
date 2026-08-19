"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHyroxData } from "@/hooks/useHyroxData";
import {
  resolveTrainingLocation,
  TRAINING_LOCATION_PRESETS,
} from "@/lib/training-context";
import {
  planTrainingLocationChange,
  type TrainingLocationChangeOutcome,
} from "@/lib/training-location-change";
import type {
  ProgramPhase,
  ScheduledTrainingLocation,
  ScheduledWorkout,
  WorkoutTemplate,
} from "@/lib/types";

const ADD_LOCATION_VALUE = "__add-location__";
const quickLocationIds: ScheduledTrainingLocation[] = ["outdoor", "home"];
const legacyLocationIds: ScheduledTrainingLocation[] = ["standard-gym", "hybrid-gym"];

function outcomeMessage(
  outcome: TrainingLocationChangeOutcome,
  locationLabel: string,
  templateTitle: string,
) {
  if (outcome === "restored-original") {
    return `Místo nastaveno na ${locationLabel}. Enginn obnovil původně naplánovaný trénink.`;
  }
  if (outcome === "kept-current") {
    return `Místo nastaveno na ${locationLabel}. Trénink může zůstat beze změny.`;
  }
  if (outcome === "adapted") {
    return `Místo nastaveno na ${locationLabel}. Enginn automaticky upravil jednotku na ${templateTitle}.`;
  }
  return `Místo nastaveno na ${locationLabel}, ale pro tuto jednotku zatím není v katalogu plně kompatibilní varianta.`;
}

export function TrainingLocationSelector({
  schedule,
  template,
  phase,
  returnTo,
  label = "Kde budu cvičit",
  showNotice = true,
}: {
  schedule: ScheduledWorkout;
  template: WorkoutTemplate;
  phase?: ProgramPhase;
  returnTo: string;
  label?: string;
  showNotice?: boolean;
}) {
  const router = useRouter();
  const { data, updateScheduledWorkout } = useHyroxData();
  const [notice, setNotice] = useState("");
  const customLocations = data.trainingLocations ?? [];
  const selectedProfile = schedule.trainingLocation
    ? resolveTrainingLocation(schedule.trainingLocation, customLocations)
    : null;
  const isLegacy = Boolean(
    schedule.trainingLocation && legacyLocationIds.includes(schedule.trainingLocation),
  );

  function applyLocation(nextLocation?: ScheduledTrainingLocation) {
    if (nextLocation === schedule.trainingLocation) return;
    const plan = planTrainingLocationChange({
      schedule,
      currentTemplate: template,
      templates: data.templates,
      location: nextLocation,
      customLocations,
      phase,
    });
    updateScheduledWorkout(schedule.id, plan.updates);

    if (!nextLocation) {
      setNotice(
        plan.outcome === "restored-original"
          ? "Místo necháváme otevřené. Enginn obnovil původně naplánovanou jednotku."
          : "Místo necháváme otevřené a vybereš ho až v den tréninku.",
      );
      return;
    }

    const profile = resolveTrainingLocation(nextLocation, customLocations);
    setNotice(outcomeMessage(
      plan.outcome,
      profile?.label ?? "vybrané místo",
      plan.selectedTemplate.title,
    ));
  }

  function handleChange(value: string) {
    if (value === ADD_LOCATION_VALUE) {
      const params = new URLSearchParams({
        new: "1",
        scheduleId: schedule.id,
        returnTo,
      });
      router.push(`/account/locations?${params.toString()}`);
      return;
    }
    applyLocation(value ? value as ScheduledTrainingLocation : undefined);
  }

  return (
    <div>
      <label className="block">
        <span className="text-sm font-bold text-zinc-300">{label}</span>
        <select
          value={schedule.trainingLocation ?? ""}
          onChange={(event) => handleChange(event.target.value)}
          className="ui-field mt-2"
        >
          <option value="">Rozhodnu až v den tréninku</option>
          {isLegacy && schedule.trainingLocation && (
            <optgroup label="Původní obecný profil">
              <option value={schedule.trainingLocation}>
                {TRAINING_LOCATION_PRESETS[schedule.trainingLocation as "standard-gym" | "hybrid-gym"].label}
              </option>
            </optgroup>
          )}
          <optgroup label="Rychlá prostředí">
            {quickLocationIds.map((locationId) => (
              <option key={locationId} value={locationId}>
                {TRAINING_LOCATION_PRESETS[locationId as "outdoor" | "home"].label}
              </option>
            ))}
          </optgroup>
          {customLocations.length > 0 && (
            <optgroup label="Moje místa">
              {customLocations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </optgroup>
          )}
          <option value={ADD_LOCATION_VALUE}>＋ Přidat nové místo…</option>
        </select>
      </label>

      {selectedProfile && (
        <p className="mt-2 text-xs leading-5 text-zinc-500">{selectedProfile.description}</p>
      )}
      {showNotice && notice && (
        <p role="status" className="ui-feedback ui-feedback-success mt-3 text-xs font-bold leading-5">
          {notice}
        </p>
      )}
    </div>
  );
}
