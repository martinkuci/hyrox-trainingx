"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { StatusBadge } from "@/components/planning/StatusBadge";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { ScheduledWorkout, ScheduledWorkoutStatus } from "@/lib/types";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export default function CalendarPage() {
  const {
    data,
    ready,
    scheduleWorkout,
    updateScheduledWorkout,
    deleteScheduledWorkout,
  } = useHyroxData();
  const today = dateKey(new Date());
  const [templateId, setTemplateId] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("18:00");
  const [pendingDelete, setPendingDelete] = useState<ScheduledWorkout | null>(null);
  const [message, setMessage] = useState("");

  const items = useMemo(
    () =>
      [...data.scheduledWorkouts].sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
      ),
    [data.scheduledWorkouts],
  );

  function addToCalendar() {
    const chosenTemplate = templateId || data.templates[0]?.id;
    if (!chosenTemplate) {
      setMessage("Nejdřív vytvoř alespoň jeden trénink.");
      return;
    }
    scheduleWorkout({ templateId: chosenTemplate, date, time, status: "planned" });
    setTemplateId(chosenTemplate);
    setMessage("Trénink je naplánovaný.");
  }

  return (
    <PlanningShell
      eyebrow="Plán"
      title="Kalendář"
      description="Naplánuj trénink, změň datum nebo označ vynechaný den."
    >
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-xl font-black">Přidat do plánu</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-bold text-zinc-300">Trénink</span>
            <select
              value={templateId || data.templates[0]?.id || ""}
              onChange={(event) => setTemplateId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 outline-none focus:border-lime-400"
            >
              {data.templates.length === 0 && <option value="">Žádný trénink</option>}
              {data.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title} · {template.durationMinutes} min
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-bold text-zinc-300">Datum</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 outline-none focus:border-lime-400"
            />
          </label>
          <label>
            <span className="text-sm font-bold text-zinc-300">Čas</span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 outline-none focus:border-lime-400"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={addToCalendar}
          className="mt-5 w-full rounded-2xl bg-lime-400 px-5 py-4 font-black text-zinc-950"
        >
          Naplánovat trénink
        </button>
        {message && <p className="mt-3 text-center text-sm font-semibold text-zinc-400">{message}</p>}
      </section>

      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black">Naplánované dny</h2>
        <span className="text-sm text-zinc-500">{items.length} položek</span>
      </div>

      {!ready && <div className="mt-4 h-40 animate-pulse rounded-3xl bg-zinc-900" />}

      {ready && items.length === 0 && (
        <section className="mt-4 rounded-3xl border border-dashed border-zinc-700 p-7 text-center text-zinc-400">
          Kalendář je zatím prázdný.
        </section>
      )}

      <div className="mt-4 space-y-4">
        {items.map((item) => {
          const template = data.templates.find((entry) => entry.id === item.templateId);
          if (!template) return null;
          return (
            <article key={item.id} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="capitalize text-sm font-bold text-lime-400">{dateLabel(item.date)}</p>
                  <h3 className="mt-1 text-2xl font-black">{template.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{template.durationMinutes} min</p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <label>
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Přesunout na</span>
                  <input
                    type="date"
                    value={item.date}
                    onChange={(event) => updateScheduledWorkout(item.id, { date: event.target.value })}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-3 text-sm"
                  />
                </label>
                <label>
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Čas</span>
                  <input
                    type="time"
                    value={item.time}
                    onChange={(event) => updateScheduledWorkout(item.id, { time: event.target.value })}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-3 text-sm"
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Stav</span>
                <select
                  value={item.status}
                  onChange={(event) =>
                    updateScheduledWorkout(item.id, {
                      status: event.target.value as ScheduledWorkoutStatus,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-3 text-sm"
                >
                  <option value="planned">Naplánováno</option>
                  <option value="completed">Dokončeno</option>
                  <option value="skipped">Vynecháno</option>
                </select>
              </label>

              <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
                <Link
                  href={`/workout/${template.id}?scheduleId=${item.id}`}
                  className="rounded-2xl bg-lime-400 px-4 py-3.5 text-center font-black text-zinc-950"
                >
                  Spustit
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDelete(item)}
                  className="rounded-2xl border border-red-500/30 px-4 py-3.5 font-semibold text-red-300"
                >
                  Smazat
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Odstranit z kalendáře?"
        description="Tréninková šablona ani historie se nesmažou."
        confirmLabel="Odstranit"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteScheduledWorkout(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </PlanningShell>
  );
}

