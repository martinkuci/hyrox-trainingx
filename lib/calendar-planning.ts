import type {
  NewScheduledWorkout,
  ScheduledWorkout,
  TrainingProgram,
  WorkoutTemplate,
} from "./types";

export type ScheduledWorkoutUpdate = {
  id: string;
  updates: Partial<NewScheduledWorkout>;
};

export type ScheduleMoveScope = "single" | "following";
export type ScheduleCollisionPolicy = "reject" | "next-free";
export type ScheduleMoveFailure =
  | "missing"
  | "not-planned"
  | "same-date"
  | "out-of-order"
  | "collision"
  | "no-free-date";

export type ScheduleMovePlan =
  | {
      ok: true;
      updates: ScheduledWorkoutUpdate[];
      movedCount: number;
      requestedDate: string;
      resolvedDate: string;
      adjustmentDays: number;
      collisionDates: string[];
    }
  | {
      ok: false;
      reason: ScheduleMoveFailure;
      collisionDates: string[];
      suggestedDate?: string;
    };

export type ProgramCalendarChoice = {
  id: string;
  name: string;
  stored: boolean;
};

export function listProgramCalendarChoices(
  programs: TrainingProgram[],
  schedules: ScheduledWorkout[],
): ProgramCalendarChoice[] {
  const choices = programs.map((program) => ({
    id: program.id,
    name: program.name,
    stored: true,
  }));
  const knownIds = new Set(choices.map((choice) => choice.id));
  const orphanIds = Array.from(new Set(
    schedules
      .map((schedule) => schedule.programId)
      .filter((id): id is string => typeof id === "string" && id.length > 0 && !knownIds.has(id)),
  ));

  return [
    ...choices,
    ...orphanIds.map((id, index) => ({
      id,
      name: orphanIds.length === 1
        ? "Program v kalendáři"
        : `Program v kalendáři ${index + 1}`,
      stored: false,
    })),
  ];
}

type PlanMoveInput = {
  selectedId: string;
  targetDate: string;
  scope: ScheduleMoveScope;
  programSchedules: ScheduledWorkout[];
  allSchedules: ScheduledWorkout[];
  collisionPolicy?: ScheduleCollisionPolicy;
};

const DAY_MS = 86_400_000;
const SEARCH_LIMIT_DAYS = 366;

export function parseCalendarDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addCalendarDays(value: string, days: number) {
  const date = parseCalendarDate(value);
  date.setDate(date.getDate() + days);
  return calendarDateKey(date);
}

export function calendarDayDiff(from: string, to: string) {
  return Math.round(
    (parseCalendarDate(to).getTime() - parseCalendarDate(from).getTime()) / DAY_MS,
  );
}

export function orderProgramSchedules(
  schedules: ScheduledWorkout[],
  program?: TrainingProgram,
) {
  const order = new Map<string, number>();
  program?.weeks.forEach((week) => {
    week.sessions.forEach((session, sessionIndex) => {
      order.set(session.id, week.weekNumber * 100 + sessionIndex);
    });
  });

  return [...schedules].sort((left, right) => {
    const leftOrder = left.programSessionId
      ? order.get(left.programSessionId)
      : undefined;
    const rightOrder = right.programSessionId
      ? order.get(right.programSessionId)
      : undefined;
    if (leftOrder !== undefined && rightOrder !== undefined && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    if ((left.programWeek ?? 0) !== (right.programWeek ?? 0)) {
      return (left.programWeek ?? 0) - (right.programWeek ?? 0);
    }
    return `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`);
  });
}

