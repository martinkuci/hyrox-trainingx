"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StickyBottomNavigation } from "@/components/navigation/StickyBottomNavigation";
import { StickyHeader } from "@/components/navigation/StickyHeader";
import { TrainingLocationSelector } from "@/components/planning/TrainingLocationSelector";
import { useHyroxData } from "@/hooks/useHyroxData";
import {
  equipmentRequirementLabelsForTemplate,
  resolveTrainingLocation,
} from "@/lib/training-context";
import { buildTrainingAdaptation, type TrainingAdaptationRecommendation } from "@/lib/training-adaptation";
import type { ProgramPhase, ScheduledWorkout, ScheduledWorkoutStatus, WorkoutTemplate } from "@/lib/types";

const phaseLabels: Record<ProgramPhase, string> = {
  base: "Budování základu",
  build: "Rozvoj výkonu",
  deload: "Odlehčení",
  specific: "Závodní příprava",
  taper: "Taper",
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  result.setHours(12, 0, 0, 0);
  return result;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function statusPriority(status: ScheduledWorkoutStatus) {
  if (status === "completed") return 3;
  if (status === "planned") return 2;
  return 1;
}

export default function Home() {
  const { data, ready, decideTrainingAdaptation } = useHyroxData();
  const [adaptationNotice, setAdaptationNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const now = new Date();
  const todayKey = localDateKey(now);
  const todayLabel = new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  const todaySchedule = data.scheduledWorkouts
    .filter((item) => item.date === todayKey && item.status !== "skipped")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "planned" ? -1 : 1;
      return a.time.localeCompare(b.time);
    })[0];
  const todayTemplate = todaySchedule
    ? data.templates.find((template) => template.id === todaySchedule.templateId)
    : undefined;

  const upcomingSchedule = data.scheduledWorkouts
    .filter((item) => item.status === "planned" && item.date > todayKey)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
  const upcomingTemplate = upcomingSchedule
    ? data.templates.find((template) => template.id === upcomingSchedule.templateId)
    : undefined;
  const customLocations = data.trainingLocations ?? [];
  const todayLocation = todaySchedule?.trainingLocation
    ? resolveTrainingLocation(todaySchedule.trainingLocation, customLocations)
    : null;
  const upcomingLocation = upcomingSchedule?.trainingLocation
    ? resolveTrainingLocation(upcomingSchedule.trainingLocation, customLocations)
    : null;
  const todayEquipment = todayTemplate ? equipmentRequirementLabelsForTemplate(todayTemplate) : [];
  const upcomingEquipment = upcomingTemplate ? equipmentRequirementLabelsForTemplate(upcomingTemplate) : [];

  const weekStart = startOfWeek(now);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = localDateKey(date);
    const schedules = data.scheduledWorkouts.filter((item) => item.date === key);
    const status = schedules.sort((a, b) => statusPriority(b.status) - statusPriority(a.status))[0]?.status;
    return { date, key, status, isToday: key === todayKey };
  });
  const weekSchedules = data.scheduledWorkouts.filter((item) =>
    weekDays.some((day) => day.key === item.date),
  );
  const weekCompleted = weekSchedules.filter((item) => item.status === "completed").length;
  const weekSkipped = weekSchedules.filter((item) => item.status === "skipped").length;
  const weekPlanned = weekSchedules.filter((item) => item.status === "planned").length;
  const weekTarget = weekSchedules.length;
  const completionRate = weekTarget === 0 ? 0 : Math.round((weekCompleted / weekTarget) * 100);

  const activeProgramSchedule = data.scheduledWorkouts
    .filter((item) => item.programId && item.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const activeProgram = activeProgramSchedule
    ? data.trainingPrograms.find((program) => program.id === activeProgramSchedule.programId)
    : undefined;
  const activeWeek = activeProgramSchedule?.programWeek
    ? activeProgram?.weeks.find((week) => week.weekNumber === activeProgramSchedule.programWeek)
    : undefined;
  const activeProgramItems = activeProgram
    ? data.scheduledWorkouts.filter((item) => item.programId === activeProgram.id)
    : [];
  const activeProgramCompleted = activeProgramItems.filter((item) => item.status === "completed").length;
  const activeProgramTotal = activeProgramItems.length;
  const activeProgramRate = activeProgramTotal === 0
    ? 0
    : Math.round((activeProgramCompleted / activeProgramTotal) * 100);

  const latestResult = [...data.results].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  const latestTemplate = latestResult
    ? data.templates.find((template) => template.id === latestResult.templateId)
    : undefined;
  const adaptation = useMemo(() => ready ? buildTrainingAdaptation({
    results: data.results,
    templates: data.templates,
    scheduledWorkouts: data.scheduledWorkouts,
  }) : null, [data.results, data.scheduledWorkouts, data.templates, ready]);
  const adaptationSchedule = adaptation?.targetScheduleId
    ? data.scheduledWorkouts.find((schedule) => schedule.id === adaptation.targetScheduleId)
    : undefined;
  const adaptationCurrent = adaptation?.currentTemplateId
    ? data.templates.find((template) => template.id === adaptation.currentTemplateId)
    : undefined;
  const adaptationRecommended = adaptation?.recommendedTemplateId
    ? data.templates.find((template) => template.id === adaptation.recommendedTemplateId)
    : undefined;

  function saveAdaptationDecision(status: "accepted" | "dismissed") {
    if (!adaptation || adaptation.direction === "maintain" || !adaptationSchedule || !adaptationCurrent || !adaptationRecommended) return;
    const currentSchedule = data.scheduledWorkouts.find((schedule) => schedule.id === adaptationSchedule.id);
    if (!currentSchedule || currentSchedule.status !== "planned" || currentSchedule.templateId !== adaptationCurrent.id) {
      setAdaptationNotice({ tone: "danger", text: "Plán se mezitím změnil. Doporučení znovu přepočítáme podle aktuálních dat." });
      return;
    }
    const applied = decideTrainingAdaptation(adaptation.resultId, {
      status,
      direction: adaptation.direction,
      scheduleId: currentSchedule.id,
      originalTemplateId: adaptationCurrent.id,
      recommendedTemplateId: adaptationRecommended.id,
      decidedAt: new Date().toISOString(),
    });
    if (!applied) {
      setAdaptationNotice({ tone: "danger", text: "Plán se mezitím změnil. Doporučení znovu přepočítáme podle aktuálních dat." });
      return;
    }
    setAdaptationNotice({
      tone: "success",
      text: status === "accepted"
        ? `Plán je upravený: ${adaptationRecommended.title}. Datum ani pořadí programu se nezměnilo.`
        : "Původní plán zůstává beze změny.",
    });
  }

  return (
    <>
      <StickyHeader title="Dnes" fallbackHref="/" />

      <main className="app-shell app-content-safe min-h-screen px-4 text-white sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <header className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Dnes</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Tvůj trénink</h1>
              <p className="mt-1 capitalize text-zinc-400">{todayLabel}</p>
            </div>
            {activeWeek && (
              <div className="ui-inset px-3 py-2 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Fáze</p>
                <p className="mt-0.5 text-xs font-black text-zinc-200">{phaseLabels[activeWeek.phase]}</p>
              </div>
            )}
          </header>

          <section className="mt-6" aria-labelledby="week-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="week-heading" className="text-sm font-black">Tento týden</h2>
              <Link href="/calendar/program" className="ui-button ui-button-ghost ui-button-sm -mr-3 text-xs">
                Otevřít kalendář
              </Link>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day) => (
                <WeekDay
                  key={day.key}
                  date={day.date}
                  status={day.status}
                  isToday={day.isToday}
                />
              ))}
            </div>
          </section>

          {!ready ? (
            <section className="ui-card mt-6 h-80 animate-pulse" aria-label="Načítám dnešní trénink" />
          ) : todayTemplate && todaySchedule ? (
            <section className="workout-hero ui-card ui-card-accent mt-6 overflow-hidden p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Dnešní jednotka · {todaySchedule.time}</p>
                {todaySchedule.status === "completed" && (
                  <span className="ui-chip ui-chip-success">Dokončeno</span>
                )}
              </div>
              <h2 className="mt-4 max-w-lg text-3xl font-black leading-[1.02] tracking-tight sm:text-4xl">{todayTemplate.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
                {todayTemplate.metadata?.goal || todayTemplate.description}
              </p>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <HeroMetric label="Délka" value={`${todayTemplate.durationMinutes} min`} />
                <HeroMetric
                  label="Intenzita"
                  value={todayTemplate.metadata ? `RPE ${todayTemplate.metadata.targetRpeMin}–${todayTemplate.metadata.targetRpeMax}` : "Dle pocitu"}
                />
                <HeroMetric
                  label="Bloky"
                  value={String(todayTemplate.blocks.length)}
                />
              </div>

              <div className="ui-inset mt-4 bg-black/20 p-4 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Doporučené místo</p>
                    <p className="mt-1 font-black text-zinc-100">{todayLocation?.label ?? "Místo neurčeno"}</p>
                  </div>
                  <span className="ui-chip ui-chip-accent shrink-0">{todayEquipment.length} požadavků</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {todayEquipment.length === 0 ? (
                    <span className="ui-chip">Bez speciálního vybavení</span>
                  ) : todayEquipment.map((label) => (
                    <span key={label} className="ui-chip">{label}</span>
                  ))}
                </div>
                {todaySchedule.status === "planned" && (
                  <div className="mt-4 border-t border-white/8 pt-4">
                    <TrainingLocationSelector
                      schedule={todaySchedule}
                      template={todayTemplate}
                      phase={activeWeek?.phase}
                      returnTo="/"
                      label="Dnešní místo"
                    />
                  </div>
                )}
              </div>

              <Link
                href={`/workout/${todayTemplate.id}?scheduleId=${todaySchedule.id}`}
                className="ui-button ui-button-primary ui-button-lg mt-6 w-full"
              >
                <PlayIcon />
                {todaySchedule.status === "completed" ? "Spustit znovu" : "Spustit trénink"}
              </Link>
              {todaySchedule.status === "planned" && (
                <Link
                  href={`/calendar/program?scheduleId=${todaySchedule.id}`}
                  className="ui-button ui-button-outline mt-3 w-full"
                >
                  Detail / další úpravy tréninku
                </Link>
              )}
              {todayTemplate.metadata?.runningTarget && (
                <p className="mt-4 text-center text-xs font-semibold text-zinc-400">
                  Cíl běhu: <span className="text-zinc-200">{todayTemplate.metadata.runningTarget}</span>
                </p>
              )}
            </section>
          ) : (
            <section className="ui-card mt-6 p-6 sm:p-7">
              <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent" aria-hidden="true">
                <RecoveryIcon />
              </div>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-accent">Dnes bez jednotky</p>
              <h2 className="mt-2 text-2xl font-black">Prostor pro regeneraci</h2>
              {upcomingTemplate && upcomingSchedule ? (
                <>
                  <p className="mt-2 leading-6 text-zinc-400">
                    Další trénink tě čeká {new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" }).format(parseDate(upcomingSchedule.date))} v {upcomingSchedule.time}.
                  </p>
                  <div className="ui-inset mt-5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-black">{upcomingTemplate.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{upcomingTemplate.durationMinutes} min · {upcomingLocation?.label ?? "místo neurčeno"}</p>
                      </div>
                      <span className="shrink-0 text-accent" aria-hidden="true">→</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {upcomingEquipment.length === 0 ? (
                        <span className="ui-chip">Bez speciálního vybavení</span>
                      ) : upcomingEquipment.map((label) => (
                        <span key={label} className="ui-chip">{label}</span>
                      ))}
                    </div>
                  </div>
                  <Link href={`/calendar/program?scheduleId=${upcomingSchedule.id}`} className="ui-button ui-button-primary mt-5 w-full">
                    Detail / změnit místo
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-2 leading-6 text-zinc-400">V kalendáři zatím nemáš další trénink.</p>
                  <Link href="/programs" className="ui-button ui-button-primary mt-5 w-full">
                    Vytvořit program
                  </Link>
                </>
              )}
            </section>
          )}

          {ready && (
            <section className="mt-5 grid gap-4 sm:grid-cols-2">
              <article className="ui-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Plnění týdne</p>
                    <p className="mt-2 text-3xl font-black">{weekCompleted}<span className="text-lg text-zinc-500"> / {weekTarget}</span></p>
                  </div>
                  <div className="grid size-12 place-items-center rounded-full border-4 border-accent/25 text-xs font-black text-accent">{completionRate}%</div>
                </div>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${completionRate}%` }} />
                </div>
                <div className="mt-4 flex gap-4 text-xs text-zinc-500">
                  <span><strong className="text-zinc-200">{weekPlanned}</strong> čeká</span>
                  <span><strong className="text-zinc-200">{weekSkipped}</strong> vynecháno</span>
                </div>
              </article>

              <AdaptiveRecommendationCard
                recommendation={adaptation}
                schedule={adaptationSchedule}
                currentTemplate={adaptationCurrent}
                recommendedTemplate={adaptationRecommended}
                hasResults={Boolean(latestResult)}
                onAccept={() => saveAdaptationDecision("accepted")}
                onDismiss={() => saveAdaptationDecision("dismissed")}
              />
            </section>
          )}

          {adaptationNotice && (
            <p role="status" className={`ui-feedback ui-feedback-${adaptationNotice.tone} mt-4 text-sm font-bold`}>
              {adaptationNotice.text}
            </p>
          )}

          {ready && activeProgram && (
            <section className="ui-card mt-5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Aktivní program</p>
                  <h2 className="mt-2 truncate text-xl font-black">{activeProgram.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {activeWeek ? `Týden ${activeWeek.weekNumber} · ${phaseLabels[activeWeek.phase]}` : "Probíhající příprava"}
                  </p>
                </div>
                <span className="shrink-0 rounded-xl bg-elevated px-3 py-2 text-sm font-black text-accent">{activeProgramRate}%</span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-elevated">
                <div className="h-full rounded-full bg-accent" style={{ width: `${activeProgramRate}%` }} />
              </div>
              <Link href="/calendar/program" className="ui-button ui-button-ghost ui-button-sm -ml-3 mt-3 text-sm">
                Otevřít celý program <span className="ml-2 text-accent" aria-hidden="true">→</span>
              </Link>
            </section>
          )}

          {ready && latestResult && (
            <section className="ui-card mt-5 flex items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Poslední výkon</p>
                <h2 className="mt-2 truncate font-black">{latestTemplate?.title || latestResult.workoutTitle}</h2>
                <p className="mt-1 text-xs text-zinc-500">RPE {latestResult.rpe}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-2xl font-black text-accent">{formatDuration(latestResult.durationSeconds)}</p>
                <Link href="/history" className="ui-button ui-button-ghost ui-button-sm -mr-3 mt-1 text-xs">Detail výsledku</Link>
              </div>
            </section>
          )}
        </div>
      </main>

      <StickyBottomNavigation />
    </>
  );
}

function AdaptiveRecommendationCard({
  recommendation,
  schedule,
  currentTemplate,
  recommendedTemplate,
  hasResults,
  onAccept,
  onDismiss,
}: {
  recommendation: TrainingAdaptationRecommendation | null;
  schedule?: ScheduledWorkout;
  currentTemplate?: WorkoutTemplate;
  recommendedTemplate?: WorkoutTemplate;
  hasResults: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const actionable = Boolean(
    recommendation &&
    recommendation.direction !== "maintain" &&
    schedule &&
    currentTemplate &&
    recommendedTemplate,
  );

  return (
    <article className="ui-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Doporučení 3C</p>
        {actionable && <span className="ui-chip ui-chip-accent">Čeká na potvrzení</span>}
      </div>
      <h2 className="mt-3 text-lg font-black text-zinc-100">
        {recommendation?.title ?? (hasResults ? "Plán je vyhodnocený" : "Nejdřív dokonči trénink")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-300">
        {recommendation?.rationale ?? (hasResults
          ? "Poslední doporučení už bylo vyřešeno. Další vznikne po novém výsledku."
          : "Po prvním výsledku aplikace porovná RPE s cílem a připraví bezpečný návrh.")}
      </p>

      {actionable && schedule && currentTemplate && recommendedTemplate && (
        <>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
            <AdaptationTemplate template={currentTemplate} label="Původně" />
            <span className="self-center text-accent" aria-hidden="true">→</span>
            <AdaptationTemplate template={recommendedTemplate} label="Návrh" accent />
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Týká se {new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" }).format(parseDate(schedule.date))}. Datum, čas a pořadí programu zůstanou stejné.
          </p>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={onAccept} className="ui-button ui-button-primary w-full">Použít navržený trénink</button>
            <button type="button" onClick={onDismiss} className="ui-button ui-button-outline w-full">Ponechat původní plán</button>
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-600">Bez potvrzení se plán nikdy nezmění.</p>
        </>
      )}
    </article>
  );
}

function AdaptationTemplate({ template, label, accent = false }: { template: WorkoutTemplate; label: string; accent?: boolean }) {
  return (
    <div className={`min-w-0 rounded-2xl border p-3 ${accent ? "border-accent/35 bg-accent-soft" : "border-white/8 bg-elevated"}`}>
      <p className={`text-[9px] font-black uppercase tracking-wide ${accent ? "text-accent" : "text-zinc-500"}`}>{label}</p>
      <p className="mt-1 line-clamp-2 text-xs font-black leading-4 text-zinc-100">{template.title}</p>
      <p className="mt-1 text-[10px] text-zinc-500">Level {template.metadata?.difficultyLevel ?? 1} · {template.durationMinutes} min</p>
    </div>
  );
}

function WeekDay({ date, status, isToday }: { date: Date; status?: ScheduledWorkoutStatus; isToday: boolean }) {
  const statusLabel = status === "completed"
    ? "dokončeno"
    : status === "planned"
      ? "naplánováno"
      : status === "skipped"
        ? "vynecháno"
        : "volno";
  const marker = status === "completed" ? "✓" : status === "planned" ? "•" : status === "skipped" ? "–" : "";

  return (
    <Link
      href="/calendar/program"
      aria-current={isToday ? "date" : undefined}
      aria-label={`${new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "long" }).format(date)}, ${statusLabel}`}
      className={`flex min-w-0 flex-col items-center rounded-2xl border px-1 py-2.5 transition active:scale-95 ${
        isToday
          ? "border-accent/50 bg-accent-soft text-accent"
          : "border-white/8 bg-surface text-zinc-300"
      }`}
    >
      <span className={`text-[9px] font-black uppercase ${isToday ? "text-accent" : "text-zinc-500"}`}>
        {new Intl.DateTimeFormat("cs-CZ", { weekday: "short" }).format(date).replace(".", "")}
      </span>
      <span className="mt-1 text-sm font-black">{date.getDate()}</span>
      <span className={`mt-1 grid h-3 place-items-center text-[10px] font-black ${
        isToday ? "text-accent" : status === "completed" ? "text-emerald-300" : status === "planned" ? "text-accent" : "text-zinc-600"
      }`} aria-hidden="true">
        {marker}
      </span>
    </Link>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-inset min-w-0 bg-black/20 px-2 py-3 text-center backdrop-blur-sm">
      <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-zinc-100">{value}</p>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M8 5.75a1 1 0 0 1 1.53-.85l9 6.25a1 1 0 0 1 0 1.7l-9 6.25A1 1 0 0 1 8 18.25V5.75Z" />
    </svg>
  );
}

function RecoveryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 5.5C14.2 5.5 9.5 9.2 9.5 15c0 1 .14 1.93.42 2.78" />
      <path d="M4 19c3.1-4.5 7.3-7.3 12.5-8.5" />
      <path d="M20 5.5c0 8-3.7 13.5-9.5 13.5-3.3 0-5.5-2.2-5.5-5.5C5 8.8 9.5 5.5 20 5.5Z" />
    </svg>
  );
}
