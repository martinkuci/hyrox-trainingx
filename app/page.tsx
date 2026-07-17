"use client";

import Link from "next/link";
import { useHyroxData } from "@/hooks/useHyroxData";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
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

  const upcomingSchedule = data.scheduledWorkouts
    .filter((item) => item.status === "planned" && item.date >= todayKey)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
  const upcomingTemplate = upcomingSchedule
    ? data.templates.find((template) => template.id === upcomingSchedule.templateId)
    : undefined;

  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekSchedules = data.scheduledWorkouts.filter((item) => {
    const date = new Date(`${item.date}T12:00:00`);
    return date >= weekStart && date < weekEnd;
  });
  const weekCompleted = weekSchedules.filter((item) => item.status === "completed").length;
  const weekSkipped = weekSchedules.filter((item) => item.status === "skipped").length;
  const weekPlanned = weekSchedules.filter((item) => item.status === "planned").length;
  const weekTarget = weekSchedules.length;
  const completionRate = weekTarget === 0 ? 0 : Math.round((weekCompleted / weekTarget) * 100);
  const weekMinutes = weekSchedules.reduce((sum, item) => {
    const template = data.templates.find((entry) => entry.id === item.templateId);
    return sum + (template?.durationMinutes ?? 0);
  }, 0);

  const activeProgramSchedule = data.scheduledWorkouts
    .filter((item) => item.programId && item.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const activeProgram = activeProgramSchedule
    ? data.trainingPrograms.find((program) => program.id === activeProgramSchedule.programId)
    : undefined;
  const activeProgramItems = activeProgram
    ? data.scheduledWorkouts.filter((item) => item.programId === activeProgram.id)
    : [];
  const activeProgramCompleted = activeProgramItems.filter((item) => item.status === "completed").length;
  const activeProgramTotal = activeProgramItems.length;
  const activeProgramRate = activeProgramTotal === 0 ? 0 : Math.round((activeProgramCompleted / activeProgramTotal) * 100);

  const latestResult = [...data.results].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  const latestTemplate = latestResult
    ? data.templates.find((template) => template.id === latestResult.templateId)
    : undefined;

  const recommendation = latestResult
    ? latestResult.rpe <= 6
      ? "Poslední trénink byl zvládnutý s rezervou. Příště můžeš držet o něco vyšší tempo nebo přejít na náročnější variantu."
      : latestResult.rpe >= 9
        ? "Poslední trénink byl velmi náročný. Dej důraz na regeneraci a další těžkou jednotku neposouvej dříve."
        : "Intenzita posledního tréninku odpovídala cílovému pásmu. Pokračuj v podobném tempu a sleduj stabilitu jednotlivých kol."
    : "Po prvním dokončeném tréninku se zde objeví doporučení podle RPE a výsledku.";

  return (
    <main className="safe-screen min-h-screen bg-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-md">
        <header className="mb-7">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-lime-400">HYROX Training</p>
            <Link href="/account" className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300">☁ Cloud</Link>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight">Dnešní přehled</h1>
          <p className="mt-2 capitalize text-zinc-400">{todayLabel}</p>
        </header>

        {!ready ? (
          <section className="h-80 animate-pulse rounded-[2rem] border border-zinc-800 bg-zinc-900" />
        ) : todayTemplate && todaySchedule ? (
          <section className="overflow-hidden rounded-[2rem] border border-lime-400/30 bg-zinc-900">
            <div className="bg-gradient-to-br from-lime-400/20 to-transparent p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Dnes v {todaySchedule.time}</p>
              <div className="mt-2 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black">{todayTemplate.title}</h2>
                  <p className="mt-2 text-zinc-400">{todayTemplate.metadata?.goal || todayTemplate.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-bold">{todayTemplate.durationMinutes} min</span>
              </div>
              {todayTemplate.metadata && (
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Cílové RPE" value={`${todayTemplate.metadata.targetRpeMin}–${todayTemplate.metadata.targetRpeMax}`} />
                  <Metric label="Očekávaný čas" value={`${todayTemplate.metadata.expectedDurationMin}–${todayTemplate.metadata.expectedDurationMax} min`} />
                  {todayTemplate.metadata.runningTarget && <div className="col-span-2"><Metric label="Doporučené tempo" value={todayTemplate.metadata.runningTarget} /></div>}
                </div>
              )}
              <Link href={`/workout/${todayTemplate.id}?scheduleId=${todaySchedule.id}`} className="mt-6 block rounded-2xl bg-lime-400 px-5 py-4 text-center text-lg font-black text-zinc-950">Spustit dnešní trénink</Link>
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Dnes</p>
            <h2 className="mt-2 text-2xl font-black">Regenerační den</h2>
            {upcomingTemplate && upcomingSchedule ? (
              <>
                <p className="mt-2 text-zinc-400">Další trénink je {new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" }).format(new Date(`${upcomingSchedule.date}T12:00:00`))} v {upcomingSchedule.time}.</p>
                <div className="mt-5 rounded-2xl bg-zinc-800 p-4"><p className="font-black">{upcomingTemplate.title}</p><p className="mt-1 text-sm text-zinc-400">{upcomingTemplate.durationMinutes} min</p></div>
                <Link href="/plan" className="mt-4 block text-center text-sm font-bold text-lime-300">Otevřít plán</Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-zinc-400">Nemáš naplánovaný další trénink.</p>
                <Link href="/plan" className="mt-5 block rounded-2xl bg-lime-400 px-5 py-4 text-center font-black text-zinc-950">Vytvořit tréninkový program</Link>
                <Link href="/workouts" className="mt-3 block text-center text-sm font-bold text-zinc-400">Nebo vybrat z knihovny</Link>
              </>
            )}
          </section>
        )}

        {ready && activeProgram && (
          <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Aktivní program</p><h2 className="mt-2 text-xl font-black">{activeProgram.name}</h2></div>
              <div className="rounded-2xl bg-zinc-800 px-4 py-3 text-center"><p className="text-xl font-black text-lime-400">{activeProgramRate}%</p><p className="text-[9px] uppercase text-zinc-500">hotovo</p></div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-lime-400" style={{ width: `${activeProgramRate}%` }} /></div>
            <p className="mt-3 text-sm text-zinc-400">{activeProgramCompleted} z {activeProgramTotal} jednotek dokončeno</p>
            <Link href="/plan" className="mt-4 block text-sm font-bold text-lime-300">Zobrazit program →</Link>
          </section>
        )}

        {ready && (
          <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Tento týden</p><h2 className="mt-2 text-2xl font-black">{weekCompleted} z {weekTarget} splněno</h2></div><div className="rounded-2xl bg-zinc-800 px-4 py-3 text-center"><p className="text-2xl font-black text-lime-400">{completionRate}%</p><p className="text-[10px] uppercase tracking-wide text-zinc-500">plánu</p></div></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-lime-400" style={{ width: `${completionRate}%` }} /></div>
            <div className="mt-5 grid grid-cols-4 gap-2 text-center"><Stat value={weekPlanned} label="zbývá" /><Stat value={weekCompleted} label="hotovo" /><Stat value={weekSkipped} label="vynecháno" /><Stat value={weekMinutes} label="min plán" /></div>
          </section>
        )}

        <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Doporučení</p>
          <p className="mt-3 leading-6 text-zinc-300">{recommendation}</p>
        </section>

        {latestResult && (
          <section className="mt-5 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Poslední výsledek</p>
            <div className="mt-3 flex items-end justify-between gap-4"><div><h2 className="text-xl font-black">{latestTemplate?.title || latestResult.workoutTitle}</h2><p className="mt-1 text-sm text-zinc-400">RPE {latestResult.rpe}</p></div><p className="text-3xl font-black text-lime-400">{formatDuration(latestResult.durationSeconds)}</p></div>
            <Link href="/history" className="mt-4 block text-sm font-bold text-lime-300">Otevřít výsledky →</Link>
          </section>
        )}

        <nav className="mt-6 grid grid-cols-3 gap-3" aria-label="Hlavní navigace">
          <NavCard href="/plan" icon="🗓️" label="Plán" />
          <NavCard href="/workouts" icon="🏋️" label="Tréninky" />
          <NavCard href="/history" icon="📊" label="Výsledky" />
        </nav>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-zinc-800/80 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 font-black text-zinc-100">{value}</p></div>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="rounded-xl bg-zinc-800 px-2 py-3"><p className="text-lg font-black">{value}</p><p className="mt-1 text-[9px] uppercase tracking-wide text-zinc-500">{label}</p></div>;
}

function NavCard({ href, icon, label }: { href: string; icon: string; label: string }) {
  return <Link href={href} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-center transition active:scale-95 active:bg-zinc-800"><span className="text-xl" aria-hidden="true">{icon}</span><span className="mt-2 block text-xs font-bold">{label}</span></Link>;
}
