import type { IntervalWorkoutBlock, TabataWorkoutBlock, WorkoutStep, WorkoutTemplate } from "./types";

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
const RECOVERY_PATTERN = /\b(odpocinek|odpocinku|pauza|rest|recovery|recover|zotaveni)\b|srovnej dech|vydychej/;
const MINUTES_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:min|minuta|minuty|minut)\b/;
const SECONDS_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:s|sec|sek|sekunda|sekundy|sekund)\b/;

export type RunnableStep = {
  blockId: string;
  stepId: string;
  blockTitle: string;
  round: number;
  roundCount: number;
  name: string;
  detail: string;
  durationSeconds?: number;
  kind: "work" | "rest";
  mode: "manual" | "for-time" | "interval" | "tabata" | "emom" | "amrap";
  emomMinute?: number;
  emomMinutes?: number;
};

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase();
}

export function timedRestDurationSeconds(step: WorkoutStep) {
  const text = normalized(`${step.name} ${step.detail}`);
  if (!RECOVERY_PATTERN.test(text)) return undefined;

  const minutes = text.match(MINUTES_PATTERN);
  if (minutes) return Math.max(1, Math.round(Number(minutes[1].replace(",", ".")) * 60));

  const seconds = text.match(SECONDS_PATTERN);
  if (seconds) return Math.max(1, Math.round(Number(seconds[1].replace(",", "."))));

  return undefined;
}

export function countdownCueSecond(durationSeconds: number, elapsedMilliseconds: number) {
  const remainingMilliseconds = durationSeconds * 1000 - elapsedMilliseconds;
  if (remainingMilliseconds <= 0) return undefined;
  const remainingSeconds = Math.floor(remainingMilliseconds / 1000);
  return remainingSeconds >= 1 && remainingSeconds <= 3 ? remainingSeconds : undefined;
}

function structuredRestStep(
  block: { id: string; title: string; rounds: number; restSeconds: number; restName?: string; restDetail?: string },
  round: number,
  mode: "for-time" | "interval" | "tabata",
): RunnableStep | undefined {
  if (block.restSeconds <= 0 || round >= block.rounds) return undefined;
  return {
    blockId: block.id,
    stepId: `${block.id}-rest`,
    blockTitle: block.title,
    round,
    roundCount: block.rounds,
    name: block.restName?.trim() || "Odpočinek",
    detail: block.restDetail?.trim() || `${block.restSeconds} s · potom kolo ${round + 1} z ${block.rounds}`,
    durationSeconds: block.restSeconds,
    kind: "rest",
    mode,
  };
}

function flattenTimedIntervals(block: IntervalWorkoutBlock | TabataWorkoutBlock): RunnableStep[] {
  if (block.steps.length === 0) return [];

  return Array.from({ length: block.rounds }, (_, index) => {
    const round = index + 1;
    const step = block.steps[index % block.steps.length];
    const work: RunnableStep = {
      blockId: block.id,
      stepId: step.id,
      blockTitle: block.title,
      round,
      roundCount: block.rounds,
      name: step.name,
      detail: step.detail,
      durationSeconds: block.workSeconds,
      kind: "work",
      mode: block.type,
    };
    const rest = structuredRestStep(block, round, block.type);
    return rest ? [work, rest] : [work];
  }).flat();
}

export function flattenWorkoutTemplate(template: WorkoutTemplate): RunnableStep[] {
  return template.blocks.flatMap((block) => {
    if (block.type === "emom") {
      if (block.steps.length === 0) return [];
      return Array.from({ length: block.minutes }, (_, minute) => {
        const step = block.steps[minute % block.steps.length];
        return {
          blockId: block.id,
          stepId: step.id,
          blockTitle: block.title,
          round: minute + 1,
          roundCount: block.minutes,
          name: step.name,
          detail: step.detail,
          durationSeconds: 60,
          kind: "work" as const,
          mode: "emom" as const,
          emomMinute: minute + 1,
          emomMinutes: block.minutes,
        };
      });
    }

    if (block.type === "amrap") {
      if (block.steps.length === 0) return [];
      const exerciseList = block.steps
        .map((step) => step.detail ? `${step.name} (${step.detail})` : step.name)
        .join(" · ");
      return [{
        blockId: block.id,
        stepId: `${block.id}-amrap`,
        blockTitle: block.title,
        round: 1,
        roundCount: 1,
        name: block.title,
        detail: `Opakuj dokola: ${exerciseList}`,
        durationSeconds: Math.max(1, block.minutes) * 60,
        kind: "work" as const,
        mode: "amrap" as const,
      }];
    }

    if (block.type === "interval" || block.type === "tabata") {
      return flattenTimedIntervals(block);
    }

    if (block.type === "for-time") {
      return Array.from({ length: block.rounds }, (_, index) => {
        const round = index + 1;
        const work = block.steps.map((step): RunnableStep => ({
          blockId: block.id,
          stepId: step.id,
          blockTitle: block.title,
          round,
          roundCount: block.rounds,
          name: step.name,
          detail: step.detail,
          kind: "work",
          mode: "for-time",
        }));
        const rest = structuredRestStep(block, round, "for-time");
        return rest ? [...work, rest] : work;
      }).flat();
    }

    return Array.from({ length: block.repeat }, (_, round) => block.steps.flatMap((step, stepIndex) => {
      const restDuration = timedRestDurationSeconds(step);
      const isLastStep = stepIndex === block.steps.length - 1;
      const isLastRound = round === block.repeat - 1;
      if (restDuration && isLastStep && isLastRound) return [];

      return [{
        blockId: block.id,
        stepId: step.id,
        blockTitle: block.title,
        round: round + 1,
        roundCount: block.repeat,
        name: step.name,
        detail: step.detail,
        durationSeconds: restDuration,
        kind: restDuration ? "rest" as const : "work" as const,
        mode: "manual" as const,
      }];
    })).flat();
  });
}
