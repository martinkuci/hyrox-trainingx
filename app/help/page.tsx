"use client";

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { loadCloudUser, requestPasswordReset } from "@/lib/firebase-rest";
import {
  SUPPORT_ATTACHMENT_ACCEPT,
  SUPPORT_TYPES,
  type SupportType,
  validateSupportAttachment,
} from "@/lib/help-support";
import { openOnboarding } from "@/lib/onboarding-state";
import { APP_VERSION } from "@/lib/app-version.mjs";

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
  const [resetEmail, setResetEmail] = useState(() => loadCloudUser()?.email ?? "");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const [supportType, setSupportType] = useState<SupportType>("technical");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportReplyEmail, setSupportReplyEmail] = useState(() => loadCloudUser()?.email ?? "");
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportStatus, setSupportStatus] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const supportFileInput = useRef<HTMLInputElement>(null);
  const supportSubmissionId = useRef<string | null>(null);

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

  function chooseSupportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSupportStatus(null);
    if (!file) {
      setSupportFile(null);
      return;
    }

    const error = validateSupportAttachment(file);
    if (error) {
      setSupportFile(null);
      event.target.value = "";
      setSupportStatus({ tone: "danger", text: error });
      return;
    }

    setSupportFile(file);
  }

  function removeSupportFile() {
    setSupportFile(null);
    setSupportStatus(null);
    if (supportFileInput.current) supportFileInput.current.value = "";
  }

  async function contactSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSupportStatus(null);

    const formData = new FormData(event.currentTarget);
    supportSubmissionId.current ??= crypto.randomUUID();
    formData.set("submissionId", supportSubmissionId.current);

    setSupportBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      const result = await response.json().catch(() => null) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Hlášení se nepodařilo odeslat. Zkus to znovu později.",
        );
      }

      setSupportMessage("");
      setSupportFile(null);
      supportSubmissionId.current = null;
      if (supportFileInput.current) supportFileInput.current.value = "";
      setSupportStatus({
        tone: "success",
        text: "Hlášení bylo odesláno podpoře. Děkujeme za zpětnou vazbu.",
      });
    } catch (reason) {
      setSupportStatus({
        tone: "danger",
        text: reason instanceof DOMException && reason.name === "AbortError"
          ? "Odesílání trvá příliš dlouho. Zkontroluj připojení a zkus to znovu."
          : reason instanceof Error
            ? reason.message
            : "Hlášení se nepodařilo odeslat. Zkus to znovu později.",
      });
    } finally {
      window.clearTimeout(timeout);
      setSupportBusy(false);
    }
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
            Hlášení odešleme přímo z aplikace. Adresa podpory se nezobrazuje; kontaktní e-mail pro odpověď je volitelný.
          </p>
          <form onSubmit={contactSupport} className="mt-5">
            <label htmlFor="support-type" className="block text-sm font-bold">Typ zprávy</label>
            <select
              id="support-type"
              name="type"
              value={supportType}
              onChange={(event) => {
                setSupportType(event.target.value as SupportType);
                setSupportStatus(null);
              }}
              className="ui-field mt-2"
            >
              {SUPPORT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>

            <label htmlFor="support-message" className="mt-5 block text-sm font-bold">Zpráva</label>
            <textarea
              id="support-message"
              name="message"
              required
              minLength={5}
              maxLength={4_000}
              rows={5}
              value={supportMessage}
              onChange={(event) => {
                setSupportMessage(event.target.value);
                setSupportStatus(null);
              }}
              placeholder="Popiš problém, dotaz nebo nápad…"
              className="ui-field mt-2 min-h-32 resize-y p-4"
            />

            <label htmlFor="support-reply-email" className="mt-5 block text-sm font-bold">
              Kontaktní e-mail (volitelný)
            </label>
            <input
              id="support-reply-email"
              name="replyEmail"
              type="email"
              maxLength={254}
              autoComplete="email"
              value={supportReplyEmail}
              onChange={(event) => {
                setSupportReplyEmail(event.target.value);
                setSupportStatus(null);
              }}
              placeholder="kam můžeme odpovědět"
              className="ui-field mt-2"
            />

            <label htmlFor="support-file" className="mt-5 block text-sm font-bold">Příloha (volitelná)</label>
            <input
              ref={supportFileInput}
              id="support-file"
              name="attachment"
              type="file"
              accept={SUPPORT_ATTACHMENT_ACCEPT}
              onChange={chooseSupportFile}
              className="ui-field mt-2 file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-black file:text-black"
            />
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Jeden obrázek PNG, JPG nebo WebP, případně PDF do 4 MB. Příloha se neukládá do profilu ani historie; bude odeslána externí e-mailovou službou do schránky podpory.
            </p>
            {supportFile ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-100">{supportFile.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{(supportFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button type="button" onClick={removeSupportFile} className="min-h-11 shrink-0 px-2 text-sm font-bold text-zinc-300 underline underline-offset-4">
                  Odebrat
                </button>
              </div>
            ) : null}

            <div className="hidden" aria-hidden="true">
              <label htmlFor="support-website">Web</label>
              <input id="support-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <button disabled={supportBusy} className="ui-button ui-button-primary mt-4 w-full">
              {supportBusy ? "Odesílám…" : "Odeslat hlášení"}
            </button>
            {supportStatus ? (
              <div
                className={`ui-feedback mt-4 ${supportStatus.tone === "success" ? "ui-feedback-success" : "ui-feedback-danger"}`}
                role={supportStatus.tone === "danger" ? "alert" : "status"}
                aria-live="polite"
              >
                <p className="text-sm font-bold leading-6">{supportStatus.text}</p>
              </div>
            ) : null}
          </form>
        </section>
        <p className="pb-2 text-center text-xs font-bold text-zinc-600">
          HYROX Training · verze {APP_VERSION}
        </p>
      </div>
    </PlanningShell>
  );
}
