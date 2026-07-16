"use client";

import { useEffect, useMemo, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { NewScheduledWorkout, ProgramPhase, ProgramWeek, WorkoutTemplate } from "@/lib/types";

const phaseLabels: Record<ProgramPhase, string> = {
  base: "Base",
  build: "Build",
  deload: "Deload",
  specific: "Race specific",
  taper: "Taper",
};

const weekdayLabels = [
  { value: 1, label: "Po" },
  { value: 2, label: "Út" },
  { value: 3, label: "St" },
  { value: 4, label: "Čt" },
  { value: 5, label: "Pá" },
  { value: 6, label: "So" },
  { value: 0, label: "Ne" },
] as const;

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function defaultWeeks(templates: WorkoutTemplate[] = []): ProgramWeek[] {
  return Array.from({ length: 12 }, (_, index) => {
    const week = index + 1;
    const phase: ProgramPhase = week <= 3 ? "base" : week === 4 ? "deload" : week <= 7 ? "build" : week === 8 ? "deload" : week <= 11 ? "specific" : "taper";
    return {
      weekNumber: week,
      title: `Týden ${week}`,
      phase,
      focus: phase === "base" ? "Vybudovat aerobní základ" : phase === "build" ? "Zvýšit výkon a práh" : phase === "deload" ? "Regenerace a kontrola techniky" : phase === "specific" ? "Závodní kombinace a přechody" : "Snížit objem a zachovat ostrost",
      sessions: Array.from({ length: 3 }, (_, sessionIndex) => ({
        id: crypto.randomUUID(),
        weekday: [1, 3, 6][sessionIndex] as 1 | 3 | 6,
        time: sessionIndex === 2 ? "09:00" : "18:00",
        templateId: templates.length ? templates[(index * 3 + sessionIndex) % templates.length].id : null,
        note: "",
      })),
    };
  });
}

function monthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1, 12);
  const firstOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const days = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: firstOffset }, () => null),
    ...Array.from({ length: days }, (_, index) => new Date(year, month, index + 1, 12)),
  ];
}

