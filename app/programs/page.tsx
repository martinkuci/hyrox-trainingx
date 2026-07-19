"use client";

import { useMemo, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { NewScheduledWorkout, ProgramWeek } from "@/lib/types";
import { buildProgramWeeks, phaseLabels } from "@/lib/program-generator";
import type { ProgramGoal as Goal, ProgramLevel as Level } from "@/lib/program-generator";

const weekdays = [
  { value: 1, label: "Po" }, { value: 2, label: "Út" }, { value: 3, label: "St" },
  { value: 4, label: "Čt" }, { value: 5, label: "Pá" }, { value: 6, label: "So" }, { value: 0, label: "Ne" },
] as const;
const defaultDayOrder = [1, 2, 3, 4, 5, 6, 0];

const goalLabels: Record<Goal, string> = {
  race: "Příprava na HYROX",
  fitness: "Celková kondice",
  run: "Zlepšit běh",
  strength: "Zlepšit sílu",
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export default function ProgramsPage() {
  const { data, ready, createTrainingProgram, deleteTrainingProgram, scheduleMany } = useHyroxData();
  const [goal, setGoal] = useState<Goal>("race");
  const [level, setLevel] = useState<Level>(2);
  const [duration, setDuration] = useState<4 | 8 | 12>(12);
  const [frequency, setFrequency] = useState(3);
  const [trainingDays, setTrainingDays] = useState<number[]>([1, 3, 6]);
  const [startDate, setStartDate] = useState(() => dateKey(new Date()));
  const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
  const [message, setMessage] = useState("");

  const totalUnits = duration * frequency;
  const assigned = weeks.flatMap((week) => week.sessions).filter((session) => session.templateId).length;
  const preview = useMemo(() => {
    if (!startDate || !weeks.length || !trainingDays.length) return [];
    const cursor = new Date(`${startDate}T12:00:00`);
    const sessions = weeks.flatMap((week) => week.sessions.map((session) => ({ session, week })));
    const dates: Date[] = [];
    for (let offset = 0; offset < duration * 10 && dates.length < sessions.length; offset += 1) {
      const candidate = new Date(cursor);
      candidate.setDate(cursor.getDate() + offset);
      if (trainingDays.includes(candidate.getDay())) dates.push(candidate);
    }
    return sessions.slice(0, dates.length).map((entry, index) => ({ ...entry, date: dateKey(dates[index]) }));
  }, [startDate, weeks, trainingDays, duration]);

  function changeFrequency(nextFrequency: number) {
    setFrequency(nextFrequency);
    setTrainingDays((current) => {
      const next = current.slice(0, nextFrequency);
      for (const day of defaultDayOrder) if (next.length < nextFrequency && !next.includes(day)) next.push(day);
      return next;
    });
    setWeeks([]);
  }
  function toggleDay(day: number) {
    setTrainingDays((current) => {
      if (current.includes(day)) return current.length === 1 ? current : current.filter((item) => item !== day);
      if (current.length >= frequency) return [...current.slice(1), day];
      return [...current, day];
    });
    setWeeks([]);
  }
  function generateProgram() {
    if (!data.templates.length) return setMessage("Nejdřív je potřeba mít alespoň jeden trénink v knihovně.");
    setWeeks(buildProgramWeeks({ templates: data.templates, duration, frequency, goal, level, days: trainingDays }));
    setMessage(`Vygenerováno ${duration} týdnů a ${totalUnits} jednotek. Konkrétní tréninky můžeš před uložením změnit.`);
  }
  function updateSession(weekIndex: number, sessionIndex: number, templateId: string) {
    setWeeks((current) => current.map((week, index) => index === weekIndex ? { ...week, sessions: week.sessions.map((session, i) => i === sessionIndex ? { ...session, templateId: templateId || null } : session) } : week));
  }
  function saveAndSchedule() {
    if (!weeks.length) return setMessage("Nejdřív vygeneruj program.");
    if (preview.length !== totalUnits) return setMessage("Nepodařilo se vytvořit všechna data programu.");
    const name = `${goalLabels[goal]} · ${duration} týdnů · ${frequency}× týdně`;
    const program = createTrainingProgram({ code: `PLAN-${Date.now().toString().slice(-6)}`, name, description: `Úroveň ${level}, ${frequency} tréninků týdně. Automaticky sestaveno podle cíle a dostupnosti.`, weeks });
    const items: NewScheduledWorkout[] = preview.map(({ session, week, date }) => ({ templateId: session.templateId as string, date, time: session.time, status: "planned", programId: program.id, programWeek: week.weekNumber, programSessionId: session.id }));
    scheduleMany(items);
    setMessage(`Program je uložený a ${items.length} tréninků bylo vloženo do kalendáře.`);
  }

  return (
    <PlanningShell eyebrow="Plán" title="Nový tréninkový program" description="Vyber cíl, délku, frekvenci a dostupné dny. Aplikace sestaví konkrétní tréninky automaticky." backHref="/plan">
      <section className="rounded-3xl border border-lime-400/20 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">1 · Cíl a úroveň</p>
        <div className="mt-4 grid grid-cols-2 gap-3">{(Object.entries(goalLabels) as [Goal, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => { setGoal(value); setWeeks([]); }} className={`rounded-2xl p-4 text-left font-black ${goal === value ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-200"}`}>{label}</button>)}</div>
        <div className="mt-4 grid grid-cols-3 gap-3">{([1, 2, 3] as Level[]).map((value) => <button key={value} type="button" onClick={() => { setLevel(value); setWeeks([]); }} className={`rounded-2xl py-3 font-black ${level === value ? "border border-lime-400 text-lime-300" : "bg-zinc-800 text-zinc-400"}`}>{value === 1 ? "Začátečník" : value === 2 ? "Pokročilý" : "Výkonnostní"}</button>)}</div>
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">2 · Délka a frekvence</p>
        <div className="mt-4 grid grid-cols-3 gap-3">{([4, 8, 12] as const).map((value) => <button key={value} type="button" onClick={() => { setDuration(value); setWeeks([]); }} className={`rounded-2xl py-4 font-black ${duration === value ? "bg-lime-400 text-zinc-950" : "bg-zinc-800"}`}>{value} týdnů</button>)}</div>
        <p className="mt-5 text-sm font-bold text-zinc-300">Kolikrát týdně chceš trénovat?</p>
        <div className="mt-3 grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => changeFrequency(value)} className={`rounded-xl py-3 font-black ${frequency === value ? "bg-lime-400 text-zinc-950" : "bg-zinc-800"}`}>{value}×</button>)}</div>
        <div className="mt-5 rounded-2xl bg-zinc-800 p-4 text-center"><p className="text-3xl font-black text-lime-400">{totalUnits}</p><p className="text-xs uppercase tracking-wide text-zinc-500">celkem jednotek</p></div>
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">3 · Dostupnost</p>
        <label className="mt-4 block"><span className="text-sm font-bold text-zinc-300">Začátek programu</span><input type="date" value={startDate} min={dateKey(new Date())} onChange={(e) => { setStartDate(e.target.value); setWeeks([]); }} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-base" /></label>
        <div className="mt-4 grid grid-cols-7 gap-2">{weekdays.map((day) => <button key={day.value} type="button" onClick={() => toggleDay(day.value)} className={`rounded-xl py-3 text-sm font-black ${trainingDays.includes(day.value) ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-500"}`}>{day.label}</button>)}</div>
        <p className="mt-3 text-center text-sm text-zinc-500">Vybráno {trainingDays.length} z {frequency} dnů</p>
      </section>

      <button type="button" onClick={generateProgram} className="mt-6 w-full rounded-2xl bg-lime-400 px-5 py-4 text-lg font-black text-zinc-950">Vygenerovat program</button>
      {message && <p className="mt-4 rounded-2xl bg-lime-400/10 p-4 text-center text-sm font-bold text-lime-300">{message}</p>}

      {weeks.length > 0 && <>
        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">4 · Náhled</p><h2 className="mt-2 text-2xl font-black">{duration} týdnů · {assigned} jednotek</h2></div><button type="button" onClick={generateProgram} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold">Regenerovat</button></div></section>
        <div className="mt-4 space-y-4">{weeks.map((week, weekIndex) => <section key={week.weekNumber} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-lime-400">Týden {week.weekNumber}</p><h3 className="mt-1 text-lg font-black">{week.focus}</h3></div><span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold">{phaseLabels[week.phase]}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{week.sessions.map((session, sessionIndex) => <label key={session.id} className="rounded-2xl bg-zinc-800 p-3"><span className="text-xs font-black uppercase tracking-wide text-lime-300">Jednotka {sessionIndex + 1}</span><select value={session.templateId ?? ""} onChange={(e) => updateSession(weekIndex, sessionIndex, e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-base">{data.templates.map((template) => <option key={template.id} value={template.id}>{template.metadata?.workoutCode ? `${template.metadata.workoutCode} · ` : ""}{template.title}</option>)}</select></label>)}</div></section>)}</div>
        <button type="button" onClick={saveAndSchedule} className="mt-6 w-full rounded-2xl bg-lime-400 px-5 py-4 text-lg font-black text-zinc-950">Uložit a vložit do kalendáře</button>
      </>}

      {ready && data.trainingPrograms.length > 0 && <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-xl font-black">Uložené programy</h2><div className="mt-4 space-y-3">{data.trainingPrograms.map((program) => <div key={program.id} className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-800 p-4"><div><p className="font-bold">{program.name}</p><p className="text-sm text-zinc-400">{program.weeks.length} týdnů · {program.weeks.flatMap((week) => week.sessions).length} jednotek</p></div><button type="button" onClick={() => deleteTrainingProgram(program.id)} className="rounded-xl border border-red-500/30 px-3 py-2 text-sm font-bold text-red-300">Smazat</button></div>)}</div></section>}
    </PlanningShell>
  );
}
