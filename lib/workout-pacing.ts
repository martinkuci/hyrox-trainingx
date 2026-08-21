import type { StepSplit, WorkoutBlock, WorkoutStep, WorkoutTemplate } from "./types";

export type WorkoutPacingPhase = "warmup" | "work" | "cooldown";

export type WorkoutPacingStep = {
  blockId: string;
  stepId: string;
  phase: WorkoutPacingPhase;
  targetSeconds?: number;
  movementTargetSeconds?: number;
  transitionSeconds?: number;
  paceLabel?: string;
  cue: string;
};

export type WorkoutPacingPlan = {
  targetWorkoutSeconds: number;
  transitionReserveSeconds: number;
  steps: Record<string, WorkoutPacingStep>;
};

export type WorkoutTimingBreakdown = {
  sessionSeconds: number;
  warmupSeconds: number;
  workoutSeconds: number;
  cooldownSeconds: number;
};

export type ReferencePacingInput = {
  name: string;
  detail?: string;
  exerciseId?: string;
  distanceMeters?: number;
  reps?: number;
  runOrdinal?: number;
};

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;

export function normalizedWorkoutText(...values: Array<string | undefined>) {
  return values
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase();
}

function parseMinutes(text: string) {
  const matches = [...text.matchAll(/(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*min(?:\.|ut(?:y|a)?)?/gi)];
  if (!matches.length) return undefined;
  return matches.reduce((sum, match) => {
    const from = Number(match[1]);
    const to = Number(match[2] ?? match[1]);
    return sum + (from + to) / 2;
  }, 0);
}

export function classifyWorkoutPhase(
  blockTitle: string,
  stepName = "",
  stepDetail = "",
  category?: string,
): WorkoutPacingPhase {
  if (["warmup", "mobility", "compensation"].includes(category ?? "")) return "warmup";
  if (category === "recovery") return "cooldown";
  const text = normalizedWorkoutText(blockTitle, stepName, stepDetail);
  if (["zklid", "cooldown", "cool-down", "regener", "recovery", "vychozeni", "prota"].some((token) => text.includes(token))) return "cooldown";
  if (["rozcvi", "warmup", "warm-up", "mobilit", "aktivac", "rozbehani"].some((token) => text.includes(token))) return "warmup";
  return "work";
}

function parseDistanceFromText(name: string, detail = "") {
  const text = normalizedWorkoutText(name, detail).replace(/,/g, ".");
  const multiplied = text.match(/(?:^|\s)(\d{1,3})\s*[x×]\s*(\d+(?:\.\d+)?)\s*m\b/);
  if (multiplied) return Math.round(Number(multiplied[1]) * Number(multiplied[2]));
  const km = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*km\b/);
  if (km) return Math.round(Number(km[1]) * 1000);
  const meters = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*m(?:\s|$)/);
  return meters ? Math.round(Number(meters[1])) : undefined;
}

function parseRepsFromText(name: string, detail = "", distanceMeters?: number) {
  if (distanceMeters) return undefined;
  const text = normalizedWorkoutText(name, detail);
  const explicit = text.match(/(?:^|\s)(\d{1,4})\s*(?:x|rep(?:s)?|opakovani)(?:\s|$)/);
  if (explicit) return Number(explicit[1]);
  const leading = name.match(/^\s*(\d{1,4})\b/);
  return leading ? Number(leading[1]) : undefined;
}

function parseDistanceMeters(step: WorkoutStep) {
  return parseDistanceFromText(step.name, step.detail);
}

function parseReps(step: WorkoutStep) {
  const distance = parseDistanceMeters(step);
  return parseRepsFromText(step.name, step.detail, distance);
}

function isRunText(text: string) {
  return text.includes("run") || text.includes("beh") || text.includes("klus");
}

function isSkiText(text: string) {
  return text.includes("ski-erg") || text.includes("skierg") || text.includes("ski erg");
}

