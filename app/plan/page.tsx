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
      title="Tréninkový plán"
      description="Program a kalendář jsou na jednom místě."
      backHref="/"
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/programs"
          className="rounded-3xl border border-lime-400/20 bg-zinc-900 p-6 transition active:scale-[0.99]"
        >
          <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Program</p>
          <h2 className="mt-2 text-2xl font-black">Vytvořit nový plán</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Vyber cíl, délku, frekvenci a dostupné dny. Aplikace sestaví program automaticky.
          </p>
          <div className="mt-5 rounded-2xl bg-zinc-800 p-4">
            <p className="text-2xl font-black text-lime-400">{programs}</p>
            <p className="text-xs uppercase tracking-wide text-zinc-500">uložených programů</p>
          </div>
        </Link>

        <Link
          href="/calendar/program"
          className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition active:scale-[0.99]"
        >
          <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Kalendář</p>
          <h2 className="mt-2 text-2xl font-black">Upravit naplánované tréninky</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Zobraz program po dnech a přesuň jednu jednotku nebo celý zbytek programu.
          </p>
          <div className="mt-5 rounded-2xl bg-zinc-800 p-4">
            <p className="text-2xl font-black text-lime-400">{planned}</p>
            <p className="text-xs uppercase tracking-wide text-zinc-500">čeká v kalendáři</p>
          </div>
        </Link>
      </section>

      {ready && next && (
        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">
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
              <span className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-black text-zinc-300">
                Týden {next.programWeek}
              </span>
            )}
          </div>
        </section>
      )}
    </PlanningShell>
  );
}
