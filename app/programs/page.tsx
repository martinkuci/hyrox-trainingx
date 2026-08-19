"use client";

import { useMemo, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { TrainingLocationManager } from "@/components/planning/TrainingLocationManager";
import { useHyroxData } from "@/hooks/useHyroxData";
import {
  equipmentRequirementLabelsForTemplate,
  findCompatibleLocationForTemplate,
  resolveTrainingLocation,
  templateFitsEquipment,
  workoutContentSummary,
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
const quickEnvironmentIds: ScheduledTrainingLocation[] = ["outdoor", "home"];

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
  const [locationIds, setLocationIds] = useState<ScheduledTrainingLocation[]>([]);
  const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
  const [message, setMessage] = useState("");

  const customLocations = data.trainingLocations ?? [];
  const savedLocationOptions = customLocations.map((location) =>
    resolveTrainingLocation(location.id, customLocations)!,
  );
  const quickLocationOptions = quickEnvironmentIds.map((id) =>
    resolveTrainingLocation(id, customLocations)!,
  );
  const locationOptions = [...savedLocationOptions, ...quickLocationOptions];
  const selectedLocations = locationOptions.filter((location) => locationIds.includes(location.id));
  const locationFlexible = selectedLocations.length === 0;
  const compatibleTemplates = locationFlexible
    ? data.templates
    : data.templates.filter((template) =>
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

  function resetGeneratedProgram() {
    setWeeks([]);
    setMessage("");
  }

  function changeFrequency(nextFrequency: number) {
    setFrequency(nextFrequency);
    setTrainingDays((current) => {
      const next = current.slice(0, nextFrequency);
      for (const day of defaultDayOrder) if (next.length < nextFrequency && !next.includes(day)) next.push(day);
      return next;
    });
    resetGeneratedProgram();
  }

  function toggleDay(day: number) {
    setTrainingDays((current) => {
      if (current.includes(day)) return current.length === 1 ? current : current.filter((item) => item !== day);
      if (current.length >= frequency) return [...current.slice(1), day];
      return [...current, day];
    });
    resetGeneratedProgram();
  }

  function useFlexibleLocation() {
    setLocationIds([]);
    resetGeneratedProgram();
  }

  function toggleLocation(locationId: ScheduledTrainingLocation) {
    setLocationIds((current) =>
      current.includes(locationId)
        ? current.filter((item) => item !== locationId)
        : [...current, locationId],
    );
    resetGeneratedProgram();
  }

  function selectCreatedLocation(locationId: ScheduledTrainingLocation) {
    setLocationIds((current) => current.includes(locationId) ? current : [...current, locationId]);
    resetGeneratedProgram();
  }

  function generateProgram() {
    if (!data.templates.length) return setMessage("Nejdřív je potřeba mít alespoň jeden trénink v knihovně.");
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
    if (generatedAssigned !== totalUnits) {
      setMessage(`Vygenerováno ${generatedAssigned} z ${totalUnits} jednotek. Ve zvolených místech není pro všechny sloty dostupná kompatibilní šablona.`);
      return;
    }
    setMessage(
      locationFlexible
        ? `Program je připravený: ${duration} týdnů a ${totalUnits} jednotek. Místo zatím neomezujeme a vybereš ho až podle situace.`
        : `Program je připravený: ${duration} týdnů a ${totalUnits} jednotek podle cíle, fáze a vybavení ve vybraných místech.`,
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

    if (locationFlexible) {
      setWeeks((current) => current.map((week, index) => index === weekIndex ? {
        ...week,
        sessions: week.sessions.map((session, i) => i === sessionIndex
          ? { ...session, templateId, trainingLocation: undefined }
          : session),
      } : week));
      return;
    }

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
      return setMessage("Program zatím nemá trénink pro každý slot. Uprav výběr jednotek nebo dostupná místa.");
    }
    const name = `${goalLabels[goal]} · ${duration} týdnů · ${frequency}× týdně`;
    const program = createTrainingProgram({
      code: `PLAN-${Date.now().toString().slice(-6)}`,
      name,
      description: locationFlexible
        ? `Úroveň ${level}, ${frequency} tréninků týdně. Program je sestavený podle cíle a progresivních fází; místo se volí až podle situace u konkrétní jednotky.`
        : `Úroveň ${level}, ${frequency} tréninků týdně. Automaticky sestaveno podle cíle, dostupnosti a vybavení ve zvolených místech.`,
      weeks,
      trainingLocationIds: locationIds.length ? locationIds : undefined,
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
    setWeeks([]);
    setMessage(
      locationFlexible
        ? `Hotovo. Program je uložený a ${items.length} tréninků je v kalendáři. Konkrétní místo můžeš doplnit až před tréninkem.`
        : `Hotovo. Program je uložený a ${items.length} tréninků bylo vloženo do kalendáře včetně doporučeného místa.`,
    );
  }

  return (
    <PlanningShell
      eyebrow="Plán"
      title="Nový tréninkový program"
      description="Vyber cíl, délku a dny. Místo můžeš zadat teď, nebo ho nechat úplně otevřené a rozhodnout se až před konkrétním tréninkem."
      backHref="/plan"
    >
      <section className="ui-card ui-card-accent p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">1 · Cíl a úroveň</p>
        <div className="mt-4 grid grid-cols-2 gap-3">{(Object.entries(goalLabels) as [Goal, string][]).map(([value, label]) => <button key={value} type="button" aria-pressed={goal === value} onClick={() => { setGoal(value); resetGeneratedProgram(); }} className="ui-choice justify-start p-4 text-left">{label}</button>)}</div>
        <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">{([1, 2, 3] as Level[]).map((value) => <button key={value} type="button" aria-pressed={level === value} onClick={() => { setLevel(value); resetGeneratedProgram(); }} className="ui-choice px-2 py-3 text-sm sm:text-base">{value === 1 ? "Začátečník" : value === 2 ? "Pokročilý" : "Výkonnostní"}</button>)}</div>
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">2 · Délka a frekvence</p>
        <div className="mt-4 grid grid-cols-3 gap-3">{([4, 8, 12] as const).map((value) => <button key={value} type="button" aria-pressed={duration === value} onClick={() => { setDuration(value); resetGeneratedProgram(); }} className="ui-choice px-2 py-4">{value} týdnů</button>)}</div>
        <p className="mt-5 text-sm font-bold text-zinc-300">Kolikrát týdně chceš trénovat?</p>
        <div className="mt-3 grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-pressed={frequency === value} onClick={() => changeFrequency(value)} className="ui-choice px-1 py-3">{value}×</button>)}</div>
        <div className="ui-inset mt-5 p-4 text-center"><p className="text-3xl font-black text-accent">{totalUnits}</p><p className="text-xs uppercase tracking-wide text-zinc-500">celkem jednotek</p></div>
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">3 · Dny a místo</p>
        <label className="mt-4 block"><span className="text-sm font-bold text-zinc-300">Začátek programu</span><input type="date" value={startDate} min={dateKey(new Date())} onChange={(e) => { setStartDate(e.target.value); resetGeneratedProgram(); }} className="ui-field mt-2 text-base" /></label>
        <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">{weekdays.map((day) => <button key={day.value} type="button" aria-pressed={trainingDays.includes(day.value)} onClick={() => toggleDay(day.value)} className="ui-choice min-w-0 px-1 py-3 text-sm">{day.label}</button>)}</div>
        <p className="mt-3 text-center text-sm text-zinc-500">Vybráno {trainingDays.length} z {frequency} dnů</p>

        <div className="mt-6 border-t border-white/8 pt-5">
          <p className="text-sm font-bold text-zinc-300">Kde budeš trénovat?</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Nemusíš to vědět dopředu. Místo lze změnit i těsně před konkrétní jednotkou.</p>

          <button
            type="button"
            aria-pressed={locationFlexible}
            onClick={useFlexibleLocation}
            className="ui-choice mt-3 w-full justify-start p-4 text-left"
          >
            <span>
              <strong className="block">Rozhodnu až v den tréninku</strong>
              <span className="mt-1 block text-xs font-normal leading-5 text-zinc-500">Enginn teď sestaví nejlepší program bez omezení konkrétním fitkem. Později vybereš místo a případná varianta se přizpůsobí.</span>
            </span>
          </button>

          {savedLocationOptions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Moje místa</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {savedLocationOptions.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    aria-pressed={locationIds.includes(location.id)}
                    onClick={() => toggleLocation(location.id)}
                    className="ui-choice justify-start p-3 text-left"
                  >
                    <span>
                      <strong className="block text-sm">{location.label}</strong>
                      <span className="mt-0.5 block text-xs font-normal text-zinc-500">{location.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Rychlá prostředí</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {quickLocationOptions.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  aria-pressed={locationIds.includes(location.id)}
                  onClick={() => toggleLocation(location.id)}
                  className="ui-choice justify-start p-3 text-left"
                >
                  <span>
                    <strong className="block text-sm">{location.label}</strong>
                    <span className="mt-0.5 block text-xs font-normal text-zinc-500">{location.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-zinc-500">
            {locationFlexible
              ? "Místo je otevřené. Program nebude blokovaný vybavením, které zatím neznáš."
              : `Vybráno ${selectedLocations.length} míst. Každá jednotka bude proveditelná alespoň v jednom z nich.`}
          </p>
        </div>
      </section>

      <TrainingLocationManager onLocationCreated={(location) => selectCreatedLocation(location.id)} />

      <button type="button" onClick={generateProgram} className={`ui-button ui-button-lg mt-5 w-full ${weeks.length > 0 ? "ui-button-accent" : "ui-button-primary"}`}>Vygenerovat program</button>
      {message && <p role="status" className="ui-feedback ui-feedback-success mt-4 text-center text-sm font-bold">{message}</p>}

      {weeks.length > 0 && (
        <>
          <section className="ui-card ui-card-accent mt-5 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Program připraven</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">{duration} týdnů · {assigned} jednotek</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {locationFlexible
                    ? "Enginn rozložil intenzitu a fáze. Místo zatím zůstává otevřené a vyřešíš ho až podle reality daného dne."
                    : "Enginn už rozložil intenzitu, fáze i dostupná místa. Jednotlivé workouty nemusíš teď ručně kontrolovat."}
                </p>
              </div>
              <span className="ui-chip ui-chip-accent shrink-0">{frequency}× týdně</span>
            </div>
            <div className="ui-inset mt-4 p-3 text-sm">
              <span className="font-bold text-zinc-300">Místo: </span>
              <span className="text-zinc-400">
                {locationFlexible ? "rozhodneš později" : selectedLocations.map((location) => location.label).join(", ")}
              </span>
            </div>
            <button type="button" onClick={saveAndSchedule} className="ui-button ui-button-primary ui-button-lg mt-5 w-full">
              Uložit program a vložit do kalendáře
            </button>
            <button type="button" onClick={generateProgram} className="ui-button ui-button-outline mt-3 w-full">
              Vygenerovat jinou variantu
            </button>
          </section>

          <details className="ui-card mt-4 p-5">
            <summary className="cursor-pointer list-none font-black">
              Zobrazit detail programu <span className="font-normal text-zinc-500">· volitelné</span>
            </summary>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Pro pokročilou kontrolu můžeš rozbalit jednotlivé týdny a ručně změnit konkrétní workout. Pro běžné použití to není potřeba.
            </p>
            <div className="mt-5 space-y-4">
              {weeks.map((week, weekIndex) => (
                <section key={week.weekNumber} className="ui-inset p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-xs font-black uppercase tracking-wide text-accent">Týden {week.weekNumber}</p><h3 className="mt-1 text-lg font-black">{week.focus}</h3></div>
                    <span className="ui-chip">{phaseLabels[week.phase]}</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {week.sessions.map((session, sessionIndex) => {
                      const location = session.trainingLocation ? resolveTrainingLocation(session.trainingLocation, customLocations) : null;
                      const template = session.templateId ? data.templates.find((item) => item.id === session.templateId) : undefined;
                      const equipmentLabels = template ? equipmentRequirementLabelsForTemplate(template) : [];
                      const content = template ? workoutContentSummary(template) : [];
                      return (
                        <div key={session.id} className="rounded-xl border border-white/8 bg-black/15 p-3">
                          <span className="text-xs font-black uppercase tracking-wide text-accent">Jednotka {sessionIndex + 1}</span>
                          <select value={session.templateId ?? ""} onChange={(e) => updateSession(weekIndex, sessionIndex, e.target.value)} className="ui-field mt-2 bg-surface px-3 py-3 text-base">
                            <option value="">Bez kompatibilní jednotky</option>
                            {compatibleTemplates.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.title} · {candidate.durationMinutes} min{candidate.metadata?.workoutCode ? ` · ${candidate.metadata.workoutCode}` : ""}
                              </option>
                            ))}
                          </select>

                          {location ? (
                            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent-soft px-3 py-2">
                              <span className="text-xs font-bold text-zinc-300">Doporučené místo</span>
                              <span className="text-xs font-black text-accent">{location.label}</span>
                            </div>
                          ) : locationFlexible ? (
                            <div className="mt-3 rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-xs text-zinc-500">Místo vybereš později</div>
                          ) : null}

                          {template && (
                            <details className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3">
                              <summary className="cursor-pointer list-none text-sm font-black">Obsah a potřebné vybavení</summary>
                              <p className="mt-2 text-xs leading-5 text-zinc-400">{template.description}</p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {equipmentLabels.length === 0 ? (
                                  <span className="ui-chip">Bez speciálního vybavení</span>
                                ) : equipmentLabels.map((label) => (
                                  <span key={label} className="ui-chip">{label}</span>
                                ))}
                              </div>
                              <div className="mt-3 space-y-2">
                                {content.map((block) => (
                                  <div key={block.id} className="border-t border-white/8 pt-2 first:border-0 first:pt-0">
                                    <p className="text-xs font-bold text-zinc-200">{block.title}</p>
                                    <p className="mt-1 text-xs leading-5 text-zinc-500">{block.detail}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </details>
        </>
      )}

      {ready && data.trainingPrograms.length > 0 && <section className="ui-card mt-8 p-5"><h2 className="text-xl font-black">Uložené programy</h2><div className="mt-4 space-y-3">{data.trainingPrograms.map((program) => <div key={program.id} className="ui-inset flex items-center justify-between gap-3 p-4"><div><p className="font-bold">{program.name}</p><p className="text-sm text-zinc-400">{program.weeks.length} týdnů · {program.weeks.flatMap((week) => week.sessions).length} jednotek</p></div><button type="button" onClick={() => deleteTrainingProgram(program.id)} className="ui-button ui-button-danger ui-button-sm shrink-0">Smazat</button></div>)}</div></section>}
    </PlanningShell>
  );
}
