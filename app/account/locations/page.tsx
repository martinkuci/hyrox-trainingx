"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { TrainingLocationManager } from "@/components/planning/TrainingLocationManager";
import { useHyroxData } from "@/hooks/useHyroxData";
import {
  planRemainingProgramLocationChange,
  planTrainingLocationChange,
} from "@/lib/training-location-change";
import type { TrainingLocationProfile } from "@/lib/types";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function TrainingLocationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    data,
    updateScheduledWorkout,
    updateScheduledWorkouts,
    updateTrainingProgram,
  } = useHyroxData();
  const startOpen = searchParams.get("new") === "1";

  function handleLocationCreated(location: TrainingLocationProfile) {
    const scheduleId = searchParams.get("scheduleId");
    const returnTo = searchParams.get("returnTo");
    if (!scheduleId) return;

    const schedule = data.scheduledWorkouts.find((item) => item.id === scheduleId);
    const currentTemplate = schedule
      ? data.templates.find((item) => item.id === schedule.templateId)
      : undefined;
    if (!schedule || !currentTemplate) {
      router.replace(returnTo || "/");
      return;
    }

    const program = schedule.programId
      ? data.trainingPrograms.find((item) => item.id === schedule.programId)
      : undefined;
    const phase = schedule.programWeek
      ? program?.weeks.find((week) => week.weekNumber === schedule.programWeek)?.phase
      : undefined;
    const customLocations = [...(data.trainingLocations ?? []), location];
    const plan = planTrainingLocationChange({
      schedule,
      currentTemplate,
      templates: data.templates,
      location: location.id,
      customLocations,
      phase,
    });

    updateScheduledWorkout(schedule.id, plan.updates);
    router.replace(returnTo || `/calendar/program?scheduleId=${schedule.id}`);
  }

  function applyToRemainingProgram(location: TrainingLocationProfile) {
    const today = localDateKey(new Date());
    const nextProgramSchedule = [...data.scheduledWorkouts]
      .filter((item) => item.status === "planned" && item.programId && item.date >= today)
      .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`))[0];
    const program = nextProgramSchedule?.programId
      ? data.trainingPrograms.find((item) => item.id === nextProgramSchedule.programId)
      : undefined;

    if (!program) {
      return "Nemáš žádný aktivní program s budoucími naplánovanými jednotkami.";
    }

    const remainingCount = data.scheduledWorkouts.filter((item) => (
      item.programId === program.id
      && item.status === "planned"
      && item.date >= today
    )).length;
    if (remainingCount === 0) {
      return "V aktivním programu už nejsou žádné budoucí naplánované jednotky.";
    }

    const confirmed = window.confirm(
      `Nastavit „${location.name}“ jako výchozí místo pro zbývajících ${remainingCount} jednotek programu „${program.name}“? Enginn podle vybavení automaticky upraví workouty, které tam nejdou odcvičit. Jednotlivé dny můžeš později znovu změnit.`,
    );
    if (!confirmed) return;

    const plan = planRemainingProgramLocationChange({
      program,
      schedules: data.scheduledWorkouts,
      templates: data.templates,
      location: location.id,
      customLocations: data.trainingLocations ?? [],
      fromDate: today,
    });

    if (plan.updates.length > 0) updateScheduledWorkouts(plan.updates);
    updateTrainingProgram(program.id, { trainingLocationIds: [location.id] });

    const adaptedText = plan.adapted > 0
      ? ` ${plan.adapted} jednotek Enginn automaticky přizpůsobil vybavení.`
      : "";
    const unresolvedText = plan.unresolved > 0
      ? ` U ${plan.unresolved} jednotek zatím v katalogu není plně kompatibilní varianta.`
      : "";
    return `Místo „${location.name}“ je nastavené pro ${plan.updates.length} zbývajících jednotek programu.${adaptedText}${unresolvedText}`;
  }

  return (
    <TrainingLocationManager
      startOpen={startOpen}
      onLocationCreated={handleLocationCreated}
      onApplyToRemainingProgram={applyToRemainingProgram}
    />
  );
}

export default function TrainingLocationsPage() {
  return (
    <PlanningShell
      eyebrow="Profil"
      title="Tréninková místa"
      description="Ulož si fitka a další místa podle skutečného vybavení. Místo můžeš použít jen pro jeden trénink, nebo ho jedním krokem nastavit pro celý zbytek aktivního programu."
      backHref="/account"
    >
      <div className="mx-auto max-w-2xl">
        <Suspense fallback={<section className="ui-card mt-5 h-40 animate-pulse" aria-label="Načítám tréninková místa" />}>
          <TrainingLocationsContent />
        </Suspense>
      </div>
    </PlanningShell>
  );
}
