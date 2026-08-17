import type {
  ScheduledWorkout,
  TrainingAdaptationDirection,
  WorkoutMetadata,
  WorkoutResult,
  WorkoutTemplate,
} from "./types";

export type TrainingAdaptationRecommendation = {
  resultId: string;
  direction: TrainingAdaptationDirection;
  title: string;
  rationale: string;
  targetScheduleId?: string;
  currentTemplateId?: string;
  recommendedTemplateId?: string;
};

type AdaptationInput = {
  results: readonly WorkoutResult[];
  templates: readonly WorkoutTemplate[];
  scheduledWorkouts: readonly ScheduledWorkout[];
};

type LoadSignal = "high" | "target" | "low";

function validRpe(value: number) {
  return Number.isFinite(value) && value >= 1 && value <= 10;
}

function resultMetadata(result: WorkoutResult, templatesById: ReadonlyMap<string, WorkoutTemplate>) {
  return result.metadataSnapshot ?? templatesById.get(result.templateId)?.metadata;
}

function averageBlockRating(result: WorkoutResult) {
  const values = result.blockFeedbacks?.map((feedback) => feedback.rating) ?? [];
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function loadSignal(result: WorkoutResult, metadata: WorkoutMetadata): LoadSignal {
  const averageRating = averageBlockRating(result);
  if ((validRpe(result.rpe) && result.rpe > metadata.targetRpeMax) || (averageRating !== null && averageRating <= 1.5)) {
    return "high";
  }
  if ((validRpe(result.rpe) && result.rpe < metadata.targetRpeMin) || (averageRating !== null && averageRating >= 4.5)) {
    return "low";
  }
  return "target";
}

function difficulty(template: WorkoutTemplate) {
  return template.metadata?.difficultyLevel ?? 1;
}

function chooseAlternative(
  current: WorkoutTemplate,
  templates: readonly WorkoutTemplate[],
  direction: Exclude<TrainingAdaptationDirection, "maintain">,
) {
  const metadata = current.metadata;
  if (!metadata) return undefined;
  const desired = difficulty(current) + (direction === "increase" ? 1 : -1);
  if (desired < 1 || desired > 3) return undefined;
  const eligible = templates.filter((template) =>
    template.id !== current.id &&
    template.metadata?.category === metadata.category &&
    difficulty(template) === desired,
  );
  return [...eligible].sort((left, right) => {
    const leftSameGroup = left.metadata?.progressionGroup === metadata.progressionGroup ? 0 : 1;
    const rightSameGroup = right.metadata?.progressionGroup === metadata.progressionGroup ? 0 : 1;
    if (leftSameGroup !== rightSameGroup) return leftSameGroup - rightSameGroup;
    return (left.metadata?.workoutCode ?? left.title).localeCompare(
      right.metadata?.workoutCode ?? right.title,
      "cs",
    );
  })[0];
}

function baseRecommendation(
  result: WorkoutResult,
  direction: TrainingAdaptationDirection,
  title: string,
  rationale: string,
): TrainingAdaptationRecommendation {
  return { resultId: result.id, direction, title, rationale };
}

export function buildTrainingAdaptation({
  results,
  templates,
  scheduledWorkouts,
}: AdaptationInput): TrainingAdaptationRecommendation | null {
  const latest = [...results]
    .filter((result) => Number.isFinite(Date.parse(result.completedAt)))
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
  if (!latest || latest.adaptationDecision) return null;

  const templatesById = new Map(templates.map((template) => [template.id, template]));
  const metadata = resultMetadata(latest, templatesById);
  if (!metadata || !validRpe(latest.rpe)) return null;
  const latestSignal = loadSignal(latest, metadata);

  let direction: TrainingAdaptationDirection = "maintain";
  let title = "Zátěž odpovídá plánu";
  let rationale = `RPE ${latest.rpe} je v cílovém rozmezí ${metadata.targetRpeMin}–${metadata.targetRpeMax}.`;

  if (latestSignal === "high") {
    direction = "reduce";
    title = "Příště o stupeň lehčeji";
    rationale = `RPE ${latest.rpe} nebo hodnocení bloků ukazuje vyšší zátěž než plán ${metadata.targetRpeMin}–${metadata.targetRpeMax}.`;
  } else if (latestSignal === "low") {
    const previousComparable = [...results]
      .filter((result) => result.id !== latest.id && result.completedAt < latest.completedAt)
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .find((result) => resultMetadata(result, templatesById)?.category === metadata.category);
    const previousMetadata = previousComparable
      ? resultMetadata(previousComparable, templatesById)
      : undefined;
    if (previousComparable && previousMetadata && loadSignal(previousComparable, previousMetadata) === "low") {
      direction = "increase";
      title = "Můžeš zkusit o stupeň výš";
      rationale = `Dva poslední tréninky kategorie ${metadata.category} byly lehčí než jejich cílové RPE.`;
    } else {
      title = "Ještě jeden kontrolní trénink";
      rationale = `RPE ${latest.rpe} bylo pod cílem ${metadata.targetRpeMin}–${metadata.targetRpeMax}. Pro bezpečné zvýšení obtížnosti počkáme na druhý podobný výsledek.`;
    }
  }

  if (direction === "maintain") return baseRecommendation(latest, direction, title, rationale);

  const sourceSchedule = latest.scheduledWorkoutId
    ? scheduledWorkouts.find((schedule) => schedule.id === latest.scheduledWorkoutId)
    : undefined;
  if (!sourceSchedule?.programId) {
    return baseRecommendation(latest, direction, title, `${rationale} Výsledek není součástí aktivního programu, takže plán zůstává beze změny.`);
  }

  const sourceOrder = `${sourceSchedule.date}T${sourceSchedule.time}`;
  const target = [...scheduledWorkouts]
    .filter((schedule) => {
      if (schedule.programId !== sourceSchedule.programId || schedule.status !== "planned" || schedule.originalTemplateId) return false;
      if (`${schedule.date}T${schedule.time}` <= sourceOrder) return false;
      return templatesById.get(schedule.templateId)?.metadata?.category === metadata.category;
    })
    .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`))[0];
  const currentTemplate = target ? templatesById.get(target.templateId) : undefined;
  const alternative = currentTemplate ? chooseAlternative(currentTemplate, templates, direction) : undefined;

  if (!target || !currentTemplate || !alternative) {
    return baseRecommendation(latest, direction, title, `${rationale} V dalším programu není vhodná ${direction === "reduce" ? "lehčí" : "těžší"} varianta stejné kategorie.`);
  }

  return {
    resultId: latest.id,
    direction,
    title,
    rationale,
    targetScheduleId: target.id,
    currentTemplateId: currentTemplate.id,
    recommendedTemplateId: alternative.id,
  };
}
