"use client";

import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { StatusBadge } from "@/components/planning/StatusBadge";
import { useHyroxData } from "@/hooks/useHyroxData";
import {
  calendarDateKey,
  findShorterWorkoutVariants,
  orderProgramSchedules,
  parseCalendarDate,
  planScheduledWorkoutMove,
  planScheduledWorkoutRestore,
  type ScheduleCollisionPolicy,
  type ScheduleMoveFailure,
  type ScheduleMoveScope,
} from "@/lib/calendar-planning";
import type { ScheduledWorkout } from "@/lib/types";

const weekdayLabels = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

type Feedback = {
  tone: "success" | "warning" | "danger";
  text: string;
};

type PendingCollision = {
  scope: ScheduleMoveScope;
  suggestedDate?: string;
  collisionDates: string[];
};

function monthCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1, 12);
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, index) =>
      new Date(year, monthIndex, index + 1, 12),
    ),
  ];
}

function formatDate(value: string, withYear = false) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(parseCalendarDate(value));
}

function failureMessage(reason: ScheduleMoveFailure) {
  switch (reason) {
    case "same-date":
      return "Vyber jiné datum než současný termín.";
    case "not-planned":
      return "Přesouvat lze pouze naplánovaný trénink.";
    case "out-of-order":
      return "Tento přesun by změnil pořadí programu. Posuň i navazující jednotky.";
    case "no-free-date":
      return "V tomto směru se nepodařilo najít volný termín bez narušení programu.";
    case "missing":
      return "Vybraný trénink už v kalendáři není.";
    default:
      return "Cílový den je obsazený jiným tréninkem.";
  }
}

