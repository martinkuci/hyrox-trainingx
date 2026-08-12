"use client";

import { useMemo, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { ScheduledWorkout } from "@/lib/types";

const weekdayLabels = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function dayDiff(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

function monthCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1, 12);
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, index) => new Date(year, monthIndex, index + 1, 12)),
  ];
}

function formatDate(value: string, withYear = false) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(parseDate(value));
}

export default function LiveProgramCalendarPage() {
  const { data, ready, updateScheduledWorkout } = useHyroxData();
  const [month, setMonth] = useState(() => new Date());
  const [programId, setProgramId] = useState("");
  const [selected, setSelected] = useState<ScheduledWorkout | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [message, setMessage] = useState("");

  const programSchedules = useMemo(() => {
    const planned = data.scheduledWorkouts
      .filter((item) => item.programId && item.status !== "skipped")
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    const effectiveProgramId = programId || planned[0]?.programId || "";
    return planned.filter((item) => item.programId === effectiveProgramId);
  }, [data.scheduledWorkouts, programId]);

  const effectiveProgramId = programId || programSchedules[0]?.programId || "";
  const cells = monthCells(month);
  const firstDate = programSchedules[0]?.date;
  const lastDate = programSchedules[programSchedules.length - 1]?.date;
  const completed = programSchedules.filter((item) => item.status === "completed").length;
  const planned = programSchedules.filter((item) => item.status === "planned").length;

  function schedulesForDate(key: string) {
    return programSchedules.filter((item) => item.date === key);
  }

  function openSchedule(schedule: ScheduledWorkout) {
    setSelected(schedule);
    setTargetDate(schedule.date);
    setMessage("");
  }

  function moveSelected(shiftFollowing: boolean) {
    if (!selected || !targetDate) return;
    if (targetDate === selected.date) {
      setMessage("Vyber jiné datum.");
      return;
    }

    const collision = programSchedules.find(
      (item) => item.id !== selected.id && item.date === targetDate && item.status === "planned",
    );
    if (collision && !shiftFollowing) {
      setMessage("Na cílovém dni už je jiný trénink. Použij posun navazujících jednotek.");
      return;
    }

    const delta = dayDiff(selected.date, targetDate);
    updateScheduledWorkout(selected.id, { date: targetDate });

    if (shiftFollowing) {
      programSchedules
        .filter(
          (item) =>
            item.id !== selected.id &&
            item.status === "planned" &&
            `${item.date}T${item.time}` > `${selected.date}T${selected.time}`,
        )
        .forEach((item) => updateScheduledWorkout(item.id, { date: addDays(item.date, delta) }));
      setMessage(`Trénink i navazující jednotky byly posunuty o ${Math.abs(delta)} ${Math.abs(delta) === 1 ? "den" : "dní"}.`);
    } else {
      setMessage("Trénink byl přesunut. Ostatní jednotky zůstaly beze změny.");
    }

    setSelected(null);
  }

  return (
    <PlanningShell
      eyebrow="Plán"
      title="Kalendář programu"
      description="Klikni na naplánovaný trénink a přesuň ho na jiný den. Můžeš změnit jen jednu jednotku, nebo posunout i celý zbytek programu."
      backHref="/plan"
    >
      <section className="ui-card p-5 sm:p-6">
        <label className="block">
          <span className="text-sm font-bold text-zinc-300">Program</span>
          <select
            value={effectiveProgramId}
            onChange={(event) => {
              setProgramId(event.target.value);
              setSelected(null);
            }}
            className="ui-field mt-2"
          >
            {data.trainingPrograms.length === 0 && <option value="">Žádný program</option>}
            {data.trainingPrograms.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>

        {programSchedules.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={programSchedules.length} label="jednotek" />
            <Stat value={completed} label="hotovo" />
            <Stat value={planned} label="zbývá" />
            <Stat value={lastDate ? formatDate(lastDate, true) : "–"} label="odhad konce" small />
          </div>
        )}
        {firstDate && lastDate && (
          <p className="mt-4 text-center text-sm text-zinc-500">
            Aktuální kalendář programu: {formatDate(firstDate, true)} až {formatDate(lastDate, true)}
          </p>
        )}
      </section>

      <section className="ui-card ui-card-accent mt-6 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="ui-button ui-button-secondary ui-button-icon text-xl" aria-label="Předchozí měsíc">‹</button>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Programový kalendář</p>
            <h2 className="mt-1 text-xl font-black capitalize">{new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(month)}</h2>
          </div>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="ui-button ui-button-secondary ui-button-icon text-xl" aria-label="Následující měsíc">›</button>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-xs font-black text-zinc-500">
          {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {cells.map((date, index) => {
            if (!date) return <span key={`empty-${index}`} className="aspect-square" />;
            const key = dateKey(date);
            const schedules = schedulesForDate(key);
            return (
              <div key={key} className={`min-h-20 rounded-xl border bg-zinc-950 p-1.5 ${key === dateKey(new Date()) ? "border-accent/60" : "border-zinc-800"}`}>
                <p className="text-xs font-bold text-zinc-500">{date.getDate()}</p>
                <div className="mt-1 space-y-1">
                  {schedules.map((schedule) => {
                    const template = data.templates.find((item) => item.id === schedule.templateId);
                    return (
                      <button
                        key={schedule.id}
                        type="button"
                        onClick={() => openSchedule(schedule)}
                        className="ui-calendar-item"
                        data-completed={schedule.status === "completed"}
                      >
                        {template?.metadata?.workoutCode ?? template?.title.slice(0, 8) ?? "Trénink"}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {!ready && <div className="ui-card mt-6 h-36 animate-pulse" />}
      {ready && data.trainingPrograms.length === 0 && (
        <section className="ui-card mt-6 border-dashed p-8 text-center">
          <h2 className="text-xl font-black">Zatím nemáš program</h2>
          <p className="mt-2 text-zinc-400">Nejdřív vytvoř program a vlož ho do kalendáře.</p>
        </section>
      )}

      {selected && (
        <section className="ui-card ui-card-accent mt-6 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Přesun jednotky</p>
          <h2 className="mt-2 text-2xl font-black">{data.templates.find((item) => item.id === selected.templateId)?.title ?? "Naplánovaný trénink"}</h2>
          <p className="mt-2 text-sm text-zinc-400">Původně {formatDate(selected.date, true)} · {selected.time}{selected.programWeek ? ` · týden ${selected.programWeek}` : ""}</p>

          <label className="mt-5 block">
            <span className="text-sm font-bold text-zinc-300">Nové datum</span>
            <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="ui-field mt-2" />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => moveSelected(false)} className="ui-button ui-button-outline">Přesunout jen tento trénink</button>
            <button type="button" onClick={() => moveSelected(true)} className="ui-button ui-button-primary">Přesunout i zbytek programu</button>
          </div>
          <button type="button" onClick={() => setSelected(null)} className="ui-button ui-button-ghost mt-3 w-full">Zrušit</button>
        </section>
      )}

      {message && <p role="status" className="ui-feedback ui-feedback-success mt-5 text-center text-sm font-bold">{message}</p>}
    </PlanningShell>
  );
}

function Stat({ value, label, small = false }: { value: string | number; label: string; small?: boolean }) {
  return (
    <div className="ui-inset p-4 text-center">
      <p className={`${small ? "text-sm" : "text-2xl"} font-black text-accent`}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
