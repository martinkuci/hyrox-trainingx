import type { TeamStepAssignment, TeamWorkoutFormat } from "./team-training";
import type { WorkoutTemplate } from "./types";

export type TeamWorkoutPhase = "warmup" | "work" | "cooldown";

export type TeamPacingEntry = {
  assignmentId: string;
  targetSeconds?: number;
  cue: string;
  splitSuggestion?: string;
};

function normalized(...values: Array<string | undefined>) {
  return values
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

export function classifyTeamWorkoutPhase(
  blockTitle: string,
  stepName: string,
  stepDetail: string,
  category?: string,
): TeamWorkoutPhase {
  if (["warmup", "mobility", "compensation"].includes(category ?? "")) return "warmup";
  if (category === "recovery") return "cooldown";
  const text = normalized(blockTitle, stepName, stepDetail);
  if (["zklid", "cooldown", "cool-down", "regener", "recovery", "vychozeni", "prota"].some((token) => text.includes(token))) return "cooldown";
  if (["rozcvi", "warmup", "warm-up", "mobilit", "aktivac", "rozbehani"].some((token) => text.includes(token))) return "warmup";
  return "work";
}

export function phaseForAssignment(assignment: TeamStepAssignment) {
  return classifyTeamWorkoutPhase(assignment.blockTitle, assignment.stepName, assignment.stepDetail ?? "");
}

export function recommendedWorkoutTargetSeconds(template: WorkoutTemplate) {
  const expectedMinutes = template.metadata
    ? (template.metadata.expectedDurationMin + template.metadata.expectedDurationMax) / 2
    : template.durationMinutes;

  let excludedMinutes = 0;
  for (const block of template.blocks) {
    const phase = classifyTeamWorkoutPhase(block.title, block.steps[0]?.name ?? "", block.steps[0]?.detail ?? "");
    if (phase === "work") continue;
    const parsed = parseMinutes(`${block.title} ${block.steps.map((step) => `${step.name} ${step.detail}`).join(" ")}`);
    excludedMinutes += parsed ?? 5;
  }

  return Math.max(5 * 60, Math.round((expectedMinutes - excludedMinutes) * 60));
}

function assignmentWeight(assignment: TeamStepAssignment) {
  const text = normalized(assignment.exerciseId, assignment.stepName, assignment.stepDetail);
  if (phaseForAssignment(assignment) !== "work") return 0;
  if (assignment.targetDistanceMeters) {
    if (text.includes("run") || text.includes("beh")) return Math.max(45, assignment.targetDistanceMeters * 0.30);
    if (text.includes("ski") || text.includes("row") || text.includes("vesl")) return Math.max(40, assignment.targetDistanceMeters * 0.24);
    if (text.includes("burpee") || text.includes("broad jump")) return Math.max(45, assignment.targetDistanceMeters * 3.2);
    if (text.includes("carry") || text.includes("lunge") || text.includes("vypad")) return Math.max(40, assignment.targetDistanceMeters * 1.8);
    return Math.max(45, assignment.targetDistanceMeters * 0.8);
  }
  if (assignment.targetReps) {
    if (text.includes("burpee")) return Math.max(40, assignment.targetReps * 4);
    if (text.includes("wall-ball") || text.includes("wall ball")) return Math.max(35, assignment.targetReps * 2.2);
    if (text.includes("lunge") || text.includes("vypad")) return Math.max(35, assignment.targetReps * 2.1);
    return Math.max(35, assignment.targetReps * 2.5);
  }
  return 75;
}

function niceShare(value: number, target: number) {
  const step = target <= 50 ? 5 : target <= 200 ? 10 : target <= 1000 ? 25 : target <= 2000 ? 50 : 100;
  return Math.max(step, Math.round(value / step) * step);
}

export function suggestedTeamSplit(assignment: TeamStepAssignment, participantCount: number) {
  const people = Math.max(1, participantCount);
  if (assignment.targetDistanceMeters && people > 1) {
    const share = niceShare(assignment.targetDistanceMeters / people, assignment.targetDistanceMeters);
    return `Výchozí rozdělení: cca ${share} m na osobu. Předávej dřív jen při poklesu tempa.`;
  }
  if (assignment.targetReps && people > 1) {
    const share = Math.max(1, Math.round(assignment.targetReps / people));
    return `Výchozí rozdělení: cca ${share} opakování na osobu. Série můžeš upravit podle únavy.`;
  }
  return undefined;
}

export function buildTeamPacingPlan({
  assignments,
  targetWorkoutSeconds,
  participantCount,
  runningTarget,
  format,
}: {
  assignments: TeamStepAssignment[];
  targetWorkoutSeconds: number;
  participantCount: number;
  runningTarget?: string;
  format: TeamWorkoutFormat;
}): Record<string, TeamPacingEntry> {
  const workAssignments = assignments.filter((assignment) => phaseForAssignment(assignment) === "work");
  const totalWeight = workAssignments.reduce((sum, assignment) => sum + assignmentWeight(assignment), 0) || 1;
  const entries: Record<string, TeamPacingEntry> = {};

  for (const assignment of assignments) {
    const phase = phaseForAssignment(assignment);
    if (phase !== "work") {
      entries[assignment.id] = {
        assignmentId: assignment.id,
        cue: phase === "warmup"
          ? "Rozcvičení se synchronizuje, ale nepočítá se do workout času."
          : "Cooldown patří do celkového času tréninku, ne do výsledku workoutu.",
      };
      continue;
    }

    const targetSeconds = Math.max(15, Math.round((assignmentWeight(assignment) / totalWeight) * targetWorkoutSeconds));
    const text = normalized(assignment.exerciseId, assignment.stepName);
    let cue = `Orientační cíl úseku ${Math.floor(targetSeconds / 60)}:${String(targetSeconds % 60).padStart(2, "0")}.`;
    if ((text.includes("run") || text.includes("beh")) && runningTarget) cue += ` ${runningTarget}`;
    else if (text.includes("ski") || text.includes("row") || text.includes("vesl")) cue += " Drž rovnoměrné /500 m a nepřepal první záběry.";
    else cue += " Drž tempo, které zvládneš zopakovat bez výrazného propadu techniky.";

    const splitSuggestion = format === "doubles" ? suggestedTeamSplit(assignment, participantCount) : undefined;
    entries[assignment.id] = { assignmentId: assignment.id, targetSeconds, cue, splitSuggestion };
  }

  return entries;
}

export function workoutPacingSummary(template: WorkoutTemplate, format: TeamWorkoutFormat, participantCount: number) {
  const targetSeconds = recommendedWorkoutTargetSeconds(template);
  const targetMinutes = Math.round(targetSeconds / 60);
  const running = template.metadata?.runningTarget;
  const formatCue = format === "doubles"
    ? `Enginn navrhne výchozí dělení vzdáleností a opakování mezi ${Math.max(2, participantCount)} sportovce.`
    : format === "relay"
      ? "Pacing se rozdělí podle pořadí štafety a cílového času úseků."
      : "Každý drží vlastní tempo, ale tým vidí společný průběh.";
  return {
    targetSeconds,
    title: `Orientační workout cíl: ${targetMinutes} min`,
    running,
    formatCue,
  };
}
