"use client";

import Link from "next/link";
import { useState } from "react";
import { EnginnWordmark } from "@/components/EnginnBrand";
import EnginnExtra from "@/components/EnginnExtra";
import { useHyroxData } from "@/hooks/useHyroxData";
import { blockFeedbackLabel, blockFeedbackToRpe } from "@/lib/block-feedback";
import { resolveTrainingLocation } from "@/lib/training-context";
import type { BlockFeedback, EnginnExtraResult, EquipmentId, StepSplit, WorkoutTemplate } from "@/lib/types";

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
}

type Props = { template: WorkoutTemplate; scheduledWorkoutId?: string; durationSeconds: number; splits: StepSplit[]; blockFeedbacks: BlockFeedback[] };

export default function WorkoutResultForm({ template, scheduledWorkoutId, durationSeconds, splits, blockFeedbacks }: Props) {
  const { data, addResult, updateResult, updateScheduledWorkout } = useHyroxData();
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedResultId, setSavedResultId] = useState<string>();
  const scheduledWorkout = scheduledWorkoutId
    ? data.scheduledWorkouts.find((item) => item.id === scheduledWorkoutId)
    : undefined;
  const exerciseOverrides = scheduledWorkout?.exerciseOverrides ?? [];
  const location = scheduledWorkout?.trainingLocation
    ? resolveTrainingLocation(scheduledWorkout.trainingLocation, data.trainingLocations ?? [])
    : null;
  const extraEquipment: EquipmentId[] = location?.equipment ?? ["none"];
  const rpe = blockFeedbacks.length > 0
    ? Math.round(blockFeedbacks.reduce((sum, feedback) => sum + blockFeedbackToRpe(feedback.rating), 0) / blockFeedbacks.length)
    : 7;
  const durationMinutes = Math.round(durationSeconds / 60);
  const durationComparison = template.metadata
    ? durationMinutes < template.metadata.expectedDurationMin
      ? `${template.metadata.expectedDurationMin - durationMinutes} min pod plánem`
      : durationMinutes > template.metadata.expectedDurationMax
        ? `${durationMinutes - template.metadata.expectedDurationMax} min nad plánem`
        : "V plánovaném rozmezí"
    : null;
  const rpeComparison = template.metadata
    ? rpe < template.metadata.targetRpeMin
      ? "Lehčí než plán"
      : rpe > template.metadata.targetRpeMax
        ? "Těžší než plán"
        : "V plánovaném rozmezí"
    : null;

  function save() {
    const result = addResult({
      templateId: template.id,
      workoutTitle: template.title,
      workoutCode: template.metadata?.workoutCode,
      templateVersion: template.metadata?.templateVersion,
      metadataSnapshot: template.metadata ? structuredClone(template.metadata) : undefined,
      scheduledWorkoutId,
      exerciseOverridesSnapshot: exerciseOverrides.length > 0 ? structuredClone(exerciseOverrides) : undefined,
      completedAt: new Date().toISOString(), durationSeconds, rpe, weights: "", notes: notes.trim(), splits, blockFeedbacks,
      source: "runner",
    });
    if (scheduledWorkoutId) updateScheduledWorkout(scheduledWorkoutId, { status: "completed" });
    setSavedResultId(result.id);
    setSaved(true);
  }

  function saveEnginnExtra(extra: EnginnExtraResult) {
    if (!savedResultId) return;
    updateResult(savedResultId, { enginnExtra: extra });
  }

  if (saved) {
    return (
      <main className="runner-shell safe-screen min-h-dvh px-4 text-white">
        <section className="mx-auto w-full max-w-md space-y-4">
          <div className="ui-card p-6 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
              <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m7 12 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-accent">Hotovo</p>
            <h1 className="mt-2 text-3xl font-black">Výsledek je uložený</h1>
            <p className="mt-3 text-zinc-400">Hlavní trénink je bezpečně uložený. Pokud máš ještě pár minut, Enginn Extra ti sestaví krátký doplněk podle cíle a dostupného vybavení.</p>
            {exerciseOverrides.length > 0 && <p className="ui-feedback ui-feedback-success mt-4 text-sm">Výsledek si pamatuje použitou variantu {exerciseOverrides.length} nahrazených cviků, takže se nebude míchat s přesným benchmarkem originálu.</p>}
          </div>

          <EnginnExtra
            equipment={extraEquipment}
            seed={`${template.id}-${scheduledWorkoutId ?? "free"}-${new Date().toISOString().slice(0, 10)}`}
            locationLabel={location?.label}
            onComplete={saveEnginnExtra}
          />

          <div className="grid gap-3 pb-6">
            <Link href="/" className="ui-button ui-button-primary">Zobrazit doporučení</Link>
            <Link href="/history" className="ui-button ui-button-outline">Zobrazit historii</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="runner-shell safe-screen min-h-dvh px-4 text-white">
      <section className="mx-auto max-w-md">
        <div className="flex justify-center" role="img" aria-label="Enginn"><EnginnWordmark className="h-[1.1rem] w-auto" /></div>
        <div className="mt-4 flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Trénink dokončen</p><h1 className="mt-1 text-2xl font-black leading-tight">{template.title}</h1></div>{template.metadata?.workoutCode && <p className="ui-chip ui-chip-accent shrink-0">{template.metadata.workoutCode}-V{template.metadata.templateVersion}</p>}</div>
        {exerciseOverrides.length > 0 && <p className="ui-chip mt-3">Přizpůsobená varianta · {exerciseOverrides.length} změn</p>}

        <div className="ui-card ui-card-accent mt-4 grid grid-cols-[1fr_auto] items-end gap-4 p-5">
          <div><p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Celkový čas</p><p className="mt-1 font-mono text-4xl font-black text-accent">{formatDuration(durationSeconds)}</p></div>
          <div className="text-right"><p className="text-xs text-zinc-500">Hotové úseky</p><p className="mt-1 text-xl font-black">{splits.length}</p></div>
        </div>

        {blockFeedbacks.length > 0 && <div className="mt-4"><h2 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Hodnocení bloků</h2><div className="mt-2 space-y-2">{blockFeedbacks.map((feedback) => { const block = template.blocks.find((item) => item.id === feedback.blockId); return <div key={feedback.blockId} className="ui-inset flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate font-bold">{block?.title ?? "Blok"}</p><p className="mt-0.5 text-xs text-zinc-500">{blockFeedbackLabel(feedback.rating)}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft font-black text-accent">{feedback.rating}</span></div>; })}</div></div>}

        <div className="ui-card mt-4 p-5">
          {template.metadata && <div className="ui-inset grid grid-cols-2 gap-3 p-4 text-sm"><div><p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Čas vs. plán</p><p className="mt-1 font-bold text-zinc-100">{durationComparison}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Zátěž vs. plán</p><p className="mt-1 font-bold text-zinc-100">{rpeComparison}</p></div></div>}
          <label className="mt-4 block font-semibold" htmlFor="notes">Poznámka k tréninku <span className="font-normal text-zinc-500">(volitelné)</span></label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Co chceš příště změnit?" rows={3} className="ui-field mt-2 resize-none text-base" />
          <button type="button" onClick={save} className="ui-button ui-button-primary mt-4 w-full">Uložit výsledek</button>
        </div>
      </section>
    </main>
  );
}