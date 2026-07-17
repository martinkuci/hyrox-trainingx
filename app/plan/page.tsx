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
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
  const nextTemplate = next ? data.templates.find((item) => item.id === next.templateId) : undefined;

  return (
    <PlanningShell eyebrow="Plán" title="Tréninkový plán" description="Kalendář, programy a dostupnost jsou na jednom místě." backHref="/">
      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/programs" className="rounded-3xl border border-lime-400/20 bg-zinc-900 p-6 transition active:scale-[0.99]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Program</p>
          <h2 className="mt-2 text-2xl font-black">Vytvořit nový plán</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Vyber cíl, délku, frekvenci a dostupné dny. Aplikace sestaví program automaticky.</p>
          <div className="mt-