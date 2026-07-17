"use client";

import Link from "next/link";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";

export default function PlanPage() {
  const { data, ready } = useHyroxData();
  const planned = data.scheduledWorkouts.filter((item) => item.status === "planned").length;
  const programs = data.trainingPrograms.length;
  const next = [...data.scheduledWorkouts]
    .filter((item) => item.status === "planned")
    .sort((a, b) => `${