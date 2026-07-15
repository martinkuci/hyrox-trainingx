"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { StatusBadge } from "@/components/planning/StatusBadge";
import { useHyroxData } from "@/hooks/useHyroxData";
import type {
  NewScheduledWorkout,
  ScheduledWorkout,
  ScheduledWorkoutStatus,
  WeeklyPlanDay,
} from "@/lib/types";

const weekdayLabels = [
  { value: 1 as const, label: "Pondělí", short: "Po" },
  { value: 2 as const, label: "Úterý", short: "Út" },
  { value: 3 as const, label: "Středa", short: "St" },
  { value: 4 as const, label: "Čtvrtek", short: "Čt" },
  { value: 5 as const, label: "Pátek", short: "Pá" },
  { value: 6 as const, label: "Sobota", short: "So" },
  { value: 0 as const, label: "Neděle", short: "Ne" },
];

type ConflictMode = "skip" | "replace" | "duplicate";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function mondayKey(date = new Date()) {
  const result = new Date(date);
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  return dateKey(result);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDate(value));
}

function emptyWeek(): WeeklyPlanDay[] {
  return weekdayLabels.map((day) => ({
    weekday: day.value,
    templateId: null,
    time: "18:00",
  }));
}

export default function CalendarPage() {
  const {
    data,
    ready,
    scheduleWorkout,
    scheduleMany,
    replaceSchedulesForDates,
    createWeeklyPlan,
    deleteWeeklyPlan,
    updateScheduledWorkout,
    deleteScheduledWorkout,
  } = useHyroxData();

  const today = dateKey(new Date());
  const [templateId, setTemplateId] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("18:00");
  const [pendingDelete, setPendingDelete] = useState<ScheduledWorkout | null>(null);
  const [message, setMessage] = useState("");

  const [planName, setPlanName] = useState("Přípravný týden");
  const [weekStart, setWeekStart] = useState(mondayKey());
  const [weeks, setWeeks] = useState<4 | 8 | 12>(4);
  const [weekDays, setWeekDays] = useState<WeeklyPlanDay[]>(emptyWeek);
  const [planMessage, setPlanMessage] = useState("");
  const [pendingGenerated, setPendingGenerated] = useState<NewScheduledWorkout[] | null>(null);

  const items = useMemo(
    () =>
      [...data.scheduledWorkouts].sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
      ),
    [data.scheduledWorkouts],
  );

  const activeDays = useMemo(() => weekDays.filter((day) => day.templateId), [weekDays]);
  const selectedDayNames = activeDays
    .map((day) => weekdayLabels.find((item) => item.value === day.weekday)?.short)
    .filter(Boolean)
    .join(", ");
  const plannedCount = activeDays.length * weeks;

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

  function updateWeekDay(weekday: WeeklyPlanDay["weekday"], updates: Partial<WeeklyPlanDay>) {
    setWeekDays((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...updates } : day)),
    );
  }

  function clearWeek() {
    setWeekDays(emptyWeek());
    setPlanMessage("Týdenní rozvrh je vyčištěný.");
  }

  function loadPlan(planId: string) {
    const plan = data.weeklyPlans.find((item) => item.id === planId);
    if (!plan) return;
    setPlanName(plan.name);
    setWeekDays(
      weekdayLabels.map((weekday) => {
        const saved = plan.days.find((day) => day.weekday === weekday.value);
        return saved ?? { weekday: weekday.value, templateId: null, time: "18:00" };
      }),
    );
    setPlanMessage(`Načtena šablona „${plan.name}“.`);
  }

  function savePlan() {
    const name = planName.trim();
    if (!name) return setPlanMessage("Doplň název šablony.");
    if (activeDays.length === 0) return setPlanMessage("Vyber alespoň jeden trénink v týdnu.");
    createWeeklyPlan({ name, days: weekDays });
    setPlanMessage(`Šablona „${name}“ je uložená.`);
  }

  function buildGeneratedPlan() {
    const start = parseDate(weekStart);
    const monday = parseDate(mondayKey(start));
    const generated: NewScheduledWorkout[] = [];

    for (let week = 0; week < weeks; week += 1) {
      for (const day of activeDays) {
        const offset = day.weekday === 0 ? 6 : day.weekday - 1;
        const target = new Date(monday);
        target.setDate(monday.getDate() + week * 7 + offset);
        generated.push({
          templateId: day.templateId as string,
          date: dateKey(target),
          time: day.time || "18:00",
          status: "planned",
        });
      }
    }
    return generated;
  }

  function generatePlan() {
    if (activeDays.length === 0) return setPlanMessage("Vyber alespoň jeden trénink v týdnu.");
    const generated = buildGeneratedPlan();
    const generatedDates = new Set(generated.map((item) => item.date));
    const conflicts = data.scheduledWorkouts.filter((item) => generatedDates.has(item.date));

    if (conflicts.length > 0) {
      setPendingGenerated(generated);
      setPlanMessage(`Nalezeno ${conflicts.length} kolizí. Vyber, jak je vyřešit.`);
      return;
    }

    scheduleMany(generated);
    setPlanMessage(`Vygenerováno ${generated.length} tréninků na ${weeks} týdnů.`);
  }

  function resolveConflicts(mode: ConflictMode) {
    if (!pendingGenerated) return;
    const existingDates = new Set(data.scheduledWorkouts.map((item) => item.date));

    if (mode === "skip") {
      const filtered = pendingGenerated.filter((item) => !existingDates.has(item.date));
      scheduleMany(filtered);
      setPlanMessage(`Přidáno ${filtered.length} tréninků, kolize byly přeskočeny.`);
    } else if (mode === "replace") {
      const dates = Array.from(new Set(pendingGenerated.map((item) => item.date)));
      replaceSchedulesForDates(pendingGenerated, dates);
      setPlanMessage(`Nahrazeny kolize a uloženo ${pendingGenerated.length} tréninků.`);
    } else {
      scheduleMany(pendingGenerated);
      setPlanMessage(`Přidáno ${pendingGenerated.length} tréninků včetně duplicit.`);
    }

    setPendingGenerated(null);
  }

  return (
    <PlanningShell
      eyebrow="Plán"
      title="Kalendář"
      description="Naplánuj jednotlivý trénink nebo si připrav celý vícetýdenní rozvrh."
    >
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-xl font-black">Přidat jeden trénink</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-bold text-zinc-300">Trénink</span>
            <select value={templateId || data.templates[0]?.id || ""} onChange={(event) => setTemplateId(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5">
              {data.templates.length === 0 && <option value="">Žádný trénink</option>}
              {data.templates.map((template) => <option key={template.id} value={template.id}>{template.title} · {template.durationMinutes} min</option>)}
            </select>
          </label>
          <label><span className="text-sm font-bold text-zinc-300">Datum</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>
          <label><span className="text-sm font-bold text-zinc-300">Čas</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>
        </div>
        <button type="button" onClick={addToCalendar} className="mt-5 w-full rounded-2xl bg-lime-400 px-5 py-4 font-black text-zinc-950">Naplánovat trénink</button>
        {message && <p className="mt-3 text-center text-sm font-semibold text-zinc-400">{message}</p>}
      </section>

      <section className="mt-6 rounded-3xl border border-lime-400/20 bg-zinc-900 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Rozvrh</p><h2 className="mt-2 text-2xl font-black">Týdenní plán Po–Ne</h2><p className="mt-2 text-sm text-zinc-400">Prázdný den znamená volno.</p></div>
          <span className="rounded-full bg-lime-400/10 px-3 py-1.5 text-xs font-bold text-lime-300">4 / 8 / 12 týdnů</span>
        </div>

        {data.weeklyPlans.length > 0 && (
          <label className="mt-5 block"><span className="text-sm font-bold text-zinc-300">Načíst uloženou šablonu</span><select defaultValue="" onChange={(event) => loadPlan(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5"><option value="" disabled>Vyber šablonu</option>{data.weeklyPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
        )}

        <label className="mt-5 block"><span className="text-sm font-bold text-zinc-300">Název šablony</span><input value={planName} onChange={(event) => setPlanName(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>

        <div className="mt-5 space-y-3">
          {weekdayLabels.map((weekday) => {
            const day = weekDays.find((item) => item.weekday === weekday.value)!;
            return (
              <div key={weekday.value} className="grid grid-cols-[3.25rem_1fr] gap-3 rounded-2xl bg-zinc-800/70 p-3 sm:grid-cols-[6rem_1fr_8rem] sm:items-center">
                <div className="font-black text-lime-300"><span className="sm:hidden">{weekday.short}</span><span className="hidden sm:inline">{weekday.label}</span></div>
                <select value={day.templateId ?? ""} onChange={(event) => updateWeekDay(weekday.value, { templateId: event.target.value || null })} className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm"><option value="">Volno</option>{data.templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select>
                <input type="time" value={day.time} disabled={!day.templateId} onChange={(event) => updateWeekDay(weekday.value, { time: event.target.value })} className="col-start-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm disabled:opacity-40 sm:col-start-auto" />
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-zinc-800 p-4 text-sm">
          <span className="text-zinc-400">Vybrané dny: <strong className="text-white">{selectedDayNames || "žádné"}</strong></span>
          <span className="font-black text-lime-300">{plannedCount} tréninků</span>
        </div>

        <button type="button" onClick={clearWeek} className="mt-3 w-full rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-300">Vyčistit týden</button>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-bold text-zinc-300">Týden od</span><input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5" /></label>
          <div><span className="text-sm font-bold text-zinc-300">Délka plánu</span><div className="mt-2 grid grid-cols-3 gap-2">{[4, 8, 12].map((value) => <button key={value} type="button" onClick={() => setWeeks(value as 4 | 8 | 12)} className={`rounded-2xl px-3 py-3.5 font-black ${weeks === value ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>{value} týdnů</button>)}</div></div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={savePlan} className="rounded-2xl border border-zinc-700 px-5 py-4 font-bold text-zinc-200">Uložit šablonu</button><button type="button" onClick={generatePlan} className="rounded-2xl bg-lime-400 px-5 py-4 font-black text-zinc-950">Vygenerovat plán</button></div>

        {pendingGenerated && (
          <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
            <p className="font-bold text-amber-200">Některé dny už mají naplánovaný trénink.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => resolveConflicts("skip")} className="rounded-xl bg-zinc-800 px-3 py-3 text-sm font-bold">Přeskočit</button>
              <button type="button" onClick={() => resolveConflicts("replace")} className="rounded-xl bg-amber-300 px-3 py-3 text-sm font-black text-zinc-950">Nahradit</button>
              <button type="button" onClick={() => resolveConflicts("duplicate")} className="rounded-xl border border-zinc-700 px-3 py-3 text-sm font-bold">Duplikovat</button>
            </div>
          </div>
        )}

        {data.weeklyPlans.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{data.weeklyPlans.map((plan) => <button key={plan.id} type="button" onClick={() => deleteWeeklyPlan(plan.id)} className="rounded-full bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-400">Smazat: {plan.name}</button>)}</div>}
        {planMessage && <p className="mt-4 text-center text-sm font-semibold text-zinc-400">{planMessage}</p>}
      </section>

      <div className="mt-8 flex items-center justify-between gap-4"><h2 className="text-2xl font-black">Naplánované dny</h2><span className="text-sm text-zinc-500">{items.length} položek</span></div>
      {!ready && <div className="mt-4 h-40 animate-pulse rounded-3xl bg-zinc-900" />}
      {ready && items.length === 0 && <section className="mt-4 rounded-3xl border border-dashed border-zinc-700 p-7 text-center text-zinc-400">Kalendář je zatím prázdný.</section>}

      <div className="mt-4 space-y-4">
        {items.map((item) => {
          const template = data.templates.find((entry) => entry.id === item.templateId);
          if (!template) return null;
          return (
            <article key={item.id} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-start justify-between gap-4"><div><p className="capitalize text-sm font-bold text-lime-400">{dateLabel(item.date)}</p><h3 className="mt-1 text-2xl font-black">{template.title}</h3><p className="mt-1 text-sm text-zinc-500">{template.durationMinutes} min</p></div><StatusBadge status={item.status} /></div>
              <div className="mt-5 grid grid-cols-2 gap-3"><label><span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Přesunout na</span><input type="date" value={item.date} onChange={(event) => updateScheduledWorkout(item.id, { date: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-3 text-sm" /></label><label><span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Čas</span><input type="time" value={item.time} onChange={(event) => updateScheduledWorkout(item.id, { time: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-3 text-sm" /></label></div>
              <label className="mt-3 block"><span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Stav</span><select value={item.status} onChange={(event) => updateScheduledWorkout(item.id, { status: event.target.value as ScheduledWorkoutStatus })} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-3 text-sm"><option value="planned">Naplánováno</option><option value="completed">Dokončeno</option><option value="skipped">Vynecháno</option></select></label>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-3"><Link href={`/workout/${template.id}?scheduleId=${item.id}`} className="rounded-2xl bg-lime-400 px-4 py-3.5 text-center font-black text-zinc-950">Spustit</Link><button type="button" onClick={() => setPendingDelete(item)} className="rounded-2xl border border-red-500/30 px-4 py-3.5 font-semibold text-red-300">Smazat</button></div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog open={pendingDelete !== null} title="Odstranit z kalendáře?" description="Tréninková šablona ani historie se nesmažou." confirmLabel="Odstranit" destructive onCancel={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) deleteScheduledWorkout(pendingDelete.id); setPendingDelete(null); }} />
    </PlanningShell>
  );
}
