"use client";

import type { StepPerformance } from "@/lib/types";

export type StepPerformanceValues = Omit<StepPerformance, "blockId" | "stepId" | "round">;

type Props = {
  elapsedLabel: string;
  value?: StepPerformance;
  onChange: (value: StepPerformanceValues) => void;
};

function optionalNumber(value: string) {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function WorkoutPerformanceEditor({ elapsedLabel, value, onChange }: Props) {
  const summary = [
    value?.weightKg === undefined ? null : `${value.weightKg} kg`,
    value?.repetitions === undefined ? null : `${value.repetitions} opak.`,
    value?.completedRounds === undefined ? null : `${value.completedRounds} kol`,
    value?.rpe === undefined ? null : `RPE ${value.rpe}`,
  ].filter(Boolean).join(" · ");

  const update = (changes: Partial<StepPerformanceValues>) => {
    onChange({
      weightKg: value?.weightKg,
      repetitions: value?.repetitions,
      completedRounds: value?.completedRounds,
      rpe: value?.rpe,
      note: value?.note,
      ...changes,
    });
  };

  return (
    <details className="ui-card mt-7 text-left">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">Zapsat výkon</p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{summary || `Čas automaticky · ${elapsedLabel}`}</p>
        </div>
        <span className="shrink-0 text-xl text-accent" aria-hidden="true">＋</span>
      </summary>
      <div className="border-t border-white/8 p-4">
        <p className="text-xs text-zinc-500">Čas tohoto kroku se ukládá automaticky: <span className="font-mono text-zinc-300">{elapsedLabel}</span></p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold text-zinc-300">
            Váha (kg)
            <input type="number" min="0" max="1000" step="0.5" inputMode="decimal" value={value?.weightKg ?? ""} onChange={(event) => update({ weightKg: optionalNumber(event.target.value) })} className="ui-field mt-2" placeholder="24" />
          </label>
          <label className="text-sm font-semibold text-zinc-300">
            Opakování
            <input type="number" min="0" max="100000" step="1" inputMode="numeric" value={value?.repetitions ?? ""} onChange={(event) => update({ repetitions: optionalNumber(event.target.value) })} className="ui-field mt-2" placeholder="12" />
          </label>
          <label className="text-sm font-semibold text-zinc-300">
            Dokončená kola
            <input type="number" min="0" max="10000" step="1" inputMode="numeric" value={value?.completedRounds ?? ""} onChange={(event) => update({ completedRounds: optionalNumber(event.target.value) })} className="ui-field mt-2" placeholder="4" />
          </label>
          <label className="text-sm font-semibold text-zinc-300">
            RPE
            <select value={value?.rpe ?? ""} onChange={(event) => update({ rpe: optionalNumber(event.target.value) })} className="ui-field mt-2">
              <option value="">—</option>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((rpe) => <option key={rpe} value={rpe}>{rpe}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-4 block text-sm font-semibold text-zinc-300">
          Krátká poznámka
          <input type="text" maxLength={300} value={value?.note ?? ""} onChange={(event) => update({ note: event.target.value || undefined })} className="ui-field mt-2" placeholder="Technika, tempo, pocit…" />
        </label>
      </div>
    </details>
  );
}
