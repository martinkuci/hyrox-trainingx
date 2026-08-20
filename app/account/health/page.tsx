"use client";

import { useEffect, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import {
  HEALTH_METRICS,
  getHealthPlatformCopy,
  healthDataProvider,
  type HealthConnectionStatus,
} from "@/lib/health-data";

const platformCopy = getHealthPlatformCopy();

export default function HealthRecoveryPage() {
  const [status, setStatus] = useState<HealthConnectionStatus | null>(null);

  useEffect(() => {
    let active = true;
    healthDataProvider.getStatus().then((nextStatus) => {
      if (active) setStatus(nextStatus);
    });
    return () => {
      active = false;
    };
  }, []);

  const nativeAvailable = status?.available === true;

  return (
    <PlanningShell
      eyebrow="Zdraví"
      title="Zdraví & regenerace"
      description="Připravujeme bezpečné propojení Enginnu se zdravotními a fitness daty z telefonu a hodinek."
      backHref="/account"
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="ui-card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Připraveno pro mobilní aplikaci</p>
              <h2 className="mt-2 text-xl font-black">Jedna vrstva pro iPhone i Android</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Enginn už má připravené společné rozhraní pro zdravotní data. V čisté PWA zůstává připojení vypnuté; po zabalení přes Capacitor přidáme nativní konektory bez změny této obrazovky.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="ui-card p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">iPhone</p>
            <h2 className="mt-2 text-lg font-black">{platformCopy.apple.title}</h2>
            <p className="mt-1 text-xs font-bold text-zinc-500">{platformCopy.apple.technicalName}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{platformCopy.apple.description}</p>
            <div className="ui-feedback mt-4">
              <p className="text-sm font-black">{nativeAvailable && status?.platform === "apple-health" ? "Připraveno k autorizaci" : "Dostupné po instalaci iOS aplikace"}</p>
            </div>
          </section>

          <section className="ui-card p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Android</p>
            <h2 className="mt-2 text-lg font-black">{platformCopy.android.title}</h2>
            <p className="mt-1 text-xs font-bold text-zinc-500">{platformCopy.android.technicalName}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{platformCopy.android.description}</p>
            <div className="ui-feedback mt-4">
              <p className="text-sm font-black">{nativeAvailable && status?.platform === "health-connect" ? "Připraveno k autorizaci" : "Dostupné po instalaci Android aplikace"}</p>
            </div>
          </section>
        </div>

        <section className="ui-card p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Budoucí vstupy</p>
          <h2 className="mt-2 text-xl font-black">Jaká data bude Enginn umět využít</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Každý typ dat bude vyžadovat samostatný souhlas uživatele. Enginn bude číst pouze metriky potřebné pro trénink, regeneraci a dlouhodobé trendy.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {HEALTH_METRICS.map((metric) => (
              <article key={metric.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{metric.label}</p>
                    <p className="mt-1 text-xs font-bold text-zinc-500">{metric.shortLabel}{metric.unit ? ` · ${metric.unit}` : ""}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">později</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{metric.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ui-card p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Směr Enginn</p>
          <h2 className="mt-2 text-xl font-black">Od dat k doporučení, ne k diagnóze</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            V dalších fázích mohou trendy spánku, HRV, klidového tepu a tréninkové zátěže pomáhat upravovat intenzitu nebo nabídnout lehčí variantu tréninku. Enginn nebude zdravotní data prezentovat jako lékařskou diagnózu.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="text-sm font-black">Readiness</p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">Připravenost na plánovanou zátěž.</p>
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="text-sm font-black">Recovery</p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">Trend regenerace a spánku.</p>
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="text-sm font-black">Training load</p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">Kontext objemu a intenzity tréninku.</p>
            </div>
          </div>
        </section>

        <p className="px-2 text-center text-xs leading-5 text-zinc-600">
          Zdravotní data se v této PWA zatím nenačítají ani neukládají. Připojení aktivujeme až v nativní verzi Enginnu a vždy pouze se souhlasem uživatele.
        </p>
      </div>
    </PlanningShell>
  );
}
