"use client";

import Link from "next/link";
import { useState } from "react";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { StepSplit, WorkoutTemplate } from "@/lib/types";

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
}

type Props = { template: WorkoutTemplate; scheduledWorkoutId?: string; durationSeconds: number; splits: StepSplit[] };

export default function WorkoutResultForm({ template, scheduledWorkoutId, durationSeconds, splits }: Props) {
  const { addResult, updateScheduledWorkout } = useHyroxData();
  const [rpe, setRpe] = useState(7); const [weights, setWeights] = useState(""); const [notes, setNotes] = useState(""); const [saved, setSaved] = useState(false);
  function save() {
    addResult({
      templateId: template.id,
      workoutTitle: template.title,
      workoutCode: template.metadata?.workoutCode,
      templateVersion: template.metadata?.templateVersion,
      metadataSnapshot: template.metadata ? structuredClone(template.metadata) : undefined,
      scheduledWorkoutId,
      completedAt: new Date().toISOString(), durationSeconds, rpe, weights: weights.trim(), notes: notes.trim(), splits,
      source: "runner",
    });
    if (scheduledWorkoutId) updateScheduledWorkout(scheduledWorkoutId, { status: "completed" });
    setSaved(true);
  }

  if (saved) {
    return (
      <main className="runner-shell safe-screen flex min-h-dvh items-center justify-center px-5 text-white">
        <section className="ui-card w-full max-w-md p-7 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m7 12 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-accent">Hotovo</p>
          <h1 className="mt-2 text-3xl font-black">Výsledek je uložený</h1>
          <p className="mt-3 text-zinc-400">Uložili jsme i kód, verzi a cílový profil tréninku pro budoucí porovnání.</p>
          <div className="mt-8 grid gap-3">
            <Link href="/history" className="ui-button ui-button-primary">Zobrazit historii</Link>
            <Link href="/" className="ui-button ui-button-outline">Zpět na přehled</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="runner-shell safe-screen min-h-dvh px-5 text-white">
      <section className="mx-auto max-w-md">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-accent">Trénink dokončen</p>
        {template.metadata?.workoutCode && <p className="ui-chip ui-chip-accent mt-3">{template.metadata.workoutCode}-V{template.metadata.templateVersion}</p>}
        <h1 className="mt-2 text-3xl font-black">{template.title}</h1>

        <div className="ui-card ui-card-accent mt-6 p-6">
          <p className="text-sm text-zinc-400">Celkový čas</p>
          <p className="mt-1 font-mono text-5xl font-black text-accent">{formatDuration(durationSeconds)}</p>
          <p className="mt-2 text-sm text-zinc-400">{splits.length} zaznamenaných úseků</p>
          {template.metadata && <p className="mt-3 text-sm text-zinc-300">Cíl: {template.metadata.expectedDurationMin}–{template.metadata.expectedDurationMax} min · RPE {template.metadata.targetRpeMin}–{template.metadata.targetRpeMax}</p>}
        </div>

        <div className="ui-card mt-5 p-6">
          <fieldset>
            <legend className="text-lg font-bold">Jak náročné to bylo?</legend>
            <p className="mt-1 text-sm text-zinc-400">RPE 1 = velmi lehké, 10 = maximum</p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <button key={value} type="button" aria-pressed={rpe === value} onClick={() => setRpe(value)} className="ui-choice px-1 py-3">{value}</button>
              ))}
            </div>
          </fieldset>
          <label className="mt-7 block font-semibold" htmlFor="weights">Použité váhy</label>
          <input id="weights" value={weights} onChange={(e) => setWeights(e.target.value)} placeholder="Např. wall ball 9 kg, KB 24 kg" className="ui-field mt-2 text-base" />
          <label className="mt-6 block font-semibold" htmlFor="notes">Poznámka</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Co bylo nejtěžší? Jak ses cítil?" rows={4} className="ui-field mt-2 resize-none text-base" />
          <button type="button" onClick={save} className="ui-button ui-button-primary ui-button-lg mt-7 w-full">Uložit výsledek</button>
        </div>
      </section>
    </main>
  );
}
