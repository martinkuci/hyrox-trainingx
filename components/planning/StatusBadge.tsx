import type { ScheduledWorkout } from "@/lib/types";

const statusStyles: Record<ScheduledWorkout["status"], string> = {
  planned: "ui-chip-accent",
  completed: "ui-chip-success",
  skipped: "text-zinc-400",
};

const statusLabels: Record<ScheduledWorkout["status"], string> = {
  planned: "Naplánováno",
  completed: "Dokončeno",
  skipped: "Vynecháno",
};

export function StatusBadge({ status }: { status: ScheduledWorkout["status"] }) {
  return (
    <span
      className={`ui-chip ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}


