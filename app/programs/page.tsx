"use client";

import { useMemo, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { TrainingLocationManager } from "@/components/planning/TrainingLocationManager";
import { useHyroxData } from "@/hooks/useHyroxData";
import {
  TRAINING_LOCATION_PRESETS,
  findCompatibleLocationForTemplate,
  resolveTrainingLocation,
  templateFitsEquipment,
} from "@/lib/training-context";
import type {
  NewScheduledWorkout,
  ProgramWeek,
  ScheduledTrainingLocation,
} from "@/lib/types";
import { buildProgramWeeks, phaseLabels } from "@/lib/program-generator";
import type { ProgramGoal as Goal, ProgramLevel as Level } from "@/lib/program-generator";

const weekdays = [
  { value: 1, label: "Po" }, { value: 2, label: "Út" }, { value: 3, label: "St" },
  { value: 4, label: "Čt" }, { value: 5, label: "Pá" }, { value: 6, label: "So" }, { value: 0, label: "Ne" },
] as const;
const defaultDayOrder = [1, 2, 3, 4, 5, 6, 0];

const goalLabels: Record<Goal, string> = {
  race: "Příprava na hybridní závod",
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
  const [locationIds, setLocationIds] = useState<ScheduledTrainingLocation[]>(["hybrid-gym"]);
  const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
  const [message, setMessage] = useState("");

  const customLocations = useMemo(() => data.trainingLocations ?? [], [data.trainingLocations]);
  const locationOptions = useMemo(() => [
    ...Object.keys(TRAINING_LOCATION_PRESETS).map((id) =>
      resolveTrainingLocation(id as ScheduledTrainingLocation, customLocations)!,
    ),
    ...customLocations.map((location) => resolveTrainingLocation(location.id, customLocations)!),
  ], [customLocations]);
  const selectedLocations = locationOptions.filter((location) => locationIds.includes(location.id));
  const compatibleTemplates = data.templates.filter((template) =>
    selectedLocations.some((location) => templateFitsEquipment(template, location.equipment)),
  );

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

  function toggleLocation(locationId: ScheduledTrainingLocation) {
    setLocationIds((current) => {
      if (current.includes(locationId)) {
        return current.length === 1 ? current : current.filter((item) => item !== locationId);
      }
      return [...current, locationId];
    });
    setWeeks([]);
  }

  function generateProgram() {
    if (!data.templates.length) return setMessage("Nejdřív je potřeba mít alespoň jeden trénink v knihovně.");
    if (selectedLocations.length === 0) return setMessage("Vyber alespoň jedno místo, kde můžeš trénovat.");
    const generated = buildProgramWeeks({
      templates: data.templates,
      duration,
      frequency,
      goal,
      level,
      days: trainingDays,
      locations: selectedLocations.map((location) => ({
        id: location.id,
        equipment: location.equipment,
      })),
    });
    setWeeks(generated);
    const generatedAssigned = generated.flatMap((week) => week.sessions).filter((session) => session.templateId).length;
    setMessage(
      generatedAssigned === totalUnits
        ? `Vygenerováno ${duration} týdnů a ${totalUnits} jednotek podle vybavení ve vybraných místech.`
        : `Vygenerováno ${generatedAssigned} z ${totalUnits} jednotek. Pro zbývající sloty není ve zvolených místech dostupná kompatibilní šablona.`,
    );
  }

  function updateSession(weekIndex: number, sessionIndex: number, templateId: string) {
    if (!templateId) {
      setWeeks((current) => current.map((week, index) => index === weekIndex ? {
        ...week,
        sessions: week.sessions.map((session, i) => i === sessionIndex
          ? { ...session, templateId: null, trainingLocation: undefined }
          : session),
      } : week));
      return;
    }

    const template = data.templates.find((item) => item.id === templateId);
    if (!template) return;
    const location = findCompatibleLocationForTemplate(
      template,
      selectedLocations.map((item) => ({ id: item.id, equipment: item.equipment })),
    );
    if (!location) {
      setMessage("Vybraný trénink není možné kompletně odcvičit v žádném ze zvolených míst.");
      return;
    }

    setWeeks((current) => current.map((week, index) => index === weekIndex ? {
      ...week,
      sessions: week.sessions.map((session, i) => i === sessionIndex
        ? { ...session, templateId, trainingLocation: location.id }
        : session),
    } : week));
  }

  function saveAndSchedule() {
    if (!weeks.length) return setMessage("Nejdřív vygeneruj program.");
    if (preview.length !== totalUnits || assigned !== totalUnits) {
      return setMessage("Program zatím nemá kompatibilní trénink pro každý slot. Uprav dostupná místa nebo výběr jednotek.");
    }
    const name = `${goalLabels[goal]} · ${duration} týdnů · ${frequency}× týdně`;
    const program = createTrainingProgram({
      code: `PLAN-${Date.now().toString().slice(-6)}`,
      name,
      description: `Úroveň ${level}, ${frequency} tréninků týdně. Automaticky sestaveno podle cíle, dostupnosti a vybavení ve zvolených místech.`,
      weeks,
      trainingLocationIds: locationIds,
    });
    const items: NewScheduledWorkout[] = preview.map(({ session, week, date }) => ({
      templateId: session.templateId as string,
      date,
      time: session.time,
      status: "planned",
      trainingLocation: session.trainingLocation,
      programId: program.id,
      programWeek: week.weekNumber,
      programSessionId: session.id,
    }));
    scheduleMany(items);
    setMessage(`Program je uložený a ${items.length} tréninků bylo vloženo do kalendáře včetně doporučeného místa.`);
  }

  return (
    <PlanningShell eyebrow="Plán" title="Nový tréninkový program" description="Vyber cíl, délku, frekvenci, dostupné dny a místa. Aplikace sestaví jen tréninky, které lze ve zvoleném prostředí skutečně odcvičit." backHref="/plan">
      <section className="ui-card ui-card-accent p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">1 · Cíl a úroveň</p>
        <div className="mt-4 grid grid-cols-2 gap-3">{(Object.entries(goalLabels) as [Goal, string][]).map(([value, label]) => <button key={value} type="button" aria-pressed={goal === value} onClick={() => { setGoal(value); setWeeks([]); }} className="ui-choice justify-start p-4 text-left">{label}</button>)}</div>
        <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">{([1, 2, 3] as Level[]).map((value) => <button key={value} type="button" aria-pressed={level === value} onClick={() => { setLevel(value); setWeeks([]); }} className="ui-choice px-2 py-3 text-sm sm:text-base">{value === 1 ? "Začátečník" : value === 2 ? "Pokročilý" : "Výkonnostní"}</button>)}</div>
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">2 · Délka a frekvence</p>
        <div className="mt-4 grid grid-cols-3 gap-3">{([4, 8, 12] as const).map((value) => <button key={value} type="button" aria-pressed={duration === value} onClick={() => { setDuration(value); setWeeks([]); }} className="ui-choice px-2 py-4">{value} týdnů</button>)}</div>
        <p className="mt-5 text-sm font-bold text-zinc-300">Kolikrát týdně chceš trénovat?</p>
        <div className="mt-3 grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-pressed={frequency === value} onClick={() => changeFrequency(value)} className="ui-choice px-1 py-3">{value}×</button>)}</div>
        <div className="ui-inset mt-5 p-4 text-center"><p className="text-3xl font-black text-accent">{totalUnits}</p><p className="text-xs uppercase tracking-wide text-zinc-500">celkem jednotek</p></div>
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">3 · Dostupnost</p>
        <label className="mt-4 block"><span className="text-sm font-bold text-zinc-300">Začátek programu</span><input type="date" value={startDate} min={dateKey(new Date())} onChange={(e) => { setStartDate(e.target.value); setWeeks([]); }} className="ui-field mt-2 text-base" /></label>
        <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">{weekdays.map((day) => <button key={day.value} type="button" aria-pressed={trainingDays.includes(day.value)} onClick={() => toggleDay(day.value)} className="ui-choice min-w-0 px-1 py-3 text-sm">{day.label}</button>)}</div>
        <p className="mt-3 text-center text-sm text-zinc-500">Vybráno {trainingDays.length} z {frequency} dnů</p>

        <p className="mt-6 text-sm font-bold text-zinc-300">Kde můžeš během programu trénovat?</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {locationOptions.map((location) => (
            <button
              key={location.id}
              type="button"
              aria-pressed={locationIds.includes(location.id)}
              onClick={() => toggleLocation(location.id)}
              className="ui-choice justify-start p-4 text-left"
            >
              <span>
                <strong className="block">{location.label}</strong>
                <span className="mt-1 block text-xs font-normal text-zinc-500">{location.description}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-sm text-zinc-500">Vybráno {selectedLocations.length} míst. Každá jednotka musí být kompletně proveditelná alespoň v jednom z nich.</p>
      </section>

      <TrainingLocationManager />

      <button type="button" onClick={generateProgram} className={`ui-button ui-button-lg mt-6 w-full ${weeks.length > 0 ? "ui-button-accent" : "ui-button-primary"}`}>Vygenerovat program</button>
      {message && <p role="status" className="ui-feedback ui-feedback-success mt-4 text-center text-sm font-bold">{message}</p>}

      {weeks.length > 0 && <>
        <section className="ui-card mt-6 p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-accent">4 · Náhled</p><h2 className="mt-2 text-2xl font-black">{duration} týdnů · {assigned} jednotek</h2></div><button type="button" onClick={generateProgram} className="ui-button ui-button-outline ui-button-sm">Regenerovat</button></div></section>
        <div className="mt-4 space-y-4">{weeks.map((week, weekIndex) => <section key={week.weekNumber} className="ui-card p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-accent">Týden {week.weekNumber}</p><h3 className="mt-1 text-lg font-black">{week.focus}</h3></div><span className="ui-chip">{phaseLabels[week.phase]}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{week.sessions.map((session, sessionIndex) => { const location = session.trainingLocation ? resolveTrainingLocation(session.trainingLocation, customLocations) : null; return <label key={session.id} className="ui-inset p-3"><span className="text-xs font-black uppercase tracking-wide text-accent">Jednotka {sessionIndex + 1}</span><select value={session.templateId ?? ""} onChange={(e) => updateSession(weekIndex, sessionIndex, e.target.value)} className="ui-field mt-2 bg-surface px-3 py-3 text-base"><option value="">Bez kompatibilní jednotky</option>{compatibleTemplates.map((template) => <option key={template.id} value={template.id}>{template.metadata?.workoutCode ? `${template.metadata.workoutCode} · ` : ""}{template.title}</option>)}</select>{location && <p className="mt-2 text-xs font-bold text-zinc-500">Doporučené místo: <span className="text-zinc-300">{location.label}</span></p>}</label>; })}</div></section>)}</div>
        <button type="button" onClick={saveAndSchedule} className="ui-button ui-button-primary ui-button-lg mt-6 w-full">Uložit a vložit do kalendáře</button>
      </>}

      {ready && data.trainingPrograms.length > 0 && <section className="ui-card mt-8 p-5"><h2 className="text-xl font-black">Uložené programy</h2><div className="mt-4 space-y-3">{data.trainingPrograms.map((program) => <div key={program.id} className="ui-inset flex items-center justify-between gap-3 p-4"><div><p className="font-bold">{program.name}</p><p className="text-sm text-zinc-400">{program.weeks.length} týdnů · {program.weeks.flatMap((week) => week.sessions).length} jednotek</p></div><button type="button" onClick={() => deleteTrainingProgram(program.id)} className="ui-button ui-button-danger ui-button-sm shrink-0">Smazat</button></div>)}</div></section>}
    </PlanningShell>
  );
}
