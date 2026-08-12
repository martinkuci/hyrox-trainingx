"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { NewWorkoutTemplate, WorkoutBlock, WorkoutStep } from "@/lib/types";
import { categoryLabel, normalizeMetadata } from "@/lib/workout-metadata";

const sampleWorkout = {
  title: "HYROX Engine EMOM 42",
  description: "Kondiční HYROX trénink zaměřený na práci pod únavou, přechody a udržení tempa.",
  durationMinutes: 42,
  tags: ["hyrox", "emom", "běh", "wall-ball", "burpee", "row"],
  metadata: {
    workoutCode: "HYX-001",
    templateVersion: 1,
    category: "base-engine",
    goal: "Udržet stabilní tempo při kombinaci běhu a HYROX stanovišť.",
    targetRpeMin: 7,
    targetRpeMax: 8,
    expectedDurationMin: 40,
    expectedDurationMax: 46,
    runningTarget: "Kontrolované tempo, bez výrazného zpomalení",
    primaryMetric: "stabilita tempa",
    secondaryMetrics: ["přechody", "wall ball konzistence"],
    progressionGroup: "base-engine-01",
    difficultyLevel: 1
  },
  blocks: [
    { type: "manual", title: "Zahřátí", repeat: 2, steps: [
      { name: "400 m lehký běh", detail: "Klidné tempo" }, { name: "Air squat", detail: "10 opakování" },
      { name: "Burpee", detail: "8 opakování" }, { name: "Výpady", detail: "10 opakování" }, { name: "Plank", detail: "30 sekund" }
    ] },
    { type: "emom", title: "HYROX EMOM", minutes: 24, steps: [
      { name: "Wall ball", detail: "12 opakování" }, { name: "Burpee broad jump", detail: "10 opakování" },
      { name: "Row", detail: "12/10 cal" }, { name: "Goblet squat", detail: "12 opakování" },
      { name: "Běh", detail: "200 m" }, { name: "Odpočinek", detail: "Zbytek minuty" }
    ] },
    { type: "manual", title: "Finisher – For Time", repeat: 3, steps: [
      { name: "Běh", detail: "200 m" }, { name: "Wall ball", detail: "10 opakování" }, { name: "Burpee", detail: "8 opakování" }
    ] },
    { type: "manual", title: "Cooldown", repeat: 1, steps: [
      { name: "Lehká chůze", detail: "2 minuty" }, { name: "Mobilita", detail: "Stehna, lýtka a ramena" }
    ] }
  ]
};

const uid = () => crypto.randomUUID();
function normalizeStep(value: unknown): WorkoutStep { if (!value || typeof value !== "object") throw new Error("Každý cvik musí být objekt."); const step = value as Record<string, unknown>; const name = String(step.name ?? "").trim(); if (!name) throw new Error("Každý cvik musí mít název."); return { id: uid(), name, detail: String(step.detail ?? "").trim() }; }
function normalizeBlock(value: unknown): WorkoutBlock { if (!value || typeof value !== "object") throw new Error("Každý blok musí být objekt."); const block = value as Record<string, unknown>; const title = String(block.title ?? "").trim(); const steps = Array.isArray(block.steps) ? block.steps.map(normalizeStep) : []; if (!title) throw new Error("Každý blok musí mít název."); if (!steps.length) throw new Error(`Blok „${title}“ musí obsahovat alespoň jeden cvik.`); if (block.type === "emom") return { id: uid(), type: "emom", title, minutes: Math.max(1, Number(block.minutes) || 1), steps }; if (block.type === "manual") return { id: uid(), type: "manual", title, repeat: Math.max(1, Number(block.repeat) || 1), steps }; throw new Error(`Neznámý typ bloku „${String(block.type)}“. Použij manual nebo emom.`); }
function parseWorkout(text: string): NewWorkoutTemplate { const parsed = JSON.parse(text) as Record<string, unknown>; const title = String(parsed.title ?? "").trim(); if (!title) throw new Error("Chybí název tréninku."); const blocks = Array.isArray(parsed.blocks) ? parsed.blocks.map(normalizeBlock) : []; if (!blocks.length) throw new Error("Trénink musí obsahovat alespoň jeden blok."); const tags = Array.isArray(parsed.tags) ? Array.from(new Set(parsed.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))) : []; return { title, description: String(parsed.description ?? "").trim(), durationMinutes: Math.max(1, Number(parsed.durationMinutes) || 1), tags, metadata: normalizeMetadata(parsed.metadata as Record<string, unknown> | undefined), blocks }; }

