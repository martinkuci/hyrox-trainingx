"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { NewWorkoutTemplate, WorkoutBlock, WorkoutStep } from "@/lib/types";

const sampleWorkout = {
  title: "HYROX Engine EMOM 42",
  description: "Kondiční HYROX trénink zaměřený na práci pod únavou, přechody a udržení tempa.",
  durationMinutes: 42,
  tags: ["hyrox", "emom", "běh", "wall-ball", "burpee", "row"],
  blocks: [
    {
      type: "manual",
      title: "Zahřátí",
      repeat: 2,
      steps: [
        { name: "400 m lehký běh", detail: "Klidné tempo" },
        { name: "Air squat", detail: "10 opakování" },
        { name: "Burpee", detail: "8 opakování" },
        { name: "Výpady", detail: "10 opakování" },
        { name: "Plank", detail: "30 sekund" }
      ]
    },
    {
      type: "emom",
      title: "HYROX EMOM",
      minutes: 24,
      steps: [
        { name: "Wall ball", detail: "12 opakování" },
        { name: "Burpee broad jump", detail: "10 opakování" },
        { name: "Row", detail: "12/10 cal" },
        { name: "Goblet squat", detail: "12 opakování" },
        { name: "Běh", detail: "200 m" },
        { name: "Odpočinek", detail: "Zbytek minuty" }
      ]
    },
    {
      type: "manual",
      title: "Finisher – For Time",
      repeat: 3,
      steps: [
        { name: "Běh", detail: "200 m" },
        { name: "Wall ball", detail: "10 opakování" },
        { name: "Burpee", detail: "8 opakování" }
      ]
    },
    {
      type: "manual",
      title: "Cooldown",
      repeat: 1,
      steps: [
        { name: "Lehká chůze", detail: "2 minuty" },
        { name: "Mobilita", detail: "Stehna, lýtka a ramena" }
      ]
    }
  ]
};

function uid() {
  return crypto.randomUUID();
}

function normalizeStep(value: unknown): WorkoutStep {
  if (!value || typeof value !== "object") throw new Error("Každý cvik musí být objekt.");
  const step = value as Record<string, unknown>;
  const name = String(step.name ?? "").trim();
  if (!name) throw new Error("Každý cvik musí mít název.");
  return { id: uid(), name, detail: String(step.detail ?? "").trim() };
}

function normalizeBlock(value: unknown): WorkoutBlock {
  if (!value || typeof value !== "object") throw new Error("Každý blok musí být objekt.");
  const block = value as Record<string, unknown>;
  const type = block.type;
  const title = String(block.title ?? "").trim();
  const steps = Array.isArray(block.steps) ? block.steps.map(normalizeStep) : [];
  if (!title) throw new Error("Každý blok musí mít název.");
  if (steps.length === 0) throw new Error(`Blok „${title}“ musí obsahovat alespoň jeden cvik.`);

  if (type === "emom") {
    const minutes = Math.max(1, Number(block.minutes) || 1);
    return { id: uid(), type: "emom", title, minutes, steps };
  }
  if (type === "manual") {
    const repeat = Math.max(1, Number(block.repeat) || 1);
    return { id: uid(), type: "manual", title, repeat, steps };
  }
  throw new Error(`Neznámý typ bloku „${String(type)}“. Použij manual nebo emom.`);
}

function parseWorkout(text: string): NewWorkoutTemplate {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const title = String(parsed.title ?? "").trim();
  if (!title) throw new Error("Chybí název tréninku.");
  const blocks = Array.isArray(parsed.blocks) ? parsed.blocks.map(normalizeBlock) : [];
  if (blocks.length === 0) throw new Error("Trénink musí obsahovat alespoň jeden blok.");
  const tags = Array.isArray(parsed.tags)
    ? Array.from(new Set(parsed.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)))
    : [];

  return {
    title,
    description: String(parsed.description ?? "").trim(),
    durationMinutes: Math.max(1, Number(parsed.durationMinutes) || 1),
    tags,
    blocks,
  };
}

export default function ImportWorkoutPage() {
  const router = useRouter();
  const { createTemplate } = useHyroxData();
  const [text, setText] = useState(JSON.stringify(sampleWorkout, null, 2));
  const [preview, setPreview] = useState<NewWorkoutTemplate | null>(null);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    if (!preview) return null;
    const exerciseCount = preview.blocks.reduce((sum, block) => sum + block.steps.length, 0);
    const emomMinutes = preview.blocks
      .filter((block) => block.type === "emom")
      .reduce((sum, block) => sum + block.minutes, 0);
    return { exerciseCount, emomMinutes };
  }, [preview]);

  function validate() {
    try {
      const workout = parseWorkout(text);
      setPreview(workout);
      setError("");
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : "JSON se nepodařilo načíst.");
    }
  }

  function importWorkout() {
    if (!preview) return;
    createTemplate(preview);
    router.push("/workouts");
  }

  return (
    <PlanningShell
      eyebrow="PC nástroj"
      title="Import tréninku"
      description="Vlož JSON připravený v ChatGPT, zkontroluj náhled a jedním kliknutím ho ulož do knihovny."
      backHref="/workouts"
    >
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">JSON tréninku</h2>
            <p className="mt-1 text-sm text-zinc-400">Ukázkový dnešní trénink je už vložený.</p>
          </div>
          <button
            type="button"
            onClick={() => { setText(JSON.stringify(sampleWorkout, null, 2)); setPreview(null); setError(""); }}
            className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300"
          >
            Obnovit ukázku
          </button>
        </div>

        <textarea
          value={text}
          onChange={(event) => { setText(event.target.value); setPreview(null); }}
          spellCheck={false}
          className="mt-5 min-h-[32rem] w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm leading-6 text-zinc-200 outline-none focus:border-lime-400"
        />

        <button
          type="button"
          onClick={validate}
          className="mt-4 w-full rounded-2xl border border-lime-400/40 px-5 py-4 font-black text-lime-300"
        >
          Zkontrolovat trénink
        </button>

        {error && <p className="mt-4 rounded-2xl bg-red-500/10 p-4 text-sm font-semibold text-red-300">{error}</p>}
      </section>

      {preview && summary && (
        <section className="mt-6 rounded-3xl border border-lime-400/30 bg-zinc-900 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Náhled importu</p>
          <h2 className="mt-2 text-3xl font-black">{preview.title}</h2>
          <p className="mt-2 text-zinc-400">{preview.description}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={preview.durationMinutes} label="minut" />
            <Stat value={preview.blocks.length} label="bloků" />
            <Stat value={summary.exerciseCount} label="cviků" />
            <Stat value={summary.emomMinutes} label="min EMOM" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {preview.tags.map((tag) => <span key={tag} className="rounded-full bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">{tag}</span>)}
          </div>
          <button
            type="button"
            onClick={importWorkout}
            className="mt-6 w-full rounded-2xl bg-lime-400 px-5 py-4 text-lg font-black text-zinc-950"
          >
            Importovat do knihovny
          </button>
        </section>
      )}

      <p className="mt-5 text-center text-sm text-zinc-500">
        Po importu trénink najdeš v <Link href="/workouts" className="font-bold text-zinc-300">Knihovně</Link> a můžeš ho spustit nebo naplánovat.
      </p>
    </PlanningShell>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-zinc-800 p-4 text-center">
      <p className="text-2xl font-black text-lime-400">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
