"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EnginnMark, EnginnWordmark } from "@/components/EnginnBrand";
import {
  ONBOARDING_OPEN_EVENT,
  completeOnboarding,
  hasCompletedOnboarding,
} from "@/lib/onboarding-state";

const steps = [
  {
    eyebrow: "Vítej",
    title: "Hybridní trénink v kostce",
    description:
      "Hybridní trénink kombinuje běh, sílu a kondici. Enginn ti pomůže přípravu rozdělit do jasných jednotek a sledovat, jak je zvládáš.",
    points: ["Běh a funkční síla", "Trénink podle vlastní úrovně", "Důraz na tempo a pravidelnost"],
  },
  {
    eyebrow: "Jedna aplikace",
    title: "Plán, trénink i výsledky",
    description:
      "Vyber program, uprav kalendář a spusť trénink s časovačem. Výsledky, RPE a hodnocení bloků se uloží pro další porovnání.",
    points: ["Program a kalendář", "Časovač s bezpečným uložením", "Historie a vývoj výkonu"],
  },
  {
    eyebrow: "Jak začít",
    title: "Tři jednoduché kroky",
    description:
      "Začni vytvořením programu. Dnešní jednotku pak vždy najdeš na hlavní obrazovce a po dokončení uvidíš výsledek v historii.",
    points: ["1. Vytvoř program", "2. Odcvič dnešní jednotku", "3. Zkontroluj výsledek a RPE"],
  },
] as const;

export default function OnboardingGuide() {
  const pathname = usePathname();
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const show = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(ONBOARDING_OPEN_EVENT, show);
    if (!pathname.startsWith("/workout/") && !hasCompletedOnboarding()) show();
    return () => window.removeEventListener(ONBOARDING_OPEN_EVENT, show);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        completeOnboarding();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, step]);

  function finish() {
    completeOnboarding();
    setOpen(false);
  }

  if (!open) return null;
  const current = steps[step];
  const lastStep = step === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/80 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-md"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        className="ui-card ui-card-accent my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:p-7"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-h-12 items-center gap-3" role="img" aria-label="Enginn">
            <EnginnMark className="size-12" priority />
            <EnginnWordmark className="h-5 w-auto" priority />
          </div>
          <button
            type="button"
            onClick={finish}
            className="ui-button ui-button-ghost ui-button-sm -mr-2 text-xs"
            aria-label="Přeskočit úvod"
          >
            Přeskočit
          </button>
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.22em] text-accent">
          {current.eyebrow}
        </p>
        <h2 id="onboarding-title" className="mt-2 text-3xl font-black tracking-tight">
          {current.title}
        </h2>
        <p id="onboarding-description" className="mt-3 text-sm leading-6 text-zinc-300">
          {current.description}
        </p>

        <ul className="mt-6 space-y-3">
          {current.points.map((point) => (
            <li key={point} className="ui-inset flex items-center gap-3 px-4 py-3 text-sm font-bold">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs text-accent" aria-hidden="true">✓</span>
              {point}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex justify-center gap-2" aria-label={`Krok ${step + 1} ze ${steps.length}`}>
          {steps.map((item, index) => (
            <span
              key={item.title}
              className={`h-1.5 rounded-full transition-all ${index === step ? "w-8 bg-accent" : "w-2 bg-zinc-700"}`}
              aria-hidden="true"
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
            className="ui-button ui-button-outline"
          >
            Zpět
          </button>
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={() => lastStep ? finish() : setStep((value) => value + 1)}
            className="ui-button ui-button-primary"
          >
            {lastStep ? "Začít používat" : "Pokračovat"}
          </button>
        </div>
      </section>
    </div>
  );
}