function respectsProgramOrder(
  programSchedules: ScheduledWorkout[],
  movedDates: Map<string, string>,
) {
  let previousDate: string | undefined;
  for (const schedule of programSchedules) {
    if (schedule.status === "skipped") continue;
    const date = movedDates.get(schedule.id) ?? schedule.date;
    if (previousDate && date <= previousDate) return false;
    previousDate = date;
  }
  return true;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function groupCollisionDates(
  dates: string[],
  occupiedDates: Set<string>,
) {
  return uniqueSorted(dates.filter((date) => occupiedDates.has(date)));
}

function findSingleFreeDate({
  requestedDate,
  direction,
  occupiedDates,
  candidateIsOrdered,
}: {
  requestedDate: string;
  direction: 1 | -1;
  occupiedDates: Set<string>;
  candidateIsOrdered: (candidate: string) => boolean;
}) {
  for (let offset = 1; offset <= SEARCH_LIMIT_DAYS; offset += 1) {
    const candidate = addCalendarDays(requestedDate, offset * direction);
    if (!candidateIsOrdered(candidate)) continue;
    if (!occupiedDates.has(candidate)) return candidate;
  }
  return undefined;
}

function findGroupFreeDate({
  requestedDate,
  originalDates,
  initialDelta,
  direction,
  occupiedDates,
  candidateIsOrdered,
}: {
  requestedDate: string;
  originalDates: string[];
  initialDelta: number;
  direction: 1 | -1;
  occupiedDates: Set<string>;
  candidateIsOrdered: (candidateDates: string[]) => boolean;
}) {
  for (let offset = 1; offset <= SEARCH_LIMIT_DAYS; offset += 1) {
    const additionalShift = offset * direction;
    const selectedDate = addCalendarDays(requestedDate, additionalShift);
    const candidateDates = originalDates.map((date) =>
      addCalendarDays(date, initialDelta + additionalShift),
    );
    if (!candidateIsOrdered(candidateDates)) continue;
    if (groupCollisionDates(candidateDates, occupiedDates).length === 0) {
      return selectedDate;
    }
  }
  return undefined;
}

export function planScheduledWorkoutMove({
  selectedId,
  targetDate,
  scope,
  programSchedules,
  allSchedules,
  collisionPolicy = "reject",
}: PlanMoveInput): ScheduleMovePlan {
  const selectedIndex = programSchedules.findIndex((item) => item.id === selectedId);
  const selected = programSchedules[selectedIndex];
  if (!selected) return { ok: false, reason: "missing", collisionDates: [] };
  if (selected.status !== "planned") {
    return { ok: false, reason: "not-planned", collisionDates: [] };
  }
  if (targetDate === selected.date) {
    return { ok: false, reason: "same-date", collisionDates: [] };
  }

  const moving = scope === "following"
    ? programSchedules.slice(selectedIndex).filter((item) => item.status === "planned")
    : [selected];
  const movingIds = new Set(moving.map((item) => item.id));
  const occupiedDates = new Set(
    allSchedules
      .filter((item) => !movingIds.has(item.id) && item.status !== "skipped")
      .map((item) => item.date),
  );
  const delta = calendarDayDiff(selected.date, targetDate);
  const direction: 1 | -1 = delta < 0 ? -1 : 1;

  if (scope === "single") {
    const singleMoveIsOrdered = (date: string) =>
      respectsProgramOrder(programSchedules, new Map([[selected.id, date]]));
    if (!singleMoveIsOrdered(targetDate)) {
      return { ok: false, reason: "out-of-order", collisionDates: [] };
    }
    const collisionDates = occupiedDates.has(targetDate) ? [targetDate] : [];
    if (collisionDates.length > 0) {
      const suggestedDate = findSingleFreeDate({
        requestedDate: targetDate,
        direction,
        occupiedDates,
        candidateIsOrdered: singleMoveIsOrdered,
      });
      if (collisionPolicy === "reject") {
        return { ok: false, reason: "collision", collisionDates, suggestedDate };
      }
      if (!suggestedDate) {
        return { ok: false, reason: "no-free-date", collisionDates };
      }
      return {
        ok: true,
        updates: [{ id: selected.id, updates: { date: suggestedDate } }],
        movedCount: 1,
        requestedDate: targetDate,
        resolvedDate: suggestedDate,
        adjustmentDays: calendarDayDiff(targetDate, suggestedDate),
        collisionDates,
      };
    }
    return {
      ok: true,
      updates: [{ id: selected.id, updates: { date: targetDate } }],
      movedCount: 1,
      requestedDate: targetDate,
      resolvedDate: targetDate,
      adjustmentDays: 0,
      collisionDates: [],
    };
  }

  const groupMoveIsOrdered = (dates: string[]) =>
    respectsProgramOrder(
      programSchedules,
      new Map(moving.map((item, index) => [item.id, dates[index]])),
    );
  const intendedDates = moving.map((item) => addCalendarDays(item.date, delta));
  if (!groupMoveIsOrdered(intendedDates)) {
    return { ok: false, reason: "out-of-order", collisionDates: [] };
  }
  const collisionDates = groupCollisionDates(intendedDates, occupiedDates);
  if (collisionDates.length > 0) {
    const suggestedDate = findGroupFreeDate({
      requestedDate: targetDate,
      originalDates: moving.map((item) => item.date),
      initialDelta: delta,
      direction,
      occupiedDates,
      candidateIsOrdered: groupMoveIsOrdered,
    });
    if (collisionPolicy === "reject") {
      return { ok: false, reason: "collision", collisionDates, suggestedDate };
    }
    if (!suggestedDate) {
      return { ok: false, reason: "no-free-date", collisionDates };
    }
    const resolvedDelta = calendarDayDiff(selected.date, suggestedDate);
    return {
      ok: true,
      updates: moving.map((item) => ({
        id: item.id,
        updates: { date: addCalendarDays(item.date, resolvedDelta) },
      })),
      movedCount: moving.length,
      requestedDate: targetDate,
      resolvedDate: suggestedDate,
      adjustmentDays: calendarDayDiff(targetDate, suggestedDate),
      collisionDates,
    };
  }

  return {
    ok: true,
    updates: moving.map((item) => ({
      id: item.id,
      updates: { date: addCalendarDays(item.date, delta) },
    })),
    movedCount: moving.length,
    requestedDate: targetDate,
    resolvedDate: targetDate,
    adjustmentDays: 0,
    collisionDates: [],
  };
}

export function planScheduledWorkoutRestore({
  selectedId,
  targetDate,
  programSchedules,
  allSchedules,
}: Omit<PlanMoveInput, "scope" | "collisionPolicy">): ScheduleMovePlan {
  const selected = programSchedules.find((item) => item.id === selectedId);
  if (!selected) return { ok: false, reason: "missing", collisionDates: [] };
  if (selected.status !== "skipped") {
    return { ok: false, reason: "not-planned", collisionDates: [] };
  }

  const restoredProgram = programSchedules.map((item) =>
    item.id === selected.id ? { ...item, status: "planned" as const } : item,
  );
  const restoredDateIsOrdered = (date: string) =>
    respectsProgramOrder(restoredProgram, new Map([[selected.id, date]]));
  if (!restoredDateIsOrdered(targetDate)) {
    return { ok: false, reason: "out-of-order", collisionDates: [] };
  }

  const occupiedDates = new Set(
    allSchedules
      .filter((item) => item.id !== selected.id && item.status !== "skipped")
      .map((item) => item.date),
  );
  if (occupiedDates.has(targetDate)) {
    const suggestedDate = findSingleFreeDate({
      requestedDate: targetDate,
      direction: 1,
      occupiedDates,
      candidateIsOrdered: restoredDateIsOrdered,
    });
    return {
      ok: false,
      reason: "collision",
      collisionDates: [targetDate],
      suggestedDate,
    };
  }

  return {
    ok: true,
    updates: [{
      id: selected.id,
      updates: { status: "planned", date: targetDate },
    }],
    movedCount: 1,
    requestedDate: targetDate,
    resolvedDate: targetDate,
    adjustmentDays: 0,
    collisionDates: [],
  };
}

export function findShorterWorkoutVariants(
  template: WorkoutTemplate,
  templates: WorkoutTemplate[],
  limit = 3,
) {
  const shorter = templates.filter(
    (candidate) =>
      candidate.id !== template.id &&
      candidate.durationMinutes < template.durationMinutes,
  );
  const progressionGroup = template.metadata?.progressionGroup;
  const sameProgression = progressionGroup
    ? shorter.filter(
        (candidate) => candidate.metadata?.progressionGroup === progressionGroup,
      )
    : [];
  const sameCategory = template.metadata?.category
    ? shorter.filter(
        (candidate) => candidate.metadata?.category === template.metadata?.category,
      )
    : [];
  const pool = sameProgression.length > 0 ? sameProgression : sameCategory;

  return [...pool]
    .sort((left, right) => {
      const duration = right.durationMinutes - left.durationMinutes;
      if (duration !== 0) return duration;
      return left.title.localeCompare(right.title, "cs");
    })
    .slice(0, limit);
}
