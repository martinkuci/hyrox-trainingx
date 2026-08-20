"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import { EXERCISE_CATEGORY_LABELS, EXERCISE_LIBRARY, getExercise, type ExerciseCategory } from "@/lib/exercise-catalog";
import type { NewWorkoutTemplate, WorkoutBlock, WorkoutMetadata, WorkoutStep } from "@/lib/types";
import { convertWorkoutBlock, createWorkoutBlock, WORKOUT_BLOCK_TYPES, workoutBlockTypeDescription, workoutBlockTypeLabel, type WorkoutBlockType } from "@/lib/workout-blocks";
import { emptyMetadata, normalizeMetadata, WORKOUT_CATEGORIES } from "@/lib/workout-metadata";

const inputClass = "ui-field mt-2 placeholder:text-zinc-500";
const uid = () => crypto.randomUUID();
const blankStep = (): WorkoutStep => ({ id: uid(), name: "", detail: "" });
const blankBlock = (type: WorkoutBlockType = "manual") => createWorkoutBlock(type, uid(), blankStep());
const normalizeTags = (value: string) => Array.from(new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)));

function emptyDraft(): NewWorkoutTemplate {
  return { title: "", description: "", durationMinutes: 45, tags: [], metadata: emptyMetadata(), blocks: [blankBlock()] };
}

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const { data, ready, createTemplate, updateTemplate } = useHyroxData();
  const [editedDraft, setDraft] = useState<NewWorkoutTemplate | null>(null);
  const [newBlockType, setNewBlockType] = useState<WorkoutBlockType>("manual");
  const [error, setError] = useState("");
  const template = editId ? data.templates.find((item) => item.id === editId) : undefined;
  const knownTags = useMemo(() => Array.from(new Set(data.templates.flatMap((item) => item.tags ?? []))).sort(), [data.templates]);
  const exercisesByCategory = useMemo(() => {
    const groups = new Map<ExerciseCategory, typeof EXERCISE_LIBRARY>();
    for (const exercise of [...EXERCISE_LIBRARY].sort((a, b) => a.name.localeCompare(b.name, "cs"))) {
      const group = groups.get(exercise.category) ?? [];
      group.push(exercise);
      groups.set(exercise.category, group);
    }
    return groups;
  }, []);
  const initialDraft = useMemo<NewWorkoutTemplate>(() => template ? {
    title: template.title, description: template.description, durationMinutes: template.durationMinutes,
    tags: [...(template.tags ?? [])], metadata: template.metadata ? structuredClone(template.metadata) : emptyMetadata(),
    blocks: structuredClone(template.blocks),
  } : emptyDraft(), [template]);
  const draft = editedDraft ?? initialDraft;
  const metadata = draft.metadata ?? emptyMetadata();
  const setMetadata = (updates: Partial<WorkoutMetadata>) => setDraft({ ...draft, metadata: { ...metadata, ...updates } });

  if (!ready) return <PlanningShell eyebrow="Trénovat" title="Načítám…" backHref="/workouts"><div className="ui-card h-64 animate-pulse" /></PlanningShell>;

  function replaceBlock(index: number, block: WorkoutBlock) { setDraft({ ...draft, blocks: draft.blocks.map((item, i) => i === index ? block : item) }); }
  function updateStep(blockIndex: number, stepIndex: number, updates: Partial<WorkoutStep>) {
    const block = draft.blocks[blockIndex];
    replaceBlock(blockIndex, { ...block, steps: block.steps.map((step, index) => index === stepIndex ? { ...step, ...updates } : step) });
  }
  function selectExercise(blockIndex: number, stepIndex: number, exerciseId: string) {
    const exercise = getExercise(exerciseId);
    updateStep(blockIndex, stepIndex, {
      exerciseId: exercise?.id,
      name: exercise?.name ?? draft.blocks[blockIndex].steps[stepIndex].name,
    });
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
      blocks: draft.blocks.map((block) => ({ ...block, title: block.title.trim() || workoutBlockTypeLabel(block.type), steps: block.steps.map((step) => ({ ...step, name: step.name.trim(), detail: step.detail.trim() })) })),
    };
    if (editId) updateTemplate(editId, cleanDraft); else createTemplate(cleanDraft);
    router.push("/workouts");
  }

  return <PlanningShell eyebrow="Trénovat" title={editId ? "Upravit trénink" : "Nový trénink"} description="Skládej trénink z jednotlivých cviků. Katalogové cviky nesou vybavení, techniku, náhrady a týmové možnosti." backHref="/workouts">
    <section className="ui-card p-5 sm:p-6">
      <label className="font-bold" htmlFor="title">Název</label><input id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Např. Base Engine" className={inputClass} />
      <label className="mt-5 block font-bold" htmlFor="description">Popis</label><textarea id="description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} className={`${inputClass} resize-none`} />
      <label className="mt-5 block font-bold" htmlFor="tags">Tagy</label><input id="tags" value={(draft.tags ?? []).join(", ")} onChange={(e) => setDraft({ ...draft, tags: normalizeTags(e.target.value) })} placeholder="běh, síla, stanoviště" className={inputClass} />
      {knownTags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{knownTags.map((tag) => { const selected = draft.tags.includes(tag); return <button key={tag} type="button" aria-pressed={selected} onClick={() => setDraft({ ...draft, tags: selected ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag] })} className="ui-choice min-h-11 rounded-full px-3 py-2 text-xs">{tag}</button>; })}</div>}
      <label className="mt-5 block font-bold" htmlFor="duration">Plánovaná délka</label><input id="duration" type="number" min={1} value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) || 1 })} className={`${inputClass} max-w-44`} />
    </section>

    <section className="ui-card ui-card-accent mt-6 p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Tréninkový profil</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Kód tréninku"><input value={metadata.workoutCode} onChange={(e) => setMetadata({ workoutCode: e.target.value })} placeholder="EGN-001" className={inputClass} /></Field>
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

    <div className="mt-6 space-y-4">{draft.blocks.map((block, blockIndex) => <section key={block.id} className="ui-card p-5">
      <div className="flex items-center justify-between gap-3"><span className="ui-chip ui-chip-accent uppercase">{workoutBlockTypeLabel(block.type)}</span><div className="flex gap-1"><SmallButton label="Nahoru" onClick={() => moveBlock(blockIndex, -1)}>↑</SmallButton><SmallButton label="Dolů" onClick={() => moveBlock(blockIndex, 1)}>↓</SmallButton><SmallButton label="Smazat" onClick={() => setDraft({ ...draft, blocks: draft.blocks.filter((_, i) => i !== blockIndex) })}>×</SmallButton></div></div>
      <label className="mt-4 block text-sm font-bold text-zinc-300">Režim bloku<select value={block.type} onChange={(event) => replaceBlock(blockIndex, convertWorkoutBlock(block, event.target.value as WorkoutBlockType))} className={inputClass}>{WORKOUT_BLOCK_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{workoutBlockTypeDescription(block.type)}</p>
      <input value={block.title} onChange={(e) => replaceBlock(blockIndex, { ...block, title: e.target.value })} className={`${inputClass} mt-4 font-bold`} />
      <BlockSettings block={block} onChange={(nextBlock) => replaceBlock(blockIndex, nextBlock)} />
      <div className="mt-5 space-y-3">{block.steps.map((step, stepIndex) => {
        const selectedExercise = getExercise(step.exerciseId);
        return <div key={step.id} className="ui-inset p-4">
          <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Cvik z knihovny
            <select value={step.exerciseId ?? ""} onChange={(event) => selectExercise(blockIndex, stepIndex, event.target.value)} className="ui-field mt-2 text-sm normal-case tracking-normal">
              <option value="">Vlastní cvik / volný text</option>
              {[...exercisesByCategory.entries()].map(([category, exercises]) => (
                <optgroup key={category} label={EXERCISE_CATEGORY_LABELS[category]}>
                  {exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {selectedExercise && <div className="mt-2 flex flex-wrap gap-2"><span className="ui-chip">{EXERCISE_CATEGORY_LABELS[selectedExercise.category]}</span><span className="ui-chip">{selectedExercise.movementFamily}</span>{selectedExercise.tags.includes("finisher") && <span className="ui-chip">finisher</span>}{selectedExercise.team.modes.some((mode) => mode !== "solo") && <span className="ui-chip">tým</span>}</div>}
          <div className="mt-3 flex items-center gap-2"><span className="text-xs font-black text-zinc-500">{stepIndex + 1}</span><input value={step.name} onChange={(e) => updateStep(blockIndex, stepIndex, { name: e.target.value, exerciseId: undefined })} placeholder="Cvik" className="min-w-0 flex-1 bg-transparent font-bold outline-none" /><SmallButton label="Nahoru" onClick={() => moveStep(blockIndex, stepIndex, -1)}>↑</SmallButton><SmallButton label="Dolů" onClick={() => moveStep(blockIndex, stepIndex, 1)}>↓</SmallButton><SmallButton label="Smazat" onClick={() => replaceBlock(blockIndex, { ...block, steps: block.steps.filter((_, i) => i !== stepIndex) })}>×</SmallButton></div>
          <input value={step.detail} onChange={(e) => updateStep(blockIndex, stepIndex, { detail: e.target.value })} placeholder="Detail, tempo, vzdálenost, opakování nebo váha" className="mt-3 w-full bg-transparent text-sm text-zinc-400 outline-none" />
        </div>;
      })}</div>
      <button type="button" onClick={() => replaceBlock(blockIndex, { ...block, steps: [...block.steps, blankStep()] })} className="ui-button ui-button-outline ui-button-sm mt-4 w-full border-dashed">+ Přidat cvik</button>
    </section>)}</div>
    <div className="ui-card mt-5 p-4"><label className="block text-sm font-bold text-zinc-300">Nový režim<select value={newBlockType} onChange={(event) => setNewBlockType(event.target.value as WorkoutBlockType)} className={inputClass}>{WORKOUT_BLOCK_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><p className="mt-2 text-xs leading-5 text-zinc-500">{workoutBlockTypeDescription(newBlockType)}</p><button type="button" onClick={() => setDraft({ ...draft, blocks: [...draft.blocks, blankBlock(newBlockType)] })} className="ui-button ui-button-secondary mt-3 w-full">+ Přidat {workoutBlockTypeLabel(newBlockType)}</button></div>
    {error && <p role="alert" className="ui-feedback ui-feedback-danger mt-5 text-sm font-semibold">{error}</p>}<button type="button" onClick={save} className="ui-button ui-button-primary ui-button-lg mt-6 w-full">Uložit trénink</button>
  </PlanningShell>;
}

function BlockSettings({ block, onChange }: { block: WorkoutBlock; onChange: (block: WorkoutBlock) => void }) {
  if (block.type === "manual") return <NumberField label="Počet kol" min={1} value={block.repeat} onChange={(value) => onChange({ ...block, repeat: Math.max(1, value) })} />;
  if (block.type === "emom" || block.type === "amrap") return <NumberField label="Délka bloku (min)" min={1} value={block.minutes} onChange={(value) => onChange({ ...block, minutes: Math.max(1, value) })} />;
  if (block.type === "for-time") return <div className="grid gap-3 sm:grid-cols-2"><NumberField label="Počet kol" min={1} value={block.rounds} onChange={(value) => onChange({ ...block, rounds: Math.max(1, value) })} /><NumberField label="Odpočinek mezi koly (s)" min={0} value={block.restSeconds} onChange={(value) => onChange({ ...block, restSeconds: Math.max(0, value) })} /></div>;
  return <div className="grid gap-3 sm:grid-cols-3"><NumberField label="Počet intervalů" min={1} value={block.rounds} onChange={(value) => onChange({ ...block, rounds: Math.max(1, value) })} /><NumberField label="Práce (s)" min={1} value={block.workSeconds} onChange={(value) => onChange({ ...block, workSeconds: Math.max(1, value) })} /><NumberField label="Odpočinek (s)" min={0} value={block.restSeconds} onChange={(value) => onChange({ ...block, restSeconds: Math.max(0, value) })} /></div>;
}

function NumberField({ label, min, value, onChange }: { label: string; min: number; value: number; onChange: (value: number) => void }) {
  return <label className="mt-4 block text-sm text-zinc-400">{label}<input type="number" inputMode="numeric" min={min} value={value} onChange={(event) => onChange(Number(event.target.value) || min)} className={`${inputClass} max-w-full`} /></label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-5 block font-bold">{label}{children}</label>; }
function SmallButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-label={label} onClick={onClick} className="ui-button ui-button-ghost ui-button-icon shrink-0 text-sm">{children}</button>; }
export default function WorkoutEditorPage() { return <Suspense fallback={<main className="min-h-screen bg-zinc-950" />}><EditorContent /></Suspense>; }