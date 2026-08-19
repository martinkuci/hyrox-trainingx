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
  { id: "standard-gym", label: "Běžné fitko" },
  { id: "hybrid-gym", label: "Hybridní fitko" },
  { id: "outdoor", label: "Venku" },
  { id: "home", label: "Doma / minimum" },
];

const equipmentGroups: Array<{ label: string; items: EquipmentId[] }> = [
  {
    label: "Kardio",
    items: ["running", "treadmill", "ski-erg", "rower", "bike-erg", "air-bike"],
  },
  {
    label: "Hybrid / funkční zóna",
    items: ["sled", "sandbag", "medicine-ball", "wall-ball", "box"],
  },
  {
    label: "Síla a doplňky",
    items: ["kettlebell", "dumbbell", "barbell", "rack", "bench", "pull-up-bar", "cable-machine", "resistance-band"],
  },
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
    <div className="mt-4 max-h-[46vh] space-y-4 overflow-y-auto overscroll-contain pr-1">
      {equipmentGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{group.label}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {group.items.map((item) => (
              <label
                key={item}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/8 bg-black/15 px-2.5 py-2 text-xs"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(item)}
                  onChange={() => toggle(item)}
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="font-bold leading-4 text-zinc-200">{EQUIPMENT_LABELS[item]}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrainingLocationManager({
  onLocationCreated,
  startOpen = false,
}: {
  onLocationCreated?: (location: TrainingLocationProfile) => void;
  startOpen?: boolean;
}) {
  const {
    data,
    createTrainingLocation,
    updateTrainingLocation,
    deleteTrainingLocation,
  } = useHyroxData();
  const locations = data.trainingLocations ?? [];
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(startOpen);
  const [message, setMessage] = useState("");

  function resetForm(closeEditor = true) {
    setName("");
    setEquipment([]);
    setEditingId(null);
    if (closeEditor) setEditorOpen(false);
  }

  function startNewLocation() {
    resetForm(false);
    setMessage("");
    setEditorOpen(true);
  }

  function applyPreset(id: TrainingLocationPresetId) {
    const preset = TRAINING_LOCATION_PRESETS[id];
    setEquipment(preset.equipment.filter((item) => item !== "none"));
    setMessage(`Předvyplněno podle typu „${preset.label}“. Uprav jen rozdíly oproti skutečnému místu.`);
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
      const location = createTrainingLocation({ name: trimmed, equipment });
      onLocationCreated?.(location);
      setMessage(`Místo „${trimmed}“ bylo uloženo a můžeš ho rovnou použít v programu.`);
    }
    resetForm();
  }

  function editLocation(location: TrainingLocationProfile) {
    setEditingId(location.id);
    setName(location.name);
    setEquipment(location.equipment);
    setMessage("");
    setEditorOpen(true);
  }

  return (
    <section className="ui-card mt-5 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Moje místa</p>
          <p className="mt-1 text-sm leading-5 text-zinc-400">
            Volitelné. Ulož si jen fitka, která chceš plánovat podle skutečné výbavy.
          </p>
        </div>
        <button type="button" onClick={startNewLocation} className="ui-button ui-button-outline ui-button-sm shrink-0">
          + Přidat místo
        </button>
      </div>

      {locations.length > 0 && (
        <div className="mt-4 space-y-2">
          {locations.map((location) => (
            <div key={location.id} className="ui-inset flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{location.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{location.equipment.length} z {ALL_TRAINING_EQUIPMENT.length} položek vybavení</p>
                {location.equipment.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {location.equipment.slice(0, 3).map((item) => (
                      <span key={item} className="ui-chip text-[10px]">{EQUIPMENT_LABELS[item]}</span>
                    ))}
                    {location.equipment.length > 3 && (
                      <span className="ui-chip text-[10px]">+{location.equipment.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" onClick={() => editLocation(location)} className="ui-button ui-button-outline ui-button-sm">Upravit</button>
                <button type="button" onClick={() => deleteTrainingLocation(location.id)} className="ui-button ui-button-danger ui-button-sm">Smazat</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <div className="ui-inset mt-4 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-black text-white">{editingId ? "Upravit místo" : "Nové místo"}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Začni prázdně nebo si nech výbavu předvyplnit podle typu fitka.</p>
            </div>
            <button type="button" onClick={() => resetForm()} className="ui-button ui-button-ghost ui-button-sm">Zavřít</button>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-zinc-300">Název místa</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Např. Staráč"
              className="ui-field mt-2"
            />
          </label>

          {!editingId && (
            <div className="mt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Rychlé předvyplnění</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {setupPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="ui-button ui-button-outline ui-button-sm min-h-10 px-2 text-xs"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-zinc-300">Co tam opravdu je?</p>
            <span className="text-xs text-zinc-500">{equipment.length}/{ALL_TRAINING_EQUIPMENT.length}</span>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setEquipment(ALL_TRAINING_EQUIPMENT)} className="ui-button ui-button-outline ui-button-sm">Vše</button>
            <button type="button" onClick={() => setEquipment([])} className="ui-button ui-button-secondary ui-button-sm">Nic</button>
          </div>

          <EquipmentChecklist selected={equipment} onChange={setEquipment} />

          <details className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3 text-xs text-zinc-400">
            <summary className="cursor-pointer font-bold text-zinc-300">Nevím, co některé vybavení znamená</summary>
            <p className="mt-2 leading-5">
              Klidně ho nech nezaškrtnuté a doplň ho později. SkiErg je stojící tahový ergometr, air bike je větrákové kolo s madly, rack je stojan na osu a sled jsou saně na tlačení nebo tahání.
            </p>
          </details>

          <div className="sticky bottom-0 -mx-3 mt-4 border-t border-white/8 bg-surface/95 px-3 pb-1 pt-3 backdrop-blur sm:-mx-4 sm:px-4">
            <button type="button" onClick={saveLocation} className="ui-button ui-button-primary w-full">
              {editingId ? "Uložit změny" : "Uložit místo"}
            </button>
          </div>
        </div>
      )}

      {message && <p role="status" className="ui-feedback mt-3 text-sm font-bold">{message}</p>}
    </section>
  );
}
