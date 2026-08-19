"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { TrainingLocationManager } from "@/components/planning/TrainingLocationManager";
import { useHyroxData } from "@/hooks/useHyroxData";
import { planTrainingLocationChange } from "@/lib/training-location-change";
import type { TrainingLocationProfile } from "@/lib/types";

export default function TrainingLocationsPage() {
  const router = useRouter();
  const { data, updateScheduledWorkout } = useHyroxData();
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStartOpen(params.get("new") === "1");
  }, []);

  function handleLocationCreated(location: TrainingLocationProfile) {
    const params = new URLSearchParams(window.location.search);
    const scheduleId = params.get("scheduleId");
    const returnTo = params.get("returnTo");
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
    <PlanningShell
      eyebrow="Profil"
      title="Tréninková místa"
      description="Ulož si fitka a další místa podle skutečného vybavení. Když sem přijdeš z konkrétního tréninku, nové místo se po uložení rovnou použije."
      backHref="/account"
    >
      <div className="mx-auto max-w-2xl">
        <TrainingLocationManager
          startOpen={startOpen}
          onLocationCreated={handleLocationCreated}
        />
      </div>
    </PlanningShell>
  );
}
