"use client";

import { useMemo, useState } from "react";
import WorkoutRecoveryRoutine from "@/components/WorkoutRecoveryRoutine";
import WorkoutRunner from "@/components/WorkoutRunner";
import { loadWorkoutCheckpoint, makeWorkoutKey } from "@/lib/workout-checkpoint";
import { loadPreWorkoutRecovery, savePreWorkoutRecovery } from "@/lib/workout-recovery-storage";
import type { EquipmentId, WorkoutTemplate } from "@/lib/types";

type Props = {
  template: WorkoutTemplate;
  scheduledWorkoutId?: string;
  recoveryEquipment: EquipmentId[];
  recoveryLocationLabel?: string;
};

export default function WorkoutExperience({
  template,
  scheduledWorkoutId,
  recoveryEquipment,
  recoveryLocationLabel,
}: Props) {
  const workoutKey = useMemo(() => makeWorkoutKey(template.id, scheduledWorkoutId), [scheduledWorkoutId, template.id]);
  const hasMainWorkoutCheckpoint = useMemo(() => {
    const checkpoint = loadWorkoutCheckpoint();
    return checkpoint?.workoutKey === workoutKey;
  }, [workoutKey]);
  const [preRecoveryFinished, setPreRecoveryFinished] = useState(
    () => Boolean(loadPreWorkoutRecovery(template.id, scheduledWorkoutId)) || hasMainWorkoutCheckpoint,
  );

  if (!preRecoveryFinished) {
    return (
      <main className="runner-shell safe-screen min-h-dvh px-4 text-white">
        <section className="mx-auto w-full max-w-md py-4">
          <WorkoutRecoveryRoutine
            template={template}
            equipment={recoveryEquipment}
            when="before"
            locationLabel={recoveryLocationLabel}
            seed={`${workoutKey}-pre`}
            defaultDuration={8}
            onComplete={(result) => {
              savePreWorkoutRecovery(template.id, scheduledWorkoutId, result);
              setPreRecoveryFinished(true);
            }}
            onSkip={() => setPreRecoveryFinished(true)}
          />
        </section>
      </main>
    );
  }

  return <WorkoutRunner template={template} scheduledWorkoutId={scheduledWorkoutId} />;
}