function isRowText(text: string) {
  return text.includes("row") || text.includes("vesl");
}

export function referencePacingSeconds(input: ReferencePacingInput) {
  const text = normalizedWorkoutText(input.exerciseId, input.name, input.detail);
  const distance = input.distanceMeters ?? parseDistanceFromText(input.name, input.detail);
  const reps = input.reps ?? parseRepsFromText(input.name, input.detail, distance);
  const runOrdinal = Math.max(0, input.runOrdinal ?? 0);

  // Baseline ratios follow observed HYROX-style race distributions. The values
  // are reference weights, not promises: the whole plan is rescaled to the
  // athlete's selected target time.
  if (distance && isRunText(text)) {
    const perKm = 352 * (1 + Math.min(7, runOrdinal) * 0.01);
    return Math.max(20, perKm * distance / 1000);
  }
  if (distance && isSkiText(text)) return Math.max(20, 291 * distance / 1000);
  if (distance && (text.includes("sled push") || text.includes("sled-push"))) return Math.max(20, 163 * distance / 50);
  if (distance && (text.includes("sled pull") || text.includes("sled-pull"))) return Math.max(20, 186 * distance / 50);
  if (distance && (text.includes("burpee") || text.includes("broad jump"))) return Math.max(20, 338 * distance / 80);
  if (distance && isRowText(text)) return Math.max(20, 338 * distance / 1000);
  if (distance && (text.includes("farmer") || text.includes("carry"))) return Math.max(20, 175 * distance / 200);
  if (distance && (text.includes("lunge") || text.includes("vypad"))) return Math.max(20, 291 * distance / 100);
  if (reps && (text.includes("wall-ball") || text.includes("wall ball"))) return Math.max(20, 408 * reps / 100);

  if (distance) return Math.max(30, distance * 0.8);
  if (reps) {
    if (text.includes("burpee")) return Math.max(30, reps * 4);
    if (text.includes("lunge") || text.includes("vypad")) return Math.max(30, reps * 2.1);
    return Math.max(30, reps * 2.5);
  }
  return 75;
}

function occurrenceCount(block: WorkoutBlock, stepIndex: number) {
  if (block.type === "manual") return Math.max(1, block.repeat);
  if (block.type === "for-time") return Math.max(1, block.rounds);
  if (block.type === "interval" || block.type === "tabata") {
    if (!block.steps.length) return 0;
    return Array.from({ length: block.rounds }, (_, round) => round % block.steps.length === stepIndex).filter(Boolean).length;
  }
  if (block.type === "emom") {
    if (!block.steps.length) return 0;
    return Array.from({ length: block.minutes }, (_, minute) => minute % block.steps.length === stepIndex).filter(Boolean).length;
  }
  return 1;
}

function structuredWorkSeconds(block: WorkoutBlock, phase: WorkoutPacingPhase) {
  if (phase !== "work") return 0;
  if (block.type === "interval" || block.type === "tabata") {
    return block.rounds * block.workSeconds + Math.max(0, block.rounds - 1) * Math.max(0, block.restSeconds);
  }
  if (block.type === "emom" || block.type === "amrap") return Math.max(1, block.minutes) * 60;
  return 0;
}

function transitionReserveFor(targetSeconds: number, workOccurrences: number, raceSimulation: boolean) {
  if (!raceSimulation || workOccurrences <= 1) return 0;
  return Math.max(0, Math.min(Math.round(targetSeconds * 0.055), (workOccurrences - 1) * 25));
}