export default function ProgramsPage() {
  const { data, ready, createTrainingProgram, deleteTrainingProgram, scheduleMany } = useHyroxData();
  const [code, setCode] = useState("PLAN-001");
  const [name, setName] = useState("HYROX Base to Race · 12 týdnů");
  const [description, setDescription] = useState("Tři tréninkové jednotky týdně s postupem od základní vytrvalosti k závodní specifice.");
  const [weeks, setWeeks] = useState<ProgramWeek[]>(() => defaultWeeks());
  const [startDate, setStartDate] = useState("");
  const [trainingDays, setTrainingDays] = useState<number[]>([1, 3, 6]);
  const [addedDates, setAddedDates] = useState<string[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [message, setMessage] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    setStartDate(dateKey(new Date()));
  }, []);

  useEffect(() => {
    if (ready && data.templates.length > 0 && !autoFilled && weeks.every((week) => week.sessions.every((session) => !session.templateId))) {
      setWeeks(defaultWeeks(data.templates));
      setAutoFilled(true);
    }
  }, [ready, data.templates, autoFilled, weeks]);

  const assignedSessions = useMemo(() => weeks.flatMap((week) => week.sessions).filter((session) => session.templateId), [weeks]);

  function isAvailable(date: Date) {
    const key = dateKey(date);
    if (addedDates.includes(key)) return true;
    return trainingDays.includes(date.getDay()) && !blockedDates.includes(key);
  }

  function toggleCalendarDate(date: Date) {
    const key = dateKey(date);
    if (isAvailable(date)) {
      setAddedDates((items) => items.filter((item) => item !== key));
      setBlockedDates((items) => items.includes(key) ? items : [...items, key]);
    } else {
      setBlockedDates((items) => items.filter((item) => item !== key));
      setAddedDates((items) => items.includes(key) ? items : [...items, key]);
    }
  }

  const generatedPlan = useMemo(() => {
    if (!startDate || assignedSessions.length === 0 || trainingDays.length === 0) return [];
    const dates: Date[] = [];
    const cursor = parseDate(startDate);
    for (let i = 0; i < 180 && dates.length < assignedSessions.length; i += 1) {
      const candidate = new Date(cursor);
      candidate.setDate(cursor.getDate() + i);
      if (isAvailable(candidate)) dates.push(candidate);
    }
    return assignedSessions.slice(0, dates.length).map((session, index) => {
      const week = weeks.find((item) => item.sessions.some((entry) => entry.id === session.id));
      return { session, week, date: dateKey(dates[index]) };
    });
  }, [startDate, assignedSessions, trainingDays, addedDates, blockedDates, weeks]);

  function updateWeek(weekIndex: number, updates: Partial<ProgramWeek>) {
    setWeeks((current) => current.map((week, index) => index === weekIndex ? { ...week, ...updates } : week));
  }

  function updateSession(weekIndex: number, sessionIndex: number, templateId: string) {
    setWeeks((current) => current.map((week, index) => index === weekIndex ? {
      ...week,
      sessions: week.sessions.map((session, i) => i === sessionIndex ? { ...session, templateId: templateId || null } : session),
    } : week));
  }

  function autoFillProgram() {
    if (!data.templates.length) return setMessage("Nejdřív vytvoř tréninky v knihovně.");
    setWeeks(defaultWeeks(data.templates));
    setAutoFilled(true);
    setMessage("Program byl automaticky naplněn dostupnými tréninky. Jednotky můžeš ručně změnit.");
  }

  function saveProgram() {
    if (!name.trim()) return setMessage("Doplň název programu.");
    const program = createTrainingProgram({ code: code.trim() || "PLAN", name: name.trim(), description: description.trim(), weeks });
    setMessage(`Program „${program.name}“ je uložený.`);
  }

  function scheduleProgram() {
    if (!startDate) return setMessage("Vyber datum zahájení.");
    if (trainingDays.length === 0) return setMessage("Vyber alespoň jeden den, kdy můžeš trénovat.");
    if (generatedPlan.length < assignedSessions.length) return setMessage("Pro všechny jednotky nebylo nalezeno dost dostupných dnů.");
    const program = createTrainingProgram({ code: code.trim() || "PLAN", name: name.trim(), description: description.trim(), weeks });
    const items: NewScheduledWorkout[] = generatedPlan.map(({ session, week, date }) => ({
      templateId: session.templateId as string,
      date,
      time: session.time,
      status: "planned",
      programId: program.id,
      programWeek: week?.weekNumber,
      programSessionId: session.id,
    }));
    scheduleMany(items);
    setMessage(`Program je uložený a do kalendáře bylo přidáno ${items.length} tréninků podle tvé dostupnosti.`);
  }

  const days = monthDays(calendarMonth);
  const monthLabel = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(calendarMonth);

  return (
    <PlanningShell eyebrow="Fáze 3B.2" title="Tréninkové programy" description="Program určuje pořadí jednotek. Ty určíš dny, kdy můžeš trénovat, a aplikace je automaticky rozloží do kalendáře." backHref="/">
      <section className="rounded-3xl border border-lime-400/20 bg-zinc-900 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-bold text-zinc-300">Kód programu</span><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>
          <label><span className="text-sm font-bold text-zinc-300">Nejdřívější datum zahájení</span><input type="date" value={startDate} min={dateKey(new Date())} onChange={(e) => setStartDate(e.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>
          <label className="sm:col-span-2"><span className="text-sm font-bold text-zinc-300">Název</span><input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>
          <label className="sm:col-span-2"><span className="text-sm font-bold text-zinc-300">Popis</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center"><Stat value={12} label="týdnů" /><Stat value={assignedSessions.length} label="jednotek" /><Stat value={generatedPlan.length} label="naplánováno" /></div>
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Tvoje dostupnost</p>
        <h2 className="mt-2 text-2xl font-black">Kdy můžeš trénovat?</h2>
        <p className="mt-2 text-sm text-zinc-400">Vyber běžné dny. V kalendáři můžeš konkrétní datum přidat nebo zrušit.</p>
        <div className="mt-4 grid grid-cols-7 gap-2">{weekdayLabels.map((day) => { const active = trainingDays.includes(day.value); return <button key={day.value} type="button" onClick={() => setTrainingDays((items) => active ? items.filter((item) => item !== day.value) : [...items, day.value])} className={`rounded-xl py-3 text-sm font-black ${active ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-400"}`}>{day.label}</button>; })}</div>

        <div className="mt-6 flex items-center justify-between"><button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="rounded-xl bg-zinc-800 px-4 py-2 font-bold">‹</button><h3 className="font-black capitalize">{monthLabel}</h3><button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="rounded-xl bg-zinc-800 px-4 py-2 font-bold">›</button></div>
        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-bold text-zinc-500">{weekdayLabels.map((day) => <span key={day.value}>{day.label}</span>)}</div>
        <div className="mt-2 grid grid-cols-7 gap-2">{days.map((date, index) => date ? <button key={dateKey(date)} type="button" onClick={() => toggleCalendarDate(date)} className={`aspect-square rounded-xl text-sm font-bold ${isAvailable(date) ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-500"}`}>{date.getDate()}</button> : <span key={`empty-${index}`} />)}</div>
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Obsah programu</p><h2 className="mt-2 text-2xl font-black">36 jednotek</h2></div><button type="button" onClick={autoFillProgram} className="rounded-xl border border-lime-400/40 px-3 py-2 text-sm font-black text-lime-300">Automaticky naplnit</button></div>
        <p className="mt-2 text-sm text-zinc-400">Jednotky jsou řazené podle programu, nikoli podle pevného dne v týdnu.</p>
      </section>

      <div className="mt-4 space-y-4">{weeks.map((week, weekIndex) => <section key={week.weekNumber} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Týden {week.weekNumber}</p><input value={week.title} onChange={(e) => updateWeek(weekIndex, { title: e.target.value })} className="mt-1 w-full bg-transparent text-xl font-black outline-none" /></div><select value={week.phase} onChange={(e) => updateWeek(weekIndex, { phase: e.target.value as ProgramPhase })} className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-bold">{Object.entries(phaseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><input value={week.focus} onChange={(e) => updateWeek(weekIndex, { focus: e.target.value })} className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-800/70 px-3 py-3 text-sm text-zinc-300" /><div className="mt-4 grid gap-3 sm:grid-cols-3">{week.sessions.map((session, sessionIndex) => <label key={session.id} className="rounded-2xl bg-zinc-800 p-3"><span className="text-xs font-black uppercase tracking-wide text-lime-300">Jednotka {sessionIndex + 1}</span><select value={session.templateId ?? ""} onChange={(e) => updateSession(weekIndex, sessionIndex, e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm"><option value="">Nevybráno</option>{data.templates.map((template) => <option key={template.id} value={template.id}>{template.metadata?.workoutCode ? `${template.metadata.workoutCode} · ` : ""}{template.title}</option>)}</select></label>)}</div></section>)}</div>

      {generatedPlan.length > 0 && <section className="mt-6 rounded-3xl border border-lime-400/20 bg-zinc-900 p-5"><h2 className="text-xl font-black">Náhled rozložení</h2><div className="mt-4 space-y-2">{generatedPlan.slice(0, 12).map(({ session, week, date }) => { const template = data.templates.find((item) => item.id === session.templateId); return <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-800 px-4 py-3 text-sm"><span><b>{new Intl.DateTimeFormat("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" }).format(parseDate(date))}</b> · {template?.title}</span><span className="text-zinc-500">T{week?.weekNumber}</span></div>; })}</div>{generatedPlan.length > 12 && <p className="mt-3 text-center text-sm text-zinc-500">…a dalších {generatedPlan.length - 12} jednotek</p>}</section>}

      {message && <p className="mt-5 rounded-2xl bg-lime-400/10 p-4 text-center text-sm font-bold text-lime-300">{message}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={saveProgram} className="rounded-2xl border border-lime-400/40 px-5 py-4 font-black text-lime-300">Uložit program</button><button type="button" onClick={scheduleProgram} className="rounded-2xl bg-lime-400 px-5 py-4 font-black text-zinc-950">Uložit a vložit do kalendáře</button></div>

      {ready && data.trainingPrograms.length > 0 && <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-xl font-black">Uložené programy</h2><div className="mt-4 space-y-3">{data.trainingPrograms.map((program) => <div key={program.id} className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-800 p-4"><div><p className="text-xs font-black text-lime-300">{program.code}</p><p className="font-bold">{program.name}</p><p className="text-sm text-zinc-400">{program.weeks.length} týdnů · {program.weeks.flatMap((week) => week.sessions).filter((session) => session.templateId).length} tréninků</p></div><button onClick={() => deleteTrainingProgram(program.id)} className="rounded-xl border border-red-500/30 px-3 py-2 text-sm font-bold text-red-300">Smazat</button></div>)}</div></section>}
    </PlanningShell>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl bg-zinc-800 p-4"><p className="text-2xl font-black text-lime-400">{value}</p><p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p></div>;
}
