import type { WorkoutStep, WorkoutTemplate } from "./types";

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
  emomMinute?: number;
  emomMinutes?: number;
};

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function timedRestDurationSeconds(step: WorkoutStep) {
  const text = normalized(`${step.name} ${step.detail}`);
  if (!/\b(odpocinek|odpocinku|pauza|rest)\b/.test(text)) return undefined;

  const minutes = text.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minuta|minuty|minut)\b/);
  if (minutes) return Math.max(1, Math.round(Number(minutes[1].replace(",", ".")) * 60));

  const seconds = text.match(/(\d+(?:[.,]\d+)?)\s*(?:s|sec|sek|sekunda|sekundy|sekund)\b/);
  if (seconds) return Math.max(1, Math.round(Number(seconds[1].replace(",", "."))));

  return undefined;
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
          emomMinute: minute + 1,
          emomMinutes: block.minutes,
        };
      });
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
      }];
    })).flat();
  });
}
