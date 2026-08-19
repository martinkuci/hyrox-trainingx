"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { TrainingLocationManager } from "@/components/planning/TrainingLocationManager";
import { useHyroxData } from "@/hooks/useHyroxData";
import { planTrainingLocationChange } from "@/lib/training-location-change";
import type { TrainingLocationProfile } from "@/lib/types";

function TrainingLocationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, updateScheduledWorkout } = useHyroxData();
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

  return (
    <TrainingLocationManager
      startOpen={startOpen}
      onLocationCreated={handleLocationCreated}
    />
  );
}

export default function TrainingLocationsPage() {
  return (
    <PlanningShell
      eyebrow="Profil"
      title="Tréninková místa"
      description="Ulož si fitka a další místa podle skutečného vybavení. Když sem přijdeš z konkrétního tréninku, nové místo se po uložení rovnou použije."
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