function referenceRaceSimulationTargetSeconds(template: WorkoutTemplate) {
  let movementSeconds = 0;
  let fixedSeconds = 0;
  let workOccurrences = 0;
  let runOrdinal = 0;

  for (const block of template.blocks) {
    const phase = classifyWorkoutPhase(block.title, block.steps[0]?.name, block.steps[0]?.detail);
    fixedSeconds += structuredWorkSeconds(block, phase);
    if (phase !== "work" || ["interval", "tabata", "emom", "amrap"].includes(block.type)) continue;
    block.steps.forEach((step, stepIndex) => {
      const count = occurrenceCount(block, stepIndex);
      if (!count) return;
      const text = normalizedWorkoutText(step.name, step.detail, step.exerciseId);
      const reference = referencePacingSeconds({
        name: step.name,
        detail: step.detail,
        exerciseId: step.exerciseId,
        runOrdinal: isRunText(text) ? runOrdinal : undefined,
      });
      movementSeconds += reference * count;
      workOccurrences += count;
      if (isRunText(text)) runOrdinal += count;
    });
  }

  const raw = Math.max(5 * 60, Math.round(movementSeconds + fixedSeconds));
  const transition = transitionReserveFor(Math.round(raw / 0.945), workOccurrences, true);
  return Math.max(5 * 60, Math.round(raw + transition));
}

export function recommendedWorkoutTargetSeconds(template: WorkoutTemplate) {
  if (template.metadata?.category === "race-simulation") return referenceRaceSimulationTargetSeconds(template);

  const expectedMinutes = template.metadata
    ? (template.metadata.expectedDurationMin + template.metadata.expectedDurationMax) / 2
    : template.durationMinutes;

  let excludedMinutes = 0;
  for (const block of template.blocks) {
    const phase = classifyWorkoutPhase(block.title, block.steps[0]?.name, block.steps[0]?.detail);
    if (phase === "work") continue;
    const parsed = parseMinutes(`${block.title} ${block.steps.map((step) => `${step.name} ${step.detail}`).join(" ")}`);
    excludedMinutes += parsed ?? 5;
  }

  return Math.max(5 * 60, Math.round((expectedMinutes - excludedMinutes) * 60));
}

function paceLabel(step: WorkoutStep, movementTargetSeconds: number | undefined) {
  if (!movementTargetSeconds) return undefined;
  const text = normalizedWorkoutText(step.name, step.detail, step.exerciseId);
  const distance = parseDistanceMeters(step);
  if (distance && (isSkiText(text) || isRowText(text))) {
    const per500 = Math.max(1, Math.round(movementTargetSeconds * 500 / distance));
    const minutes = Math.floor(per500 / 60);
    const seconds = String(per500 % 60).padStart(2, "0");
    return `${minutes}:${seconds} / 500 m`;
  }
  if (distance && isRunText(text) && distance >= 400) {
    const perKm = Math.max(1, Math.round(movementTargetSeconds * 1000 / distance));
    const minutes = Math.floor(perKm / 60);
    const seconds = String(perKm % 60).padStart(2, "0");
    return `${minutes}:${seconds} / km`;
  }
  return undefined;
}

