import type {
  EquipmentId,
  ProgramPhase,
  ProgramWeek,
  ScheduledTrainingLocation,
  WorkoutCategory,
  WorkoutTemplate,
} from "./types";
import {
  getSessionBlueprints,
  scoreTemplateForBlueprint,
  type ProgramGoal,
  type ProgramLevel,
  type SessionBlueprint,
} from "./program-generation-policy.ts";
import {
  findCompatibleLocationForTemplate,
  templateFitsEquipment,
} from "./training-context.ts";

export type { ProgramGoal, ProgramLevel } from "./program-generation-policy.ts";

export type ProgramTrainingLocation = {
  id: ScheduledTrainingLocation;
  equipment: EquipmentId[];
};

type BuildProgramInput = {
  templates: WorkoutTemplate[];
  duration: number;
  frequency: number;
  goal: ProgramGoal;
  level: ProgramLevel;
  days: number[];
  locations?: ProgramTrainingLocation[];
  makeSessionId?: () => string;
};

const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

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

function orderedPool(
  templates: WorkoutTemplate[],
  session: SessionBlueprint,
) {
  return [...templates].sort((left, right) => {
    const policyScore =
      scoreTemplateForBlueprint(right, session) -
      scoreTemplateForBlueprint(left, session);
    if (policyScore !== 0) return policyScore;

    const difficulty = templateDifficulty(right) - templateDifficulty(left);
    if (difficulty !== 0) return difficulty;

    const leftCode = left.metadata?.workoutCode ?? left.title;
    const rightCode = right.metadata?.workoutCode ?? right.title;
    return leftCode.localeCompare(rightCode, "cs");
  });
}

function chooseTemplate(
  templates: WorkoutTemplate[],
  session: SessionBlueprint,
  maxDifficulty: ProgramLevel,
  cursor: number,
  usedTemplateIds: Set<string>,
  locations: ProgramTrainingLocation[],
) {
  const eligible = templates.filter(
    (template) =>
      templateDifficulty(template) <= maxDifficulty &&
      (locations.length === 0 || locations.some((location) => templateFitsEquipment(template, location.equipment))),
  );
  const inCategory = eligible.filter(
    (template) => template.metadata?.category === session.category,
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
    session,
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
  locations = [],
  makeSessionId = () => crypto.randomUUID(),
}: BuildProgramInput): ProgramWeek[] {
  const safeDuration = Math.max(1, Math.round(duration));
  const safeFrequency = Math.min(5, Math.max(1, Math.round(frequency)));
  const trainingDays = orderedDays(days, safeFrequency);
  const categoryCursors = new Map<WorkoutCategory, number>();

  return Array.from({ length: safeDuration }, (_, index) => {
    const weekNumber = index + 1;
    const phase = phaseForWeek(weekNumber, safeDuration);
    const sessions = getSessionBlueprints(goal, phase, safeFrequency);
    const maxDifficulty = difficultyForPhase(phase, level);
    const usedTemplateIds = new Set<string>();

    return {
      weekNumber,
      title: `Týden ${weekNumber}`,
      phase,
      focus: phaseFocus[phase],
      sessions: sessions.map((session, sessionIndex) => {
        const cursor = categoryCursors.get(session.category) ?? 0;
        const template = chooseTemplate(
          templates,
          session,
          maxDifficulty,
          cursor,
          usedTemplateIds,
          locations,
        );
        categoryCursors.set(session.category, cursor + 1);
        if (template) usedTemplateIds.add(template.id);
        const location = template && locations.length > 0
          ? findCompatibleLocationForTemplate(template, locations)
          : undefined;

        return {
          id: makeSessionId(),
          weekday: trainingDays[sessionIndex] as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          time:
            sessionIndex === safeFrequency - 1 && safeFrequency >= 3
              ? "09:00"
              : "18:00",
          templateId: template?.id ?? null,
          note: `${phaseLabels[phase]} · ${template?.metadata?.category ?? session.category}`,
          trainingLocation: location?.id,
        };
      }),
    };
  });
}
