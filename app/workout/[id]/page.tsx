"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import WorkoutRunner from "@/components/WorkoutRunner";
import { useHyroxData } from "@/hooks/useHyroxData";

function WorkoutPageContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data, ready } = useHyroxData();
  const template = data.templates.find((item) => item.id === params.id);
  const scheduleId = searchParams.get("scheduleId") ?? undefined;

  if (!ready) {
    return (
      <main className="runner-shell grid min-h-dvh place-items-center text-zinc-400">
        Načítám trénink…
      </main>
    );
  }

  if (!template) {
    return (
      <main className="runner-shell grid min-h-dvh place-items-center p-5 text-white">
        <section className="ui-card w-full max-w-sm p-7 text-center">
          <h1 className="text-2xl font-bold">Trénink nebyl nalezen</h1>
          <p className="mt-3 text-zinc-400">Možná byl mezitím smazán.</p>
          <Link
            href="/"
            className="ui-button ui-button-primary mt-7 w-full"
          >
            Zpět na přehled
          </Link>
        </section>
      </main>
    );
  }

  return <WorkoutRunner template={template} scheduledWorkoutId={scheduleId} />;
}

export default function WorkoutPage() {
  return (
    <Suspense
      fallback={
        <main className="runner-shell grid min-h-dvh place-items-center text-zinc-400">
          Načítám trénink…
        </main>
      }
    >
      <WorkoutPageContent />
    </Suspense>
  );
}

