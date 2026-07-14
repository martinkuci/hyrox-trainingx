import type { ScheduledWorkout } from "@/lib/types";

const statusStyles: Record<ScheduledWorkout["status"], string> = {
  planned: "bg-lime-400/10 text-lime-300 ring-lime-400/20",
  completed: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  skipped: "bg-zinc-700/70 text-zinc-300 ring-zinc-600",
};

const statusLabels: Record<ScheduledWorkout["status"], string> = {
  planned: "Naplánováno",
  completed: "Dokončeno",
  skipped: "Vynecháno",
};

export function StatusBadge({ status }: { status: ScheduledWorkout["status"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}