export default function LiveProgramCalendarPage() {
  const { data, ready, updateScheduledWorkout, updateScheduledWorkouts } = useHyroxData();
  const [month, setMonth] = useState(() => new Date());
  const [programId, setProgramId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingCollision, setPendingCollision] = useState<PendingCollision | null>(null);
  const [pendingSkip, setPendingSkip] = useState<ScheduledWorkout | null>(null);

  const schedulesWithProgram = useMemo(
    () => data.scheduledWorkouts.filter((item) => item.programId),
    [data.scheduledWorkouts],
  );
  const effectiveProgramId = programId || schedulesWithProgram[0]?.programId || data.trainingPrograms[0]?.id || "";
  const activeProgram = data.trainingPrograms.find((item) => item.id === effectiveProgramId);
  const programSchedules = useMemo(
    () => orderProgramSchedules(
      data.scheduledWorkouts.filter((item) => item.programId === effectiveProgramId),
      activeProgram,
    ),
    [activeProgram, data.scheduledWorkouts, effectiveProgramId],
  );
  const schedulesByDate = useMemo(
    () => [...programSchedules].sort((left, right) =>
      `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`),
    ),
    [programSchedules],
  );
  const selected = programSchedules.find((item) => item.id === selectedId);
  const selectedTemplate = selected
    ? data.templates.find((item) => item.id === selected.templateId)
    : undefined;
  const originalTemplate = selected?.originalTemplateId
    ? data.templates.find((item) => item.id === selected.originalTemplateId)
    : undefined;
  const shorterVariants = useMemo(
    () => selectedTemplate && !originalTemplate
      ? findShorterWorkoutVariants(selectedTemplate, data.templates)
      : [],
    [data.templates, originalTemplate, selectedTemplate],
  );

  const cells = monthCells(month);
  const firstDate = schedulesByDate[0]?.date;
  const lastDate = schedulesByDate[schedulesByDate.length - 1]?.date;
  const completed = programSchedules.filter((item) => item.status === "completed").length;
  const planned = programSchedules.filter((item) => item.status === "planned").length;
  const skipped = programSchedules.filter((item) => item.status === "skipped").length;

  function schedulesForDate(key: string) {
    return schedulesByDate.filter((item) => item.date === key);
  }

  function openSchedule(schedule: ScheduledWorkout) {
    setSelectedId(schedule.id);
    setTargetDate(schedule.date);
    setPendingCollision(null);
    setFeedback(null);
  }

  function changeProgram(nextProgramId: string) {
    setProgramId(nextProgramId);
    setSelectedId("");
    setPendingCollision(null);
    setFeedback(null);
    const firstSchedule = data.scheduledWorkouts
      .filter((item) => item.programId === nextProgramId)
      .sort((left, right) => left.date.localeCompare(right.date))[0];
    if (firstSchedule) setMonth(parseCalendarDate(firstSchedule.date));
  }

  function applyMove(
    scope: ScheduleMoveScope,
    collisionPolicy: ScheduleCollisionPolicy = "reject",
  ) {
    if (!selected || !targetDate) return;
    const plan = planScheduledWorkoutMove({
      selectedId: selected.id,
      targetDate,
      scope,
      programSchedules,
      allSchedules: data.scheduledWorkouts,
      collisionPolicy,
    });

    if (!plan.ok) {
      setFeedback({
        tone: plan.reason === "collision" ? "warning" : "danger",
        text: failureMessage(plan.reason),
      });
      setPendingCollision(plan.reason === "collision"
        ? {
            scope,
            suggestedDate: plan.suggestedDate,
            collisionDates: plan.collisionDates,
          }
        : null);
      return;
    }

    updateScheduledWorkouts(plan.updates);
    setTargetDate(plan.resolvedDate);
    setMonth(parseCalendarDate(plan.resolvedDate));
    setPendingCollision(null);
    setFeedback({
      tone: "success",
      text: plan.movedCount === 1
        ? `Trénink byl přesunut na ${formatDate(plan.resolvedDate, true)}.`
        : `${plan.movedCount} jednotek bylo přesunuto. Pořadí a rozestupy zůstaly zachované.`,
    });
  }

  function skipSelected() {
    if (!pendingSkip) return;
    updateScheduledWorkout(pendingSkip.id, { status: "skipped" });
    setPendingSkip(null);
    setPendingCollision(null);
    setFeedback({
      tone: "success",
      text: "Trénink je označený jako vynechaný a zůstává v přehledu programu.",
    });
  }

  function restoreSelected() {
    if (!selected) return;
    const plan = planScheduledWorkoutRestore({
      selectedId: selected.id,
      targetDate,
      programSchedules,
      allSchedules: data.scheduledWorkouts,
    });
    if (!plan.ok) {
      if (plan.reason === "collision" && plan.suggestedDate) {
        setTargetDate(plan.suggestedDate);
      }
      setFeedback({
        tone: plan.reason === "collision" ? "warning" : "danger",
        text: plan.reason === "collision" && plan.suggestedDate
          ? `Zvolený den je obsazený. Nejbližší volný termín je ${formatDate(plan.suggestedDate, true)}.`
          : failureMessage(plan.reason),
      });
      return;
    }
    updateScheduledWorkouts(plan.updates);
    setMonth(parseCalendarDate(targetDate));
    setFeedback({ tone: "success", text: "Trénink je znovu zařazený do programu." });
  }

  function selectShorterVariant(templateId: string) {
    if (!selected || !selectedTemplate) return;
    const variant = data.templates.find((item) => item.id === templateId);
    if (!variant || variant.durationMinutes >= selectedTemplate.durationMinutes) return;
    updateScheduledWorkout(selected.id, {
      templateId: variant.id,
      originalTemplateId: selected.originalTemplateId ?? selected.templateId,
    });
    setFeedback({
      tone: "success",
      text: `Použita kratší varianta ${variant.title} · ${variant.durationMinutes} min.`,
    });
  }

  function restoreOriginalVariant() {
    if (!selected || !originalTemplate) return;
    updateScheduledWorkout(selected.id, {
      templateId: originalTemplate.id,
      originalTemplateId: undefined,
    });
    setFeedback({ tone: "success", text: "Obnovena původně naplánovaná varianta." });
  }

  return (
    <PlanningShell
      eyebrow="Plán"
      title="Kalendář programu"
      description="Přesuň jednotku, uprav zbytek programu nebo zvol kratší trénink podle času, který dnes máš."
      backHref="/plan"
    >
      <section className="ui-card p-5 sm:p-6">
        <label className="block">
          <span className="text-sm font-bold text-zinc-300">Program</span>
          <select
            value={effectiveProgramId}
            onChange={(event) => changeProgram(event.target.value)}
            className="ui-field mt-2"
          >
            {data.trainingPrograms.length === 0 && <option value="">Žádný program</option>}
            {data.trainingPrograms.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>

        {programSchedules.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <Stat value={planned} label="čeká" />
            <Stat value={completed} label="hotovo" />
            <Stat value={skipped} label="vynecháno" muted={skipped === 0} />
            <Stat value={lastDate ? formatDate(lastDate, true) : "–"} label="konec" small />
          </div>
        )}
        {firstDate && lastDate && (
          <p className="mt-4 text-center text-xs leading-5 text-zinc-500 sm:text-sm">
            {formatDate(firstDate, true)} až {formatDate(lastDate, true)}
          </p>
        )}
      </section>

      {feedback && (
        <p
          role="status"
          className={`ui-feedback mt-5 text-sm font-bold ui-feedback-${feedback.tone}`}
        >
          {feedback.text}
        </p>
      )}

      <section className="ui-card ui-card-accent mt-5 overflow-hidden p-3 sm:p-6">
        <div className="flex items-center justify-between gap-2 px-1 sm:gap-3">
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="ui-button ui-button-secondary ui-button-icon text-xl"
            aria-label="Předchozí měsíc"
          >
            ‹
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent sm:text-xs">Program</p>
            <h2 className="mt-1 truncate text-lg font-black capitalize sm:text-xl">
              {new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(month)}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="ui-button ui-button-secondary ui-button-icon text-xl"
            aria-label="Následující měsíc"
          >
            ›
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-zinc-500 sm:gap-1.5 sm:text-xs">
          {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map((date, index) => {
            if (!date) return <span key={`empty-${index}`} className="min-h-16" />;
            const key = calendarDateKey(date);
            const schedules = schedulesForDate(key);
            return (
              <div
                key={key}
                className={`min-h-16 min-w-0 rounded-xl border bg-zinc-950 p-1 sm:min-h-20 sm:p-1.5 ${key === calendarDateKey(new Date()) ? "border-accent/60" : "border-zinc-800"}`}
              >
                <p className="text-[10px] font-bold text-zinc-500 sm:text-xs">{date.getDate()}</p>
                <div className="mt-1 space-y-1">
                  {schedules.map((schedule) => {
                    const template = data.templates.find((item) => item.id === schedule.templateId);
                    const label = template?.metadata?.workoutCode ?? template?.title ?? "Trénink";
                    return (
                      <button
                        key={schedule.id}
                        type="button"
                        onClick={() => openSchedule(schedule)}
                        className="ui-calendar-item"
                        data-status={schedule.status}
                        aria-label={`${label}, ${formatDate(schedule.date, true)}, ${schedule.status}`}
                        title={label}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {!ready && <div className="ui-card mt-6 h-36 animate-pulse" />}
      {ready && data.trainingPrograms.length === 0 && (
        <section className="ui-card mt-6 border-dashed p-8 text-center">
          <h2 className="text-xl font-black">Zatím nemáš program</h2>
          <p className="mt-2 text-zinc-400">Nejdřív vytvoř program a vlož ho do kalendáře.</p>
        </section>
      )}
      {ready && data.trainingPrograms.length > 0 && programSchedules.length === 0 && (
        <section className="ui-card mt-6 border-dashed p-8 text-center text-zinc-400">
          Tento program zatím nemá jednotky v kalendáři.
        </section>
      )}

      {selected && selectedTemplate && (
        <section className="ui-card ui-card-accent mt-6 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">
                {selected.programWeek ? `Týden ${selected.programWeek}` : "Jednotka programu"}
              </p>
              <h2 className="mt-2 text-2xl font-black leading-tight">{selectedTemplate.title}</h2>
              <p className="mt-2 text-sm text-zinc-400">
                {formatDate(selected.date, true)} · {selected.time} · {selectedTemplate.durationMinutes} min
              </p>
            </div>
            <StatusBadge status={selected.status} />
          </div>

          {originalTemplate && (
            <div className="ui-feedback ui-feedback-warning mt-4 text-sm">
              <p className="font-bold">Používáš kratší variantu.</p>
              <p className="mt-1 text-zinc-300">Původně: {originalTemplate.title} · {originalTemplate.durationMinutes} min</p>
              <button type="button" onClick={restoreOriginalVariant} className="ui-button ui-button-secondary ui-button-sm mt-3 w-full">
                Obnovit původní variantu
              </button>
            </div>
          )}

          {selected.status === "planned" && (
            <>
              <div className="mt-5 border-t border-white/8 pt-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Změnit termín</p>
                <label className="mt-3 block">
                  <span className="text-sm font-bold text-zinc-300">Nové datum</span>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(event) => {
                      setTargetDate(event.target.value);
                      setPendingCollision(null);
                    }}
                    className="ui-field mt-2"
                  />
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => applyMove("single")} className="ui-button ui-button-outline">
                    Jen tento trénink
                  </button>
                  <button type="button" onClick={() => applyMove("following")} className="ui-button ui-button-primary">
                    I zbytek programu
                  </button>
                </div>
              </div>

              {pendingCollision && (
                <div className="ui-feedback ui-feedback-warning mt-4 text-sm">
                  <p className="font-bold">Kolize: {pendingCollision.collisionDates.map((date) => formatDate(date)).join(", ")}</p>
                  {pendingCollision.suggestedDate ? (
                    <>
                      <p className="mt-1 text-zinc-300">Nejbližší bezpečný termín je {formatDate(pendingCollision.suggestedDate, true)}.</p>
                      <button
                        type="button"
                        onClick={() => applyMove(pendingCollision.scope, "next-free")}
                        className="ui-button ui-button-primary ui-button-sm mt-3 w-full"
                      >
                        Použít nejbližší volný termín
                      </button>
                    </>
                  ) : (
                    <p className="mt-1 text-zinc-300">Zvol jiné datum nebo přesuň větší část programu.</p>
                  )}
                </div>
              )}

              {!originalTemplate && shorterVariants.length > 0 && (
                <div className="mt-5 border-t border-white/8 pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Nemáš dnes tolik času?</p>
                  <h3 className="mt-2 text-lg font-black">Zvol kratší příbuzný trénink</h3>
                  <div className="mt-3 space-y-2">
                    {shorterVariants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => selectShorterVariant(variant.id)}
                        className="ui-inset flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{variant.title}</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">Stejný tréninkový cíl</span>
                        </span>
                        <span className="ui-chip ui-chip-accent shrink-0">{variant.durationMinutes} min</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 border-t border-white/8 pt-5">
                <button type="button" onClick={() => setPendingSkip(selected)} className="ui-button ui-button-secondary w-full">
                  Dnes vynechat
                </button>
              </div>
            </>
          )}

          {selected.status === "skipped" && (
            <div className="mt-5 border-t border-white/8 pt-5">
              <p className="text-sm leading-6 text-zinc-400">Trénink zůstává součástí programu. Můžeš ho vrátit na původní nebo jiné volné datum.</p>
              <label className="mt-4 block">
                <span className="text-sm font-bold text-zinc-300">Datum návratu</span>
                <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="ui-field mt-2" />
              </label>
              <button type="button" onClick={restoreSelected} className="ui-button ui-button-primary mt-3 w-full">Vrátit do plánu</button>
            </div>
          )}

          {selected.status === "completed" && (
            <p className="ui-feedback ui-feedback-success mt-5 text-sm">Dokončený trénink zůstává uzamčený, aby se nezměnila historie programu.</p>
          )}

          <button type="button" onClick={() => setSelectedId("")} className="ui-button ui-button-ghost mt-4 w-full">Zavřít detail</button>
        </section>
      )}

      <ConfirmDialog
        open={pendingSkip !== null}
        title="Vynechat tento trénink?"
        description="Jednotka zůstane v programu a můžeš ji později znovu zařadit. Následující tréninky se neposunou."
        confirmLabel="Označit jako vynechaný"
        onCancel={() => setPendingSkip(null)}
        onConfirm={skipSelected}
      />
    </PlanningShell>
  );
}

function Stat({
  value,
  label,
  small = false,
  muted = false,
}: {
  value: string | number;
  label: string;
  small?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="ui-inset min-w-0 p-3 text-center sm:p-4">
      <p className={`${small ? "truncate text-xs sm:text-sm" : "text-xl sm:text-2xl"} font-black ${muted ? "text-zinc-500" : "text-accent"}`}>{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-wide text-zinc-500 sm:text-[10px]">{label}</p>
    </div>
  );
}