export default function ImportWorkoutPage() {
  const router = useRouter(); const { createTemplate } = useHyroxData();
  const [text, setText] = useState(JSON.stringify(sampleWorkout, null, 2)); const [preview, setPreview] = useState<NewWorkoutTemplate | null>(null); const [error, setError] = useState("");
  const summary = useMemo(() => preview ? { exerciseCount: preview.blocks.reduce((sum, block) => sum + block.steps.length, 0), emomMinutes: preview.blocks.filter((block) => block.type === "emom").reduce((sum, block) => sum + block.minutes, 0) } : null, [preview]);
  function validate() { try { setPreview(parseWorkout(text)); setError(""); } catch (reason) { setPreview(null); setError(reason instanceof Error ? reason.message : "JSON se nepodařilo načíst."); } }
  function importWorkout() { if (!preview) return; createTemplate(preview); router.push("/workouts"); }

  return <PlanningShell eyebrow="Trénovat" title="Import tréninku" description="Vlož strukturovaný JSON včetně cíle, RPE, tempa a sledovaných parametrů." backHref="/workouts">
    <section className="ui-card p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black">JSON tréninku</h2><p className="mt-1 text-sm text-zinc-400">Ukázka už obsahuje metadata fáze 3A.</p></div><button type="button" onClick={() => { setText(JSON.stringify(sampleWorkout, null, 2)); setPreview(null); setError(""); }} className="ui-button ui-button-outline ui-button-sm shrink-0 text-xs">Obnovit ukázku</button></div>
    <textarea value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} spellCheck={false} className="ui-field mt-5 min-h-[32rem] bg-zinc-950 p-4 font-mono text-sm leading-6 text-zinc-200" />
    <button type="button" onClick={validate} className="ui-button ui-button-outline mt-4 w-full">Zkontrolovat trénink</button>{error && <p role="alert" className="ui-feedback ui-feedback-danger mt-4 text-sm font-semibold">{error}</p>}</section>
    {preview && summary && <section className="ui-card ui-card-accent mt-6 p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Náhled importu</p><div className="mt-2 flex flex-wrap items-center gap-2">{preview.metadata?.workoutCode && <span className="ui-chip ui-chip-accent">{preview.metadata.workoutCode}-V{preview.metadata.templateVersion}</span>}<span className="text-sm font-bold text-zinc-400">{categoryLabel(preview.metadata?.category)}</span></div><h2 className="mt-3 text-3xl font-black">{preview.title}</h2><p className="mt-2 text-zinc-400">{preview.description}</p>
    {preview.metadata && <div className="ui-inset mt-5 p-4"><p className="font-bold">{preview.metadata.goal}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><p>RPE <b>{preview.metadata.targetRpeMin}–{preview.metadata.targetRpeMax}</b></p><p>Čas <b>{preview.metadata.expectedDurationMin}–{preview.metadata.expectedDurationMax} min</b></p><p className="col-span-2">Hlavní parametr: <b>{preview.metadata.primaryMetric || "—"}</b></p></div></div>}
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat value={preview.durationMinutes} label="minut" /><Stat value={preview.blocks.length} label="bloků" /><Stat value={summary.exerciseCount} label="cviků" /><Stat value={summary.emomMinutes} label="min EMOM" /></div><button type="button" onClick={importWorkout} className="ui-button ui-button-primary ui-button-lg mt-6 w-full">Importovat do knihovny</button></section>}
    <p className="mt-5 text-center text-sm text-zinc-500">Po importu trénink najdeš v <Link href="/workouts" className="font-bold text-zinc-300">Knihovně</Link>.</p>
  </PlanningShell>;
}
function Stat({ value, label }: { value: number; label: string }) { return <div className="ui-inset p-4 text-center"><p className="text-2xl font-black text-accent">{value}</p><p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p></div>; }
