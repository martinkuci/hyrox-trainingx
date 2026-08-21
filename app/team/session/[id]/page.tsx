"use client";

import { useParams } from "next/navigation";
import TeamWorkoutSessionCompact from "@/components/TeamWorkoutSessionCompact";

export default function TeamSessionPage() {
  const params = useParams<{ id: string }>();
  return <TeamWorkoutSessionCompact sessionId={decodeURIComponent(params.id).toUpperCase()} />;
}