function formatShort(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function workCue(step: WorkoutStep, targetSeconds: number | undefined, movementTargetSeconds: number | undefined, transitionSeconds: number, runningTarget?: string) {
  const text = normalizedWorkoutText(step.name, step.detail, step.exerciseId);
  const pace = paceLabel(step, movementTargetSeconds);
  const target = targetSeconds ? `Cíl úseku cca ${formatShort(targetSeconds)}.` : "";
  const transition = transitionSeconds > 0 ? ` Počítá s cca ${formatShort(transitionSeconds)} na přesun/přechod.` : "";
  if (isRunText(text) && runningTarget) return `${target}${transition} ${pace ? `Tempo pohybu ${pace}. ` : ""}${runningTarget}`.trim();
  if (isSkiText(text) || isRowText(text)) return `${target}${transition} ${pace ? `Tempo pohybu ${pace}. ` : ""}Začni kontrolovaně a drž stejný záběr až do konce.`.trim();
  return `${target}${transition} Drž tempo, které dokážeš zopakovat bez výrazného propadu techniky.`.trim();
}

export function buildWorkoutPacingPlan(template: WorkoutTemplate, targetOverrideSeconds?: number): WorkoutPacingPlan {
  const requestedTargetSeconds = Math.max(5 * 60, Math.round(targetOverrideSeconds ?? recommendedWorkoutTargetSeconds(template)));
  const manualCandidates: Array<{ block: WorkoutBlock; step: WorkoutStep; count: number; weight: number }> = [];
  let fixedSeconds = 0;
  let runOrdinal = 0;
  let workOccurrences = 0;

  for (const block of template.blocks) {
    const phase = classifyWorkoutPhase(block.title, block.steps[0]?.name, block.steps[0]?.detail);
    fixedSeconds += structuredWorkSeconds(block, phase);
    if (phase !== "work" || ["interval", "tabata", "emom", "amrap"].includes(block.type)) continue;
    block.steps.forEach((step, stepIndex) => {
      const count = occurrenceCount(block, stepIndex);
      if (count <= 0) return;
      const text = normalizedWorkoutText(step.name, step.detail, step.exerciseId);
      const weight = referencePacingSeconds({ name: step.name, detail: step.detail, exerciseId: step.exerciseId, runOrdinal: isRunText(text) ? runOrdinal : undefined });
      manualCandidates.push({ block, step, count, weight });
      workOccurrences += count;
      if (isRunText(text)) runOrdinal += count;
    });
  }

  const raceSimulation = template.metadata?.category === "race-simulation";
  const minimumManualSeconds = manualCandidates.reduce((sum, candidate) => sum + candidate.count * 15, 0);
  const effectiveTargetSeconds = Math.max(requestedTargetSeconds, fixedSeconds + minimumManualSeconds);
  const transitionReserveSeconds = transitionReserveFor(effectiveTargetSeconds, workOccurrences, raceSimulation);
  const distributable = Math.max(0, effectiveTargetSeconds - fixedSeconds - transitionReserveSeconds);
  const totalWeight = manualCandidates.reduce((sum, candidate) => sum + candidate.weight * candidate.count, 0) || 1;
  const transitionPerOccurrence = workOccurrences > 1 ? transitionReserveSeconds / (workOccurrences - 1) : 0;
  const manualTargets = new Map<string, { movement: number; total: number; transition: number }>();

  manualCandidates.forEach((candidate, index) => {
    const movement = Math.max(15, Math.round(candidate.weight / totalWeight * distributable));
    const transition = index === 0 ? 0 : Math.round(transitionPerOccurrence);
    manualTargets.set(`${candidate.block.id}:${candidate.step.id}`, { movement, total: movement + transition, transition });
  });

  const steps: Record<string, WorkoutPacingStep> = {};
  for (const block of template.blocks) {
    const blockPhase = classifyWorkoutPhase(block.title, block.steps[0]?.name, block.steps[0]?.detail);
    block.steps.forEach((step) => {
      const phase = classifyWorkoutPhase(block.title, step.name, step.detail);
      const manual = manualTargets.get(`${block.id}:${step.id}`);
      let movementTargetSeconds = manual?.movement;
      let transitionSeconds = manual?.transition ?? 0;
      let targetSeconds = manual?.total;
      if (phase === "work" && (block.type === "interval" || block.type === "tabata")) {
        targetSeconds = block.workSeconds;
        movementTargetSeconds = block.workSeconds;
        transitionSeconds = 0;
      }
      if (phase === "work" && block.type === "emom") {
        targetSeconds = 60;
        movementTargetSeconds = 60;
        transitionSeconds = 0;
      }
      if (phase === "work" && block.type === "amrap") {
        targetSeconds = Math.max(1, block.minutes) * 60;
        movementTargetSeconds = targetSeconds;
        transitionSeconds = 0;
      }
      const cue = phase === "warmup"
        ? "Rozcvičení připravuje výkon a do porovnatelného workout času se nepočítá."
        : phase === "cooldown"
          ? "Zklidnění patří do celkového času tréninku, ne do výsledného workout času."
          : block.type === "amrap"
            ? `Pacing řídí celý ${block.minutes}min AMRAP. Začni tak, aby poslední třetina nebyla výrazně pomalejší než první.`
            : workCue(step, targetSeconds, movementTargetSeconds, transitionSeconds, template.metadata?.runningTarget);
      steps[`${block.id}:${step.id}`] = {
        blockId: block.id,
        stepId: step.id,
        phase: blockPhase === "work" ? phase : blockPhase,
        targetSeconds,
        movementTargetSeconds,
        transitionSeconds,
        paceLabel: paceLabel(step, movementTargetSeconds),
        cue,
      };
    });
  }

  return { targetWorkoutSeconds: effectiveTargetSeconds, transitionReserveSeconds, steps };
}

export function workoutPacingSummary(template: WorkoutTemplate, targetOverrideSeconds?: number) {
  const plan = buildWorkoutPacingPlan(template, targetOverrideSeconds);
  const targetMinutes = Math.round(plan.targetWorkoutSeconds / 60);
  return {
    targetSeconds: plan.targetWorkoutSeconds,
    transitionReserveSeconds: plan.transitionReserveSeconds,
    title: `Orientační cíl pracovní části: ${targetMinutes} min`,
    running: template.metadata?.runningTarget,
    targetRpe: template.metadata ? `${template.metadata.targetRpeMin}–${template.metadata.targetRpeMax}/10` : undefined,
  };
}

function appendPacing(detail: string, cue: string) {
  if (detail.includes("Pacing ·")) return detail;
  return `${detail}${detail.trim() ? "\n" : ""}Pacing · ${cue}`;
}

export function applyWorkoutPacingToTemplate(template: WorkoutTemplate): WorkoutTemplate {
  const plan = buildWorkoutPacingPlan(template);
  const summary = workoutPacingSummary(template);
  return {
    ...template,
    description: `${template.description}${template.description.trim() ? "\n" : ""}${summary.title}. Rozcvičení a zklidnění se do porovnatelného workout času nepočítají.`,
    blocks: template.blocks.map((block) => ({
      ...block,
      steps: block.steps.map((step) => {
        const entry = plan.steps[`${block.id}:${step.id}`];
        return entry ? { ...step, detail: appendPacing(step.detail, entry.cue) } : step;
      }),
    })) as WorkoutTemplate["blocks"],
  };
}

export function deriveWorkoutTiming(splits: StepSplit[], sessionSeconds: number): WorkoutTimingBreakdown {
  let warmupSeconds = 0;
  let workoutSeconds = 0;
  let cooldownSeconds = 0;
  for (const split of splits) {
    const phase = classifyWorkoutPhase(split.blockTitle ?? "", split.stepName ?? "", split.stepDetail ?? "");
    if (phase === "warmup") warmupSeconds += Math.max(0, split.durationSeconds);
    else if (phase === "cooldown") cooldownSeconds += Math.max(0, split.durationSeconds);
    else workoutSeconds += Math.max(0, split.durationSeconds);
  }
  const safeSessionSeconds = Math.max(0, Math.round(sessionSeconds));
  if (workoutSeconds === 0 && safeSessionSeconds > 0) workoutSeconds = Math.max(0, safeSessionSeconds - warmupSeconds - cooldownSeconds);
  return { sessionSeconds: safeSessionSeconds, warmupSeconds, workoutSeconds, cooldownSeconds };
}

export function pacingDeltaLabel(actualSeconds: number, targetSeconds: number) {
  const delta = Math.round(actualSeconds - targetSeconds);
  const tolerance = Math.max(15, Math.round(targetSeconds * 0.05));
  if (Math.abs(delta) <= tolerance) return "V cílovém pacing okně";
  return delta < 0
    ? `${formatShort(Math.abs(delta))} rychleji než pacing cíl`
    : `${formatShort(delta)} pomaleji než pacing cíl`;
}
