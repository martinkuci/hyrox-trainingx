"use client";

import Link from "next/link";
import { useHyroxData } from "@/hooks/useHyroxData";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Home() {
  const { data, ready } = useHyroxData();
  const now = new Date();
  const todayKey = localDateKey(now);
  const todayLabel = new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  const todaySchedule = data.scheduledWorkouts
    .filter((item) => item.date === todayKey && item.status !== "skipped")
    .sort((a, b) => a.time.localeCompare(b.time))[0];
  const todayTemplate = todaySchedule
    ? data.templates.find((template) => template.id === todaySchedule.templateId)
    : undefined;
  const quickTemplate = todayTemplate ?? data.templates[0];
  const completedCount = data.results.length;

  return (
    <main className="safe-screen min-h-screen bg-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-md">
        <header className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-lime-400">
            HYROX Training
          </p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight">Dnešní plán</h1>
              <p className="mt-2 capitalize text-zinc-400">{todayLabel}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-center">
              <p className="text-2xl font-black text-lime-400">{completedCount}</p>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">hotovo</p>
            </div>
          </div>
        </header>

        {!ready ? (
          <section className="h-80 animate-pulse rounded-[2rem] border border-zinc-800 bg-zinc-900" />
        ) : quickTemplate ? (
          <section className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 bg-gradient-to-br from-lime-400/15 to-transparent p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-lime-400">
                    {todaySchedule ? `Dnes v ${todaySchedule.time}` : "Rychlý start"}
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">
                    {quickTemplate.title}
                  </h2>
                  <p className="mt-2 text-zinc-400">{quickTemplate.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-semibold text-zinc-200">
                  {quickTemplate.durationMinutes} min
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {quickTemplate.blocks.slice(0, 4).map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between rounded-2xl bg-zinc-800/75 px-4 py-3.5"
                  >
                    <span className="font-semibold">{block.title}</span>
                    <span className="text-sm text-zinc-400">
                      {block.type === "emom"
                        ? `${block.minutes} min EMOM`
                        : block.repeat > 1
                          ? `${block.repeat} kola`
                          : `${block.steps.length} cviky`}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href={`/workout/${quickTemplate.id}${todaySchedule ? `?scheduleId=${todaySchedule.id}` : ""}`}
                className="mt-6 block w-full rounded-2xl bg-lime-400 px-5 py-4 text-center text-lg font-black text-zinc-950 transition active:scale-[0.98]"
              >
                Spustit trénink
              </Link>

              {!todaySchedule && (
                <Link
                  href="/calendar"
                  className="mt-3 block text-center text-sm font-semibold text-zinc-400"
                >
                  Naplánovat na konkrétní den
                </Link>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-dashed border-zinc-700 bg-zinc-900 p-8 text-center">
            <h2 className="text-2xl font-black">Vytvoř první trénink</h2>
            <p className="mt-2 text-zinc-400">
              Přidej cviky, kola nebo EMOM a potom ho naplánuj.
            </p>
            <Link
              href="/workouts/editor"
              className="mt-6 inline-block rounded-2xl bg-lime-400 px-5 py-3 font-black text-zinc-950"
            >
              Nový trénink
            </Link>
          </section>
        )}

        <nav className="mt-6 grid grid-cols-3 gap-3" aria-label="Hlavní navigace">
          <NavCard href="/calendar" icon="📅" label="Kalendář" />
          <NavCard href="/workouts" icon="🏋️" label="Tréninky" />
          <NavCard href="/history" icon="📊" label="Historie" />
        </nav>
      </div>
    </main>
  );
}

function NavCard({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition active:scale-95 active:bg-zinc-800"
    >
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <span className="mt-2 block text-sm font-bold">{label}</span>
    </Link>
  );
}

