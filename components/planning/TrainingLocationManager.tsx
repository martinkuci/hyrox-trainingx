"use client";

import { useState } from "react";
import { useHyroxData } from "@/hooks/useHyroxData";
import {
  ALL_TRAINING_EQUIPMENT,
  EQUIPMENT_LABELS,
  TRAINING_LOCATION_PRESETS,
} from "@/lib/training-context";
import type { EquipmentId, TrainingLocationPresetId, TrainingLocationProfile } from "@/lib/types";

const setupPresets: Array<{ id: TrainingLocationPresetId; label: string }> = [
  { id: "hybrid-gym", label: "Hybridní fitko" },
  { id: "standard-gym", label: "Běžné fitko" },
  { id: "outdoor", label: "Venku" },
  { id: "home", label: "Doma / minimum" },
];

function EquipmentChecklist({
  selected,
  onChange,
}: {
  selected: EquipmentId[];
  onChange: (equipment: EquipmentId[]) => void;
}) {
  function toggle(item: EquipmentId) {
    onChange(
      selected.includes(item)
        ? selected.filter((value) => value !== item)
        : [...selected, item],
    );
  }

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {ALL_TRAINING_EQUIPMENT.map((item) => (
        <label key={item} className="ui-inset flex cursor-pointer items-center gap-3 p-3 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(item)}
            onChange={() => toggle(item)}
            className="h-5 w-5 accent-[var(--accent)]"
          />
          <span className="font-bold text-zinc-200">{EQUIPMENT_LABELS[item]}</span>
        </label>
      ))}
    </div>
  );
}

export function TrainingLocationManager() {
  const {
    data,
    createTrainingLocation,
    updateTrainingLocation,
    deleteTrainingLocation,
  } = useHyroxData();
  const locations = data.trainingLocations ?? [];
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState<EquipmentId[]>(ALL_TRAINING_EQUIPMENT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function resetForm() {
    setName("");
    setEquipment(ALL_TRAINING_EQUIPMENT);
    setEditingId(null);
  }

  function applyPreset(id: TrainingLocationPresetId) {
    const preset = TRAINING_LOCATION_PRESETS[id];
    setEquipment(preset.equipment.filter((item) => item !== "none"));
    setMessage(`Checklist byl předvyplněný podle typu „${preset.label}“. Teď uprav přesně to, co na konkrétním místě je nebo není.`);
  }

  function saveLocation() {
    const trimmed = name.trim();
    if (!trimmed) {
      setMessage("Doplň název místa nebo fitka.");
      return;
    }

    if (editingId) {
      updateTrainingLocation(editingId, { name: trimmed, equipment });
      setMessage(`Místo „${trimmed}“ bylo aktualizováno.`);
    } else {
      createTrainingLocation({ name: trimmed, equipment });
      setMessage(`Místo „${trimmed}“ bylo uloženo.`);
    }
    resetForm();
  }

  function editLocation(location: TrainingLocationProfile) {
    setEditingId(location.id);
    setName(location.name);
    setEquipment(location.equipment);
    setMessage("");
  }

  return (
    <section className="ui-card mt-6 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Místa a vybavení</p>
          <h2 className="mt-2 text-2xl font-black">Moje fitka a tréninková místa</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Ulož si konkrétní místo a jeho skutečnou výbavu. Předvolby níže slouží jen jako rychlý start checklistu; do programu se pak používá uložené místo s přesným vybavením.
          </p>
        </div>
        <span className="ui-chip ui-chip-accent shrink-0">{locations.length} míst</span>
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-bold text-zinc-300">Název místa</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Např. Form Factory Plzeň"
          className="ui-field mt-2"
        />
      </label>

      {!editingId && (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Začít podle typu místa</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {setupPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className="ui-button ui-button-outline ui-button-sm"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Předvolba nic neukládá a nebude později soutěžit s tvým místem. Jen předvyplní vybavení, které můžeš hned upravit.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setEquipment(ALL_TRAINING_EQUIPMENT)} className="ui-button ui-button-outline ui-button-sm">
          Označit vše
        </button>
        <button type="button" onClick={() => setEquipment([])} className="ui-button ui-button-secondary ui-button-sm">
          Odznačit vše
        </button>
        <span className="self-center text-xs text-zinc-500">Vybráno {equipment.length} z {ALL_TRAINING_EQUIPMENT.length}</span>
      </div>

      <EquipmentChecklist selected={equipment} onChange={setEquipment} />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={saveLocation} className="ui-button ui-button-primary">
          {editingId ? "Uložit změny místa" : "Uložit nové místo"}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} className="ui-button ui-button-outline">Zrušit úpravu</button>
        )}
      </div>
      {message && <p role="status" className="ui-feedback mt-4 text-sm font-bold">{message}</p>}

      {locations.length > 0 && (
        <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
          {locations.map((location) => (
            <div key={location.id} className="ui-inset p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-white">{location.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{location.equipment.length} z {ALL_TRAINING_EQUIPMENT.length} položek vybavení</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => editLocation(location)} className="ui-button ui-button-outline ui-button-sm">Upravit</button>
                  <button type="button" onClick={() => deleteTrainingLocation(location.id)} className="ui-button ui-button-danger ui-button-sm">Smazat</button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {location.equipment.map((item) => (
                  <span key={item} className="ui-chip text-[11px]">{EQUIPMENT_LABELS[item]}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
