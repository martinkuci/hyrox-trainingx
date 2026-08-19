import type {
  ProgramPhase,
  ProgramWeek,
  WorkoutCategory,
  WorkoutTemplate,
} from "./types";

export type ProgramGoal = "race" | "fitness" | "run" | "strength";
export type ProgramLevel = 1 | 2 | 3;

type BuildProgramInput = {
  templates: WorkoutTemplate[];
  duration: number;
  frequency: number;
  goal: ProgramGoal;
  level: ProgramLevel;
  days: number[];
  makeSessionId?: () => string;
};

const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

const patterns: Record<
  ProgramGoal,
  Record<ProgramPhase, WorkoutCategory[]>
> = {
  race: {
    base: ["base-engine", "strength", "base-builder", "long-engine", "recovery"],
    build: ["threshold", "strength", "base-engine", "mixed", "long-engine"],
    deload: ["recovery", "base-engine", "strength", "mixed", "long-engine"],
    specific: ["race-simulation", "threshold", "strength", "mixed", "long-engine"],
    taper: ["recovery", "base-engine", "race-simulation", "threshold", "mixed"],
  },
  fitness: {
    base: ["base-engine", "strength", "base-builder", "long-engine", "recovery"],
    build: ["mixed", "strength", "threshold", "base-engine", "long-engine"],
    deload: ["recovery", "base-engine", "strength", "mixed", "long-engine"],
    specific: ["mixed", "threshold", "strength", "long-engine", "race-simulation"],
    taper: ["recovery", "base-engine", "mixed", "strength", "threshold"],
  },
  run: {
    base: ["base-engine", "strength", "base-builder", "long-engine", "recovery"],
    build: ["threshold", "base-engine", "strength", "long-engine", "mixed"],
    deload: ["recovery", "base-engine", "strength", "mixed", "long-engine"],
    specific: ["threshold", "long-engine", "mixed", "strength", "race-simulation"],
    taper: ["recovery", "base-engine", "threshold", "mixed", "strength"],
  },
  strength: {
    base: ["strength", "base-engine", "base-builder", "recovery", "long-engine"],
    build: ["strength", "mixed", "threshold", "base-engine", "long-engine"],
    deload: ["recovery", "strength", "base-engine", "mixed", "long-engine"],
    specific: ["strength", "race-simulation", "mixed", "threshold", "long-engine"],
    taper: ["recovery", "base-engine", "strength", "mixed", "threshold"],
  },
};

export const phaseLabels: Record<ProgramPhase, string> = {
  base: "Základ",
  build: "Rozvoj",
  deload: "Odlehčení",
  specific: "Specifická fáze",
  taper: "Taper",
};

const phaseFocus: Record<ProgramPhase, string> = {
  base: "Aerobní základ, technika a silová příprava",
  build: "Vyšší výkon a pracovní kapacita",
  deload: "Nižší objem, lehká intenzita a regenerace",
  specific: "Cílové závodní tempo, přechody a specifické disciplíny",
  taper: "Snížený objem a zachování ostrosti",
};

export function phaseForWeek(week: number, duration: number): ProgramPhase {
  if (week === duration) return "taper";
  if (week % 4 === 0) return "deload";
  const ratio = week / duration;
  if (ratio <= 0.3) return "base";
  if (ratio <= 0.65) return "build";
  return "specific";
}

function difficultyForPhase(
  phase: ProgramPhase,
  level: ProgramLevel,
): ProgramLevel {
  if (phase === "deload" || phase === "taper") return 1;
  if (phase === "base") return Math.min(level, 2) as ProgramLevel;
  return level;
}

function templateDifficulty(template: WorkoutTemplate) {
  return template.metadata?.difficultyLevel ?? 1;
}

function orderedPool(templates: WorkoutTemplate[]) {
  return [...templates].sort((left, right) => {
    const difficulty = templateDifficulty(right) - templateDifficulty(left);
    if (difficulty !== 0) return difficulty;
    const leftCode = left.metadata?.workoutCode ?? left.title;
    const rightCode = right.metadata?.workoutCode ?? right.title;
    return leftCode.localeCompare(rightCode, "cs");
  });
}

function chooseTemplate(
  templates: WorkoutTemplate[],
  category: WorkoutCategory,
  maxDifficulty: ProgramLevel,
  cursor: number,
  usedTemplateIds: Set<string>,
) {
  const eligible = templates.filter(
    (template) => templateDifficulty(template) <= maxDifficulty,
  );
  const inCategory = eligible.filter(
    (template) => template.metadata?.category === category,
  );
  const unusedInCategory = inCategory.filter(
    (template) => !usedTemplateIds.has(template.id),
  );
  const unusedEligible = eligible.filter(
    (template) => !usedTemplateIds.has(template.id),
  );
  const pool = orderedPool(
    unusedInCategory.length
      ? unusedInCategory
      : unusedEligible.length
        ? unusedEligible
        : inCategory.length
          ? inCategory
          : eligible,
  );
  return pool.length ? pool[cursor % pool.length] : undefined;
}

function orderedDays(days: number[], frequency: number) {
  const selected = new Set(days);
  const sorted = weekdayOrder.filter((day) => selected.has(day));
  for (const day of weekdayOrder) {
    if (sorted.length >= frequency) break;
    if (!sorted.includes(day)) sorted.push(day);
  }
  return sorted.slice(0, frequency);
}

export function buildProgramWeeks({
  templates,
  duration,
  frequency,
  goal,
  level,
  days,
  makeSessionId = () => crypto.randomUUID(),
}: BuildProgramInput): ProgramWeek[] {
  const safeDuration = Math.max(1, Math.round(duration));
  const safeFrequency = Math.min(5, Math.max(1, Math.round(frequency)));
  const trainingDays = orderedDays(days, safeFrequency);
  const categoryCursors = new Map<WorkoutCategory, number>();

  return Array.from({ length: safeDuration }, (_, index) => {
    const weekNumber = index + 1;
    const phase = phaseForWeek(weekNumber, safeDuration);
    const categories = patterns[goal][phase].slice(0, safeFrequency);
    const maxDifficulty = difficultyForPhase(phase, level);
    const usedTemplateIds = new Set<string>();

    return {
      weekNumber,
      title: `Týden ${weekNumber}`,
      phase,
      focus: phaseFocus[phase],
      sessions: categories.map((category, sessionIndex) => {
        const cursor = categoryCursors.get(category) ?? 0;
        const template = chooseTemplate(
          templates,
          category,
          maxDifficulty,
          cursor,
          usedTemplateIds,
        );
        categoryCursors.set(category, cursor + 1);
        if (template) usedTemplateIds.add(template.id);

        return {
          id: makeSessionId(),
          weekday: trainingDays[sessionIndex] as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          time: sessionIndex === safeFrequency - 1 && safeFrequency >= 3
            ? "09:00"
            : "18:00",
          templateId: template?.id ?? null,
          note: `${phaseLabels[phase]} · ${template?.metadata?.category ?? category}`,
        };
      }),
    };
  });
}
