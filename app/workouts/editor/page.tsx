"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { NewWorkoutTemplate, WorkoutBlock, WorkoutMetadata, WorkoutStep } from "@/lib/types";
import { emptyMetadata, normalizeMetadata, WORKOUT_CATEGORIES } from "@/lib/workout-metadata";

const inputClass = "mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-white outline-none placeholder:text-zinc-500 focus:border-lime-400";
const uid = () => crypto.randomUUID();
const blankStep = (): WorkoutStep => ({ id: uid(), name: "", detail: "" });
const blankManualBlock = (): WorkoutBlock => ({ id: uid(), type: "manual", title: "Nový blok", repeat: 1, steps: [blankStep()] });
const normalizeTags = (value: string) => Array.from(new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)));

function emptyDraft(): NewWorkoutTemplate {
  return { title: "", description: "", durationMinutes: 45, tags: [], metadata: emptyMetadata(), blocks: [blankManualBlock()] };
}

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const { data, ready, createTemplate, updateTemplate } = useHyroxData();
  const [editedDraft, setDraft] = useState<NewWorkoutTemplate | null>(null);
  const [error, setError] = useState("");
  const template = editId ? data.templates.find((item) => item.id === editId) : undefined;
  const knownTags = useMemo(() => Array.from(new Set(data.templates.flatMap((item) => item.tags ?? []))).sort(), [data.templates]);
  const initialDraft = useMemo<NewWorkoutTemplate>(() => template ? {
    title: template.title, description: template.description, durationMinutes: template.durationMinutes,
    tags: [...(template.tags ?? [])], metadata: template.metadata ? structuredClone(template.metadata) : emptyMetadata(),
    blocks: structuredClone(template.blocks),
  } : emptyDraft(), [template]);
  const draft = editedDraft ?? initialDraft;
  const metadata = draft.metadata ?? emptyMetadata();
  const setMetadata = (updates: Partial<WorkoutMetadata>) => setDraft({ ...draft, metadata: { ...metadata, ...updates } });

  if (!ready) return <PlanningShell eyebrow="Trénovat" title="Načítám…" backHref="/workouts"><div className="h-64 animate-pulse rounded-3xl bg-zinc-900" /></PlanningShell>;

  function replaceBlock(index: number, block: WorkoutBlock) { setDraft({ ...draft, blocks: draft.blocks.map((item, i) => i === index ? block : item) }); }
  function updateStep(blockIndex: number, stepIndex: number, updates: Partial<WorkoutStep>) {
    const block = draft.blocks[blockIndex];
    replaceBlock(blockIndex, { ...block, steps: block.steps.map((step, index) => index === stepIndex ? { ...step, ...updates } : step) });
  }
  function moveBlock(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= draft.blocks.length) return; const blocks = [...draft.blocks]; [blocks[index], blocks[target]] = [blocks[target], blocks[index]]; setDraft({ ...draft, blocks }); }
  function moveStep(blockIndex: number, stepIndex: number, direction: -1 | 1) { const block = draft.blocks[blockIndex]; const target = stepIndex + direction; if (target < 0 || target >= block.steps.length) return; const steps = [...block.steps]; [steps[stepIndex], steps[target]] = [steps[target], steps[stepIndex]]; replaceBlock(blockIndex, { ...block, steps }); }

  function save() {
    const title = draft.title.trim();
    if (!title) return setError("Doplň název tréninku.");
    if (!draft.blocks.length || draft.blocks.some((block) => !block.steps.length || block.steps.some((step) => !step.name.trim()))) return setError("Každý blok musí obsahovat pojmenovaný cvik.");
    const cleanDraft: NewWorkoutTemplate = {
      ...draft, title, description: draft.description.trim(), durationMinutes: Math.max(1, draft.durationMinutes),
      tags: normalizeTags((draft.tags ?? []).join(",")), metadata: normalizeMetadata(draft.metadata),
      blocks: draft.blocks.map((block) => ({ ...block, title: block.title.trim() || (block.type === "emom" ? "EMOM" : "Tréninkový blok"), steps: block.steps.map((step) => ({ ...step, name: step.name.trim(), detail: step.detail.trim() })) })),
    };
    if (editId) updateTemplate(editId, cleanDraft); else createTemplate(cleanDraft);
    router.push("/workouts");
  }

  return <PlanningShell eyebrow="Trénovat" title={editId ? "Upravit trénink" : "Nový trénink"} description="Jednotná struktura tréninku umožní sledovat progres, rekordy a později adaptivní doporučení." backHref="/workouts">
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <label className="font-bold" htmlFor="title">Název</label><input id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Např. Base Engine" className={inputClass} />
      <label className="mt-5 block font-bold" htmlFor="description">Popis</label><textarea id="description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} className={`${inputClass} resize-none`} />
      <label className="mt-5 block font-bold" htmlFor="tags">Tagy</label><input id="tags" value={(draft.tags ?? []).join(", ")} onChange={(e) => setDraft({ ...draft, tags: normalizeTags(e.target.value) })} placeholder="běh, síla, stanoviště" className={inputClass} />
      {knownTags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{knownTags.map((tag) => { const selected = draft.tags.includes(tag); return <button key={tag} type="button" onClick={() => setDraft({ ...draft, tags: selected ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag] })} className={`rounded-full px-3 py-2 text-xs font-bold ${selected ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>{tag}</button>; })}</div>}
      <label className="mt-5 block font-bold" htmlFor="duration">Plánovaná délka</label><input id="duration" type="number" min={1} value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) || 1 })} className={`${inputClass} max-w-44`} />
    </section>

    <section className="mt-6 rounded-3xl border border-lime-400/25 bg-zinc-900 p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Tréninkový profil</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Kód tréninku"><input value={metadata.workoutCode} onChange={(e) => setMetadata({ workoutCode: e.target.value })} placeholder="HYX-001" className={inputClass} /></Field>
        <Field label="Verze"><input type="number" min={1} value={metadata.templateVersion} onChange={(e) => setMetadata({ templateVersion: Number(e.target.value) || 1 })} className={inputClass} /></Field>
        <Field label="Kategorie"><select value={metadata.category} onChange={(e) => setMetadata({ category: e.target.value as WorkoutMetadata["category"] })} className={inputClass}>{WORKOUT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        <Field label="Obtížnost"><select value={metadata.difficultyLevel} onChange={(e) => setMetadata({ difficultyLevel: Number(e.target.value) as 1 | 2 | 3 })} className={inputClass}><option value={1}>Level 1</option><option value={2}>Level 2</option><option value={3}>Level 3</option></select></Field>
      </div>
      <Field label="Cíl tréninku"><textarea value={metadata.goal} onChange={(e) => setMetadata({ goal: e.target.value })} rows={3} placeholder="Co má sportovec tímto tréninkem rozvíjet?" className={`${inputClass} resize-none`} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Cílové RPE od"><input type="number" min={1} max={10} value={metadata.targetRpeMin} onChange={(e) => setMetadata({ targetRpeMin: Number(e.target.value) })} className={inputClass} /></Field><Field label="Cílové RPE do"><input type="number" min={1} max={10} value={metadata.targetRpeMax} onChange={(e) => setMetadata({ targetRpeMax: Number(e.target.value) })} className={inputClass} /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Očekávaný čas od (min)"><input type="number" min={1} value={metadata.expectedDurationMin} onChange={(e) => setMetadata({ expectedDurationMin: Number(e.target.value) })} className={inputClass} /></Field><Field label="Očekávaný čas do (min)"><input type="number" min={1} value={metadata.expectedDurationMax} onChange={(e) => setMetadata({ expectedDurationMax: Number(e.target.value) })} className={inputClass} /></Field></div>
      <Field label="Doporučené tempo běhu"><input value={metadata.runningTarget} onChange={(e) => setMetadata({ runningTarget: e.target.value })} placeholder="Např. 5:00–5:15/km nebo Z2" className={inputClass} /></Field>
      <Field label="Hlavní sledovaný parametr"><input value={metadata.primaryMetric} onChange={(e) => setMetadata({ primaryMetric: e.target.value })} placeholder="Např. stabilita běhu" className={inputClass} /></Field>
      <Field label="Vedlejší parametry"><input value={metadata.secondaryMetrics.join(", ")} onChange={(e) => setMetadata({ secondaryMetrics: normalizeTags(e.target.value) })} placeholder="přechody, wall ball, technika" className={inputClass} /></Field>
      <Field label="Skupina progrese"><input value={metadata.progressionGroup} onChange={(e) => setMetadata({ progressionGroup: e.target.value })} placeholder="Např. base-engine-01" className={inputClass} /></Field>
    </section>

    <div className="mt-6 space-y-4">{draft.blocks.map((block, blockIndex) => <section key={block.id} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between"><span className="rounded-full bg-lime-400/10 px-3 py-1 text-xs font-black uppercase text-lime-300">{block.type === "emom" ? "EMOM" : "Manuální"}</span><div className="flex gap-1"><SmallButton label="Nahoru" onClick={() => moveBlock(blockIndex, -1)}>↑</SmallButton><SmallButton label="Dolů" onClick={() => moveBlock(blockIndex, 1)}>↓</SmallButton><SmallButton label="Smazat" onClick={() => setDraft({ ...draft, blocks: draft.blocks.filter((_, i) => i !== blockIndex) })}>×</SmallButton></div></div>
      <input value={block.title} onChange={(e) => replaceBlock(blockIndex, { ...block, title: e.target.value })} className={`${inputClass} mt-4 font-bold`} />
      <label className="mt-4 block text-sm text-zinc-400">{block.type === "emom" ? "Počet minut" : "Počet kol"}</label><input type="number" min={1} value={block.type === "emom" ? block.minutes : block.repeat} onChange={(e) => { const value = Math.max(1, Number(e.target.value) || 1); replaceBlock(blockIndex, block.type === "emom" ? { ...block, minutes: value } : { ...block, repeat: value }); }} className={`${inputClass} max-w-32`} />
      <div className="mt-5 space-y-3">{block.steps.map((step, stepIndex) => <div key={step.id} className="rounded-2xl bg-zinc-800 p-4"><div className="flex items-center gap-2"><span className="text-xs font-black text-zinc-500">{stepIndex + 1}</span><input value={step.name} onChange={(e) => updateStep(blockIndex, stepIndex, { name: e.target.value })} placeholder="Cvik" className="min-w-0 flex-1 bg-transparent font-bold outline-none" /><SmallButton label="Nahoru" onClick={() => moveStep(blockIndex, stepIndex, -1)}>↑</SmallButton><SmallButton label="Dolů" onClick={() => moveStep(blockIndex, stepIndex, 1)}>↓</SmallButton><SmallButton label="Smazat" onClick={() => replaceBlock(blockIndex, { ...block, steps: block.steps.filter((_, i) => i !== stepIndex) })}>×</SmallButton></div><input value={step.detail} onChange={(e) => updateStep(blockIndex, stepIndex, { detail: e.target.value })} placeholder="Detail, tempo nebo váha" className="mt-3 w-full bg-transparent text-sm text-zinc-400 outline-none" /></div>)}</div>
      <button type="button" onClick={() => replaceBlock(blockIndex, { ...block, steps: [...block.steps, blankStep()] })} className="mt-4 w-full rounded-2xl border border-dashed border-zinc-700 px-4 py-3 text-sm font-bold">+ Přidat cvik</button>
    </section>)}</div>
    <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => setDraft({ ...draft, blocks: [...draft.blocks, blankManualBlock()] })} className="rounded-2xl border border-zinc-700 px-4 py-3.5 font-bold">+ Blok</button><button type="button" onClick={() => setDraft({ ...draft, blocks: [...draft.blocks, { id: uid(), type: "emom", title: "EMOM", minutes: 6, steps: [blankStep()] }] })} className="rounded-2xl border border-lime-400/40 px-4 py-3.5 font-bold text-lime-300">+ EMOM</button></div>
    {error && <p className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm font-semibold text-red-300">{error}</p>}<button type="button" onClick={save} className="mt-6 w-full rounded-2xl bg-lime-400 px-5 py-4 text-lg font-black text-zinc-950">Uložit trénink</button>
  </PlanningShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-5 block font-bold">{label}{children}</label>; }
function SmallButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-label={label} onClick={onClick} className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-700 text-sm font-bold text-zinc-300">{children}</button>; }
export default function WorkoutEditorPage() { return <Suspense fallback={<main className="min-h-screen bg-zinc-950" />}><EditorContent /></Suspense>; }
