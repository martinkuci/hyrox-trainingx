"use client";

import { type FormEvent, useEffect, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { loadCloudUser, requestPasswordReset } from "@/lib/firebase-rest";
import {
  SUPPORT_EMAIL,
  SUPPORT_TYPES,
  buildSupportMailto,
  type SupportType,
} from "@/lib/help-support";
import { openOnboarding } from "@/lib/onboarding-state";

const faqItems = [
  {
    question: "Musím mít účet?",
    answer:
      "Ne. Tréninky, plán i výsledky můžeš používat pouze v tomto zařízení. Účet je potřeba jen pro volitelnou cloudovou synchronizaci mezi zařízeními.",
  },
  {
    question: "Co se stane, když během tréninku zavřu aplikaci?",
    answer:
      "Rozpracovaný trénink se průběžně ukládá v zařízení. Po návratu ti aplikace nabídne pokračování z posledního bezpečného bodu.",
  },
  {
    question: "Mohu trénink dokončit dříve?",
    answer:
      "Ano. V aktivním tréninku lze použít dokončení rozdělané jednotky. Aplikace uloží skutečně absolvovanou část a nebude vyžadovat odklikání zbytku.",
  },
  {
    question: "Jak funguje hodnocení bloků?",
    answer:
      "Po dokončení celého bloku vybereš jednu z pěti úrovní od příliš těžké po příliš lehkou. Hodnocení pomáhá zpětně porovnat náročnost tréninků.",
  },
  {
    question: "Jak přenesu data do jiného telefonu?",
    answer:
      "V Profilu můžeš použít cloudovou synchronizaci nebo stáhnout JSON zálohu a na druhém zařízení ji obnovit. Před obnovou vždy uvidíš přehled obsahu.",
  },
  {
    question: "Ukládá aplikace moje screenshoty?",
    answer:
      "Ne. Screenshot slouží jen jako dočasný vstup pro rozpoznání. Uloží se až hodnoty, které předem zkontroluješ a potvrdíš.",
  },
] as const;

export default function HelpPage() {
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const [supportType, setSupportType] = useState<SupportType>("technical");
  const [supportMessage, setSupportMessage] = useState("");

  useEffect(() => {
    setResetEmail(loadCloudUser()?.email ?? "");
  }, []);

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setResetBusy(true);
    setResetMessage(null);
    try {
      await requestPasswordReset(resetEmail);
      setResetMessage({
        tone: "success",
        text: "Pokud pro tento e-mail existuje účet, dorazí na něj odkaz pro nastavení nového hesla.",
      });
    } catch (reason) {
      setResetMessage({
        tone: "danger",
        text: reason instanceof Error ? reason.message : "Odkaz se nepodařilo odeslat.",
      });
    } finally {
      setResetBusy(false);
    }
  }

  function contactSupport(event: FormEvent) {
    event.preventDefault();
    window.location.assign(buildSupportMailto(supportType, supportMessage));
  }

  return (
    <PlanningShell
      eyebrow="Podpora"
      title="Nápověda a kontakt"
      description="Rychlé odpovědi, obnovení hesla a přímý kontakt pro technické dotazy i nápady."
      backHref="/account"
    >
      <div className="space-y-6">
        <section className="ui-card ui-card-accent p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Začínáme</p>
          <h2 className="mt-2 text-2xl font-black">Jak aplikace funguje</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Znovu si projdi krátké vysvětlení HYROX, plánování, spuštění tréninku a ukládání výsledků.
          </p>
          <button type="button" onClick={openOnboarding} className="ui-button ui-button-primary mt-5 w-full">
            Otevřít úvod aplikace
          </button>
        </section>

        <section className="ui-card p-5 sm:p-6" aria-labelledby="faq-title">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Časté otázky</p>
          <h2 id="faq-title" className="mt-2 text-2xl font-black">FAQ</h2>
          <div className="mt-5 divide-y divide-white/8">
            {faqItems.map((item) => (
              <details key={item.question} className="group py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold text-zinc-100">
                  <span>{item.question}</span>
                  <span className="text-xl text-accent transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="pb-4 pr-8 text-sm leading-6 text-zinc-400">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="ui-card p-5 sm:p-6" aria-labelledby="reset-title">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Účet</p>
          <h2 id="reset-title" className="mt-2 text-2xl font-black">Zapomenuté heslo</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Firebase pošle bezpečný odkaz pro nastavení nového hesla. Aplikace neukazuje, zda je e-mail registrovaný.
          </p>
          <form onSubmit={resetPassword} className="mt-5">
            <label htmlFor="reset-email" className="block text-sm font-bold">E-mail účtu</label>
            <input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              className="ui-field mt-2"
            />
            <button disabled={resetBusy} className="ui-button ui-button-outline mt-4 w-full">
              {resetBusy ? "Odesílám…" : "Poslat odkaz pro nové heslo"}
            </button>
          </form>
          {resetMessage && (
            <div
              className={`ui-feedback mt-4 ${resetMessage.tone === "success" ? "ui-feedback-success" : "ui-feedback-danger"}`}
              role={resetMessage.tone === "danger" ? "alert" : "status"}
              aria-live="polite"
            >
              <p className="text-sm font-bold leading-6">{resetMessage.text}</p>
            </div>
          )}
        </section>

        <section className="ui-card p-5 sm:p-6" aria-labelledby="contact-title">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Napiš tvůrci</p>
          <h2 id="contact-title" className="mt-2 text-2xl font-black">Pomoc a zpětná vazba</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Zpráva se otevře v tvé e-mailové aplikaci a odešle na {SUPPORT_EMAIL}. Před odesláním ji můžeš upravit.
          </p>
          <form onSubmit={contactSupport} className="mt-5">
            <label htmlFor="support-type" className="block text-sm font-bold">Typ zprávy</label>
            <select
              id="support-type"
              value={supportType}
              onChange={(event) => setSupportType(event.target.value as SupportType)}
              className="ui-field mt-2"
            >
              {SUPPORT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>

            <label htmlFor="support-message" className="mt-5 block text-sm font-bold">Zpráva</label>
            <textarea
              id="support-message"
              required
              minLength={5}
              rows={5}
              value={supportMessage}
              onChange={(event) => setSupportMessage(event.target.value)}
              placeholder="Popiš problém, dotaz nebo nápad…"
              className="ui-field mt-2 min-h-32 resize-y p-4"
            />
            <button className="ui-button ui-button-primary mt-4 w-full">
              Připravit e-mail
            </button>
          </form>
        </section>
      </div>
    </PlanningShell>
  );
}
