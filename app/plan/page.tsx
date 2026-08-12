"use client";

import Link from "next/link";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";

export default function PlanPage() {
  const { data, ready } = useHyroxData();
  const planned = data.scheduledWorkouts.filter((item) => item.status === "planned").length;
  const programs = data.trainingPrograms.length;
  const next = [...data.scheduledWorkouts]
    .filter((item) => item.status === "planned")
    .sort((a, b) => (a.date + "T" + a.time).localeCompare(b.date + "T" + b.time))[0];
  const nextTemplate = next
    ? data.templates.find((item) => item.id === next.templateId)
    : undefined;

  return (
    <PlanningShell
      eyebrow="Plán"
      title="Tvoje příprava"
      description="Vytvoř program, uprav jeho průběh a měj další jednotku vždy pod kontrolou."
      backHref="/"
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/programs"
          className="workout-hero ui-card ui-card-accent group overflow-hidden p-6 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent"><ProgramIcon /></div><span className="text-accent" aria-hidden="true">→</span></div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-accent">Program</p>
          <h2 className="mt-2 text-2xl font-black">Vytvořit nový plán</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Vyber cíl, délku, frekvenci a dostupné dny. Aplikace sestaví program automaticky.
          </p>
          <div className="ui-inset mt-5 bg-black/20 p-4">
            <p className="text-2xl font-black text-accent">{programs}</p>
            <p className="text-xs uppercase tracking-wide text-zinc-500">uložených programů</p>
          </div>
        </Link>

        <Link
          href="/calendar/program"
          className="ui-card group p-6 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-2xl bg-zinc-800 text-zinc-200"><CalendarIcon /></div><span className="text-zinc-500" aria-hidden="true">→</span></div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-accent">Kalendář</p>
          <h2 className="mt-2 text-2xl font-black">Upravit naplánované tréninky</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Zobraz program po dnech a přesuň jednu jednotku nebo celý zbytek programu.
          </p>
          <div className="ui-inset mt-5 p-4">
            <p className="text-2xl font-black text-accent">{planned}</p>
            <p className="text-xs uppercase tracking-wide text-zinc-500">čeká v kalendáři</p>
          </div>
        </Link>
      </section>

      {ready && next && (
        <section className="ui-card mt-6 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">
            Nejbližší trénink
          </p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">
                {nextTemplate?.title ?? "Naplánovaný trénink"}
              </h2>
              <p className="mt-2 text-zinc-400">
                {new Intl.DateTimeFormat("cs-CZ", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date(next.date + "T12:00:00"))}
                {" · "}
                {next.time}
              </p>
            </div>
            {next.programWeek && (
              <span className="ui-chip">
                Týden {next.programWeek}
              </span>
            )}
          </div>
          {nextTemplate && <Link href={`/workout/${nextTemplate.id}?scheduleId=${next.id}`} className="ui-button ui-button-primary mt-5 w-full">Spustit nejbližší trénink</Link>}
        </section>
      )}
    </PlanningShell>
  );
}

function ProgramIcon() {
  return <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 4.5h12a2 2 0 0 1 2 2v13H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" /><path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" /></svg>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 9h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" strokeLinecap="round" /></svg>;
}
