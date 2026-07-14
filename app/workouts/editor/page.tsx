"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { NewWorkoutTemplate, WorkoutBlock, WorkoutStep } from "@/lib/types";

const inputClass =
  "mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-white outline-none placeholder:text-zinc-500 focus:border-lime-400";

function uid() {
  return crypto.randomUUID();
}

function blankStep(): WorkoutStep {
  return { id: uid(), name: "", detail: "" };
}

function blankManualBlock(): WorkoutBlock {
  return { id: uid(), type: "manual", title: "Nový blok", repeat: 1, steps: [blankStep()] };
}

function emptyDraft(): NewWorkoutTemplate {
  return {
    title: "",
    description: "",
    durationMinutes: 45,
    blocks: [blankManualBlock()],
  };
}

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const { data, ready, createTemplate, updateTemplate } = useHyroxData();
  const [editedDraft, setDraft] = useState<NewWorkoutTemplate | null>(null);
  const [error, setError] = useState("");
  const template = editId ? data.templates.find((item) => item.id === editId) : undefined;
  const initialDraft = useMemo(
    () =>
      template
        ? {
            title: template.title,
            description: template.description,
            durationMinutes: template.durationMinutes,
            blocks: structuredClone(template.blocks),
          }
        : emptyDraft(),
    [template],
  );
  const draft = editedDraft ?? initialDraft;

  if (!ready) {
    return (
      <PlanningShell eyebrow="Editor" title="Načítám…" backHref="/workouts">
        <div className="h-64 animate-pulse rounded-3xl bg-zinc-900" />
      </PlanningShell>
    );
  }

  function replaceBlock(index: number, block: WorkoutBlock) {
    setDraft({
      ...draft,
      blocks: draft.blocks.map((item, i) => (i === index ? block : item)),
    });
  }

  function updateStep(blockIndex: number, stepIndex: number, updates: Partial<WorkoutStep>) {
    const block = draft.blocks[blockIndex];
    replaceBlock(blockIndex, {
      ...block,
      steps: block.steps.map((step, index) =>
        index === stepIndex ? { ...step, ...updates } : step,
      ),
    });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.blocks.length) return;
    const blocks = [...draft.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    setDraft({ ...draft, blocks });
  }

  function moveStep(blockIndex: number, stepIndex: number, direction: -1 | 1) {
    const block = draft.blocks[blockIndex];
    const target = stepIndex + direction;
    if (target < 0 || target >= block.steps.length) return;
    const steps = [...block.steps];
    [steps[stepIndex], steps[target]] = [steps[target], steps[stepIndex]];
    replaceBlock(blockIndex, { ...block, steps });
  }

  function save() {
    const title = draft.title.trim();
    const hasEmptyStep = draft.blocks.some(
      (block) => block.steps.length === 0 || block.steps.some((step) => !step.name.trim()),
    );
    if (!title) return setError("Doplň název tréninku.");
    if (draft.blocks.length === 0) return setError("Přidej alespoň jeden blok.");
    if (hasEmptyStep) return setError("Každý blok musí obsahovat pojmenovaný cvik.");

    const cleanDraft = {
      ...draft,
      title,
      description: draft.description.trim(),
      durationMinutes: Math.max(1, draft.durationMinutes),
      blocks: draft.blocks.map((block) => ({
        ...block,
        title: block.title.trim() || (block.type === "emom" ? "EMOM" : "Tréninkový blok"),
        steps: block.steps.map((step) => ({
          ...step,
          name: step.name.trim(),
          detail: step.detail.trim(),
        })),
      })),
    };

    if (editId) updateTemplate(editId, cleanDraft);
    else createTemplate(cleanDraft);
    router.push("/workouts");
  }

  return (
    <PlanningShell
      eyebrow="Editor WOD"
      title={editId ? "Upravit trénink" : "Nový trénink"}
      description="Sestav bloky v pořadí, ve kterém je aplikace během tréninku zobrazí."
      backHref="/workouts"
    >
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <label className="font-bold" htmlFor="title">Název</label>
        <input
          id="title"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          placeholder="Např. HYROX tempo 45"
          className={inputClass}
        />

        <label className="mt-5 block font-bold" htmlFor="description">Popis</label>
        <textarea
          id="description"
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          placeholder="Krátký cíl a zaměření tréninku"
          rows={3}
          className={`${inputClass} resize-none`}
        />

        <label className="mt-5 block font-bold" htmlFor="duration">Plánovaná délka</label>
        <div className="relative max-w-44">
          <input
            id="duration"
            type="number"
            min={1}
            value={draft.durationMinutes}
            onChange={(event) =>
              setDraft({ ...draft, durationMinutes: Number(event.target.value) || 1 })
            }
            className={`${inputClass} pr-14`}
          />
          <span className="pointer-events-none absolute bottom-3.5 right-4 text-zinc-500">min</span>
        </div>
      </section>

      <div className="mt-6 space-y-4">
        {draft.blocks.map((block, blockIndex) => (
          <section key={block.id} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-lime-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-lime-300">
                {block.type === "emom" ? "EMOM" : "Manuální"}
              </span>
              <div className="flex gap-1">
                <SmallButton label="Posunout nahoru" onClick={() => moveBlock(blockIndex, -1)}>↑</SmallButton>
                <SmallButton label="Posunout dolů" onClick={() => moveBlock(blockIndex, 1)}>↓</SmallButton>
                <SmallButton
                  label="Smazat blok"
                  onClick={() =>
                    setDraft({ ...draft, blocks: draft.blocks.filter((_, index) => index !== blockIndex) })
                  }
                >×</SmallButton>
              </div>
            </div>

            <input
              aria-label="Název bloku"
              value={block.title}
              onChange={(event) => replaceBlock(blockIndex, { ...block, title: event.target.value })}
              className={`${inputClass} mt-4 font-bold`}
            />

            <label className="mt-4 block text-sm font-semibold text-zinc-400">
              {block.type === "emom" ? "Počet minut" : "Počet kol"}
            </label>
            <input
              type="number"
              min={1}
              value={block.type === "emom" ? block.minutes : block.repeat}
              onChange={(event) => {
                const value = Math.max(1, Number(event.target.value) || 1);
                replaceBlock(
                  blockIndex,
                  block.type === "emom"
                    ? { ...block, minutes: value }
                    : { ...block, repeat: value },
                );
              }}
              className={`${inputClass} max-w-32`}
            />

            <div className="mt-5 space-y-3">
              {block.steps.map((step, stepIndex) => (
                <div key={step.id} className="rounded-2xl bg-zinc-800 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-zinc-500">{stepIndex + 1}</span>
                    <input
                      aria-label={`Cvik ${stepIndex + 1}`}
                      value={step.name}
                      onChange={(event) => updateStep(blockIndex, stepIndex, { name: event.target.value })}
                      placeholder="Např. 600 m běh"
                      className="min-w-0 flex-1 border-0 bg-transparent font-bold outline-none placeholder:text-zinc-600"
                    />
                    <SmallButton label="Nahoru" onClick={() => moveStep(blockIndex, stepIndex, -1)}>↑</SmallButton>
                    <SmallButton label="Dolů" onClick={() => moveStep(blockIndex, stepIndex, 1)}>↓</SmallButton>
                    <SmallButton
                      label="Smazat cvik"
                      onClick={() =>
                        replaceBlock(blockIndex, {
                          ...block,
                          steps: block.steps.filter((_, index) => index !== stepIndex),
                        })
                      }
                    >×</SmallButton>
                  </div>
                  <input
                    aria-label={`Detail cviku ${stepIndex + 1}`}
                    value={step.detail}
                    onChange={(event) => updateStep(blockIndex, stepIndex, { detail: event.target.value })}
                    placeholder="Detail, tempo nebo váha"
                    className="mt-3 w-full border-0 bg-transparent text-sm text-zinc-400 outline-none placeholder:text-zinc-600"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => replaceBlock(blockIndex, { ...block, steps: [...block.steps, blankStep()] })}
              className="mt-4 w-full rounded-2xl border border-dashed border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-300"
            >
              + Přidat cvik
            </button>
          </section>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setDraft({ ...draft, blocks: [...draft.blocks, blankManualBlock()] })}
          className="rounded-2xl border border-zinc-700 px-4 py-3.5 font-bold"
        >
          + Blok
        </button>
        <button
          type="button"
          onClick={() =>
            setDraft({
              ...draft,
              blocks: [
                ...draft.blocks,
                { id: uid(), type: "emom", title: "EMOM", minutes: 6, steps: [blankStep()] },
              ],
            })
          }
          className="rounded-2xl border border-lime-400/40 px-4 py-3.5 font-bold text-lime-300"
        >
          + EMOM
        </button>
      </div>

      {error && <p className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm font-semibold text-red-300">{error}</p>}

      <button
        type="button"
        onClick={save}
        className="mt-6 w-full rounded-2xl bg-lime-400 px-5 py-4 text-lg font-black text-zinc-950"
      >
        Uložit trénink
      </button>
    </PlanningShell>
  );
}

function SmallButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-700 text-sm font-bold text-zinc-300"
    >
      {children}
    </button>
  );
}

export default function WorkoutEditorPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-zinc-950" />}>
      <EditorContent />
    </Suspense>
  );
}

