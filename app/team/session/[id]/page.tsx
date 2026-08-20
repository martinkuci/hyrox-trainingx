"use client";

import { useParams } from "next/navigation";
import TeamWorkoutSession from "@/components/TeamWorkoutSession";

export default function TeamSessionPage() {
  const params = useParams<{ id: string }>();
  return <TeamWorkoutSession sessionId={decodeURIComponent(params.id).toUpperCase()} />;
}
