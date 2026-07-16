"use client";

import { useEffect, useMemo, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import type { NewScheduledWorkout, ProgramPhase, ProgramWeek } from "@/lib/types";

const phaseLabels: Record<ProgramPhase, string> = {
  base: "Base",
  build: "Build",
  deload: "Deload",
  specific: "Race specific",
  taper: "Taper",
};

const weekdays = [
  { value: 1 as const, label: "Po" },
  { value: 3 as const, label: "St" },
  { value: 6 as const, label: "So" },
];

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function firstMondayOnOrAfter(date: Date) {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  const day = result.getDay();
  const offset = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
  result.setDate(result.getDate() + offset);
  return result;
}

function defaultWeeks(): ProgramWeek[] {
  return Array.from({ length: 12 }, (_, index) => {
    const week = index + 1;
    const phase: ProgramPhase = week <= 3 ? "base" : week === 4 ? "deload" : week <= 7 ? "build" : week === 8 ? "deload" : week <= 11 ? "specific" : "taper";
    return {
      weekNumber: week,
      title: `Týden ${week}`,
      phase,
      focus: phase === "base" ? "Vybudovat aerobní základ" : phase === "build" ? "Zvýšit výkon a práh" : phase === "deload" ? "Regenerace a kontrola techniky" : phase === "specific" ? "Závodní kombinace a přechody" : "Snížit objem a zachovat ostrost",
      sessions: weekdays.map((day, sessionIndex) => ({
        id: crypto.randomUUID(),
        weekday: day.value,
        time: sessionIndex === 2 ? "09:00" : "18:00",
        templateId: null,
        note: "",
      })),
    };
  });
}

export default function ProgramsPage() {
  const { data, ready, createTrainingProgram, deleteTrainingProgram, scheduleMany } = useHyroxData();
  const [code, setCode] = useState("PLAN-001");
  const [name, setName] = useState("HYROX Base to Race · 12 týdnů");
  const [description, setDescription] = useState("Tři tréninky týdně s postupem od základní vytrvalosti k závodní specifice.");
  const [weeks, setWeeks] = useState<ProgramWeek[]>(defaultWeeks);
  const [startDate, setStartDate] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setStartDate(dateKey(new Date()));
  }, []);

  const assigned = useMemo(() => weeks.flatMap((week) => week.sessions).filter((session) => session.templateId).length, [weeks]);

  function updateWeek(weekIndex: number, updates: Partial<ProgramWeek>) {
    setWeeks((current) => current.map((week, index) => index === weekIndex ? { ...week, ...updates } : week));
  }

  function updateSession(weekIndex: number, sessionIndex: number, templateId: string) {
    setWeeks((current) => current.map((week, index) => index === weekIndex ? {
      ...week,
      sessions: week.sessions.map((session, i) => i === sessionIndex ? { ...session, templateId: templateId || null } : session),
    } : week));
  }

  function saveProgram() {
    if (!name.trim()) return setMessage("Doplň název programu.");
    const program = createTrainingProgram({ code: code.trim() || "PLAN", name: name.trim(), description: description.trim(), weeks });
    setMessage(`Program „${program.name}“ je uložený.`);
  }

  function scheduleProgram() {
    if (!startDate) return setMessage("Vyber datum zahájení programu.");
    const selectedStart = new Date(`${startDate}T12:00:00`);
    const base = firstMondayOnOrAfter(selectedStart);
    const program = createTrainingProgram({ code: code.trim() || "PLAN", name: name.trim(), description: description.trim(), weeks });
    const items: NewScheduledWorkout[] = [];
    for (const week of weeks) {
      for (const session of week.sessions) {
        if (!session.templateId) continue;
        const target = new Date(base);
        const offset = session.weekday === 0 ? 6 : session.weekday - 1;
        target.setDate(base.getDate() + (week.weekNumber - 1) * 7 + offset);
        items.push({
          templateId: session.templateId,
          date: dateKey(target),
          time: session.time,
          status: "planned",
          programId: program.id,
          programWeek: week.weekNumber,
          programSessionId: session.id,
        });
      }
    }
    scheduleMany(items);
    setMessage(`Program začíná ${dateKey(base)} a do kalendáře bylo přidáno ${items.length} tréninků.`);
  }

  return (
    <PlanningShell eyebrow="Fáze 3B" title="Tréninkové programy" description="Sestav 12týdenní plán, přiřaď jednotky a vlož celý program do kalendáře." backHref="/">
      <section className="rounded-3xl border border-lime-400/20 bg-zinc-900 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-bold text-zinc-300">Kód programu</span><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>
          <label><span className="text-sm font-bold text-zinc-300">Nejdřívější datum zahájení</span><input type="date" value={startDate} min={startDate || undefined} onChange={(e) => setStartDate(e.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /><span className="mt-2 block text-xs text-zinc-500">Program se vloží od prvního pondělí, které není před tímto datem.</span></label>
          <label className="sm:col-span-2"><span className="text-sm font-bold text-zinc-300">Název</span><input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>
          <label className="sm:col-span-2"><span className="text-sm font-bold text-zinc-300">Popis</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center"><Stat value={12} label="týdnů" /><Stat value={assigned} label="přiřazeno" /><Stat value={36} label="max. jednotek" /></div>
      </section>

      <div className="mt-6 space-y-4">
        {weeks.map((week, weekIndex) => (
          <section key={week.weekNumber} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Týden {week.weekNumber}</p><input value={week.title} onChange={(e) => updateWeek(weekIndex, { title: e.target.value })} className="mt-1 w-full bg-transparent text-xl font-black outline-none" /></div>
              <select value={week.phase} onChange={(e) => updateWeek(weekIndex, { phase: e.target.value as ProgramPhase })} className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-bold">{Object.entries(phaseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </div>
            <input value={week.focus} onChange={(e) => updateWeek(weekIndex, { focus: e.target.value })} className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-800/70 px-3 py-3 text-sm text-zinc-300" />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {week.sessions.map((session, sessionIndex) => (
                <label key={session.id} className="rounded-2xl bg-zinc-800 p-3"><span className="text-xs font-black uppercase tracking-wide text-lime-300">{weekdays[sessionIndex]?.label}</span><select value={session.templateId ?? ""} onChange={(e) => updateSession(weekIndex, sessionIndex, e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm"><option value="">Volno</option>{data.templates.map((template) => <option key={template.id} value={template.id}>{template.metadata?.workoutCode ? `${template.metadata.workoutCode} · ` : ""}{template.title}</option>)}</select></label>
              ))}
            </div>
          </section>
        ))}
      </div>

      {message && <p className="mt-5 rounded-2xl bg-lime-400/10 p-4 text-center text-sm font-bold text-lime-300">{message}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={saveProgram} className="rounded-2xl border border-lime-400/40 px-5 py-4 font-black text-lime-300">Uložit program</button><button type="button" onClick={scheduleProgram} className="rounded-2xl bg-lime-400 px-5 py-4 font-black text-zinc-950">Uložit a vložit do kalendáře</button></div>

      {ready && data.trainingPrograms.length > 0 && <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-xl font-black">Uložené programy</h2><div className="mt-4 space-y-3">{data.trainingPrograms.map((program) => <div key={program.id} className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-800 p-4"><div><p className="text-xs font-black text-lime-300">{program.code}</p><p className="font-bold">{program.name}</p><p className="text-sm text-zinc-400">{program.weeks.length} týdnů · {program.weeks.flatMap((week) => week.sessions).filter((session) => session.templateId).length} tréninků</p></div><button onClick={() => deleteTrainingProgram(program.id)} className="rounded-xl border border-red-500/30 px-3 py-2 text-sm font-bold text-red-300">Smazat</button></div>)}</div></section>}
    </PlanningShell>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl bg-zinc-800 p-4"><p className="text-2xl font-black text-lime-400">{value}</p><p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p></div>;
}
