import type { StepSplit, WorkoutBlock, WorkoutStep, WorkoutTemplate } from "./types";

export type WorkoutPacingPhase = "warmup" | "work" | "cooldown";

export type WorkoutPacingStep = {
  blockId: string;
  stepId: string;
  phase: WorkoutPacingPhase;
  targetSeconds?: number;
  paceLabel?: string;
  cue: string;
};

export type WorkoutPacingPlan = {
  targetWorkoutSeconds: number;
  steps: Record<string, WorkoutPacingStep>;
};

export type WorkoutTimingBreakdown = {
  sessionSeconds: number;
  warmupSeconds: number;
  workoutSeconds: number;
  cooldownSeconds: number;
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

export function recommendedWorkoutTargetSeconds(template: WorkoutTemplate) {
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

function parseDistanceMeters(step: WorkoutStep) {
  const text = normalizedWorkoutText(step.name, step.detail).replace(/,/g, ".");
  const km = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*km\b/);
  if (km) return Math.round(Number(km[1]) * 1000);
  const meters = text.match(/(?:^|\s)(\d{1,5})\s*m(?:\s|$)/);
  return meters ? Number(meters[1]) : undefined;
}

function parseReps(step: WorkoutStep) {
  const text = normalizedWorkoutText(step.name, step.detail);
  const explicit = text.match(/(?:^|\s)(\d{1,4})\s*(?:x|rep(?:s)?|opakovani)(?:\s|$)/);
  if (explicit) return Number(explicit[1]);
  const leading = step.name.match(/^\s*(\d{1,4})\b/);
  return leading ? Number(leading[1]) : undefined;
}

function stepWeight(step: WorkoutStep) {
  const text = normalizedWorkoutText(step.name, step.detail, step.exerciseId);
  const distance = parseDistanceMeters(step);
  const reps = parseReps(step);
  if (distance) {
    if (text.includes("run") || text.includes("beh")) return Math.max(45, distance * 0.30);
    if (text.includes("ski") || text.includes("row") || text.includes("vesl")) return Math.max(40, distance * 0.24);
    if (text.includes("burpee") || text.includes("broad jump")) return Math.max(45, distance * 3.2);
    if (text.includes("carry") || text.includes("lunge") || text.includes("vypad")) return Math.max(40, distance * 1.8);
    return Math.max(45, distance * 0.8);
  }
  if (reps) {
    if (text.includes("burpee")) return Math.max(40, reps * 4);
    if (text.includes("wall-ball") || text.includes("wall ball")) return Math.max(35, reps * 2.2);
    if (text.includes("lunge") || text.includes("vypad")) return Math.max(35, reps * 2.1);
    return Math.max(35, reps * 2.5);
  }
  return 75;
}

function occurrenceCount(block: WorkoutBlock, stepIndex: number) {
  if (block.type === "manual") return Math.max(1, block.repeat);
  if (block.type === "for-time") return Math.max(1, block.rounds);
  if (block.type === "interval" || block.type === "tabata") {
    if (!block.steps.length) return 0;
    return Array.from({ length: block.rounds }, (_, round) => round % block.steps.length === stepIndex ? 1 : 0).reduce((sum, value) => sum + value, 0);
  }
  if (block.type === "emom") {
    if (!block.steps.length) return 0;
    return Array.from({ length: block.minutes }, (_, minute) => minute % block.steps.length === stepIndex ? 1 : 0).reduce((sum, value) => sum + value, 0);
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

function paceLabel(step: WorkoutStep, targetSeconds: number | undefined) {
  if (!targetSeconds) return undefined;
  const text = normalizedWorkoutText(step.name, step.detail, step.exerciseId);
  const distance = parseDistanceMeters(step);
  if (distance && (text.includes("ski") || text.includes("row") || text.includes("vesl"))) {
    const per500 = Math.max(1, Math.round(targetSeconds * 500 / distance));
    const minutes = Math.floor(per500 / 60);
    const seconds = String(per500 % 60).padStart(2, "0");
    return `${minutes}:${seconds} / 500 m`;
  }
  if (distance && (text.includes("run") || text.includes("beh")) && distance >= 400) {
    const perKm = Math.max(1, Math.round(targetSeconds * 1000 / distance));
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

function workCue(step: WorkoutStep, targetSeconds: number | undefined, runningTarget?: string) {
  const text = normalizedWorkoutText(step.name, step.detail, step.exerciseId);
  const pace = paceLabel(step, targetSeconds);
  const target = targetSeconds ? `Cíl úseku cca ${formatShort(targetSeconds)}.` : "";
  if ((text.includes("run") || text.includes("beh")) && runningTarget) return `${target} ${pace ? `Tempo ${pace}. ` : ""}${runningTarget}`.trim();
  if (text.includes("ski") || text.includes("row") || text.includes("vesl")) return `${target} ${pace ? `Tempo ${pace}. ` : ""}Začni kontrolovaně a drž stejný záběr až do konce.`.trim();
  return `${target} Drž tempo, které dokážeš zopakovat bez výrazného propadu techniky.`.trim();
}

export function buildWorkoutPacingPlan(template: WorkoutTemplate): WorkoutPacingPlan {
  const targetWorkoutSeconds = recommendedWorkoutTargetSeconds(template);
  const manualCandidates: Array<{ block: WorkoutBlock; step: WorkoutStep; count: number; weight: number }> = [];
  let fixedSeconds = 0;

  for (const block of template.blocks) {
    const phase = classifyWorkoutPhase(block.title, block.steps[0]?.name, block.steps[0]?.detail);
    fixedSeconds += structuredWorkSeconds(block, phase);
    if (phase !== "work" || ["interval", "tabata", "emom", "amrap"].includes(block.type)) continue;
    block.steps.forEach((step, stepIndex) => {
      const count = occurrenceCount(block, stepIndex);
      if (count > 0) manualCandidates.push({ block, step, count, weight: stepWeight(step) });
    });
  }

  const minimumManualSeconds = manualCandidates.reduce((sum, candidate) => sum + candidate.count * 15, 0);
  const effectiveTargetSeconds = Math.max(targetWorkoutSeconds, fixedSeconds + minimumManualSeconds);
  const distributable = Math.max(0, effectiveTargetSeconds - fixedSeconds);
  const totalWeight = manualCandidates.reduce((sum, candidate) => sum + candidate.weight * candidate.count, 0) || 1;
  const manualTargets = new Map<string, number>();
  for (const candidate of manualCandidates) {
    manualTargets.set(`${candidate.block.id}:${candidate.step.id}`, Math.max(15, Math.round(candidate.weight / totalWeight * distributable)));
  }

  const steps: Record<string, WorkoutPacingStep> = {};
  for (const block of template.blocks) {
    const blockPhase = classifyWorkoutPhase(block.title, block.steps[0]?.name, block.steps[0]?.detail);
    block.steps.forEach((step) => {
      const phase = classifyWorkoutPhase(block.title, step.name, step.detail);
      let targetSeconds = manualTargets.get(`${block.id}:${step.id}`);
      if (phase === "work" && (block.type === "interval" || block.type === "tabata")) targetSeconds = block.workSeconds;
      if (phase === "work" && block.type === "emom") targetSeconds = 60;
      if (phase === "work" && block.type === "amrap") targetSeconds = Math.max(1, block.minutes) * 60;
      const cue = phase === "warmup"
        ? "Rozcvičení připravuje výkon a do porovnatelného workout času se nepočítá."
        : phase === "cooldown"
          ? "Zklidnění patří do celkového času tréninku, ne do výsledného workout času."
          : block.type === "amrap"
            ? `Pacing řídí celý ${block.minutes}min AMRAP. Začni tak, aby poslední třetina nebyla výrazně pomalejší než první.`
            : workCue(step, targetSeconds, template.metadata?.runningTarget);
      steps[`${block.id}:${step.id}`] = {
        blockId: block.id,
        stepId: step.id,
        phase: blockPhase === "work" ? phase : blockPhase,
        targetSeconds,
        paceLabel: paceLabel(step, targetSeconds),
        cue,
      };
    });
  }

  return { targetWorkoutSeconds: effectiveTargetSeconds, steps };
}

export function workoutPacingSummary(template: WorkoutTemplate) {
  const plan = buildWorkoutPacingPlan(template);
  const targetMinutes = Math.round(plan.targetWorkoutSeconds / 60);
  return {
    targetSeconds: plan.targetWorkoutSeconds,
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
