"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { openOnboardingGuide } from "@/components/OnboardingGuide";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
const GITHUB_ISSUE_URL = "https://github.com/martinkuci/hyrox-trainingx/issues/new";

const faqs = [
  {
    question: "Je to oficiální aplikace HYROX?",
    answer:
      "Ne. Jde o nezávislou tréninkovou pomůcku pro plánování, časování a evidenci výsledků. Aktuální soutěžní pravidla a standardy pohybů vždy ověř na oficiálním webu HYROX.",
  },
  {
    question: "Musím mít účet?",
    answer:
      "Nemusíš. Bez účtu aplikace ukládá data do tohoto prohlížeče. Účet potřebuješ jen pro volitelnou cloudovou synchronizaci mezi zařízeními.",
  },
  {
    question: "Co přesně synchronizuje cloud?",
    answer:
      "Tréninky, naplánované jednotky, programy a potvrzené výsledky. Odhlášení samo o sobě nesmaže data uložená v tomto zařízení.",
  },
  {
    question: "Ukládá se nahraný screenshot?",
    answer:
      "Ne. Screenshot slouží pouze jako dočasný vstup pro rozpoznání. Do výsledku se uloží až hodnoty, které před uložením zkontroluješ.",
  },
  {
    question: "Jak spojím data z hodinek s dokončeným tréninkem?",
    answer:
      "Otevři Výsledky a u konkrétní karty zvol „Doplnit data ze screenshotu“. Tím zůstanou zachované RPE, váhy, poznámky, mezičasy i čas naměřený aplikací.",
  },
  {
    question: "Jak upravím termín tréninku?",
    answer:
      "V části Plán otevři naplánovanou jednotku a přesuň ji na jiný den. U programu můžeš podle nabídky přesunout jednu jednotku nebo navazující část plánu.",
  },
  {
    question: "Nahrazuje aplikace trenéra nebo zdravotní doporučení?",
    answer:
      "Ne. Obtížnost přizpůsob své kondici a technice. Při bolesti, zdravotním omezení nebo nejistotě se poraď s kvalifikovaným odborníkem.",
  },
] as const;

type Props = {
  defaultContactEmail?: string;
};

export default function HelpCenter({ defaultContactEmail = "" }: Props) {
  const [category, setCategory] = useState("Nápad na zlepšení");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  function feedbackBody() {
    const contact = contactEmail.trim() || "neuveden";
    return [
      `Typ: ${category}`,
      `Kontakt pro odpověď: ${contact}`,
      "",
      message.trim(),
      "",
      "Odesláno z aplikace HYROX Training.",
    ].join("\n");
  }

  function submitFeedback(event: FormEvent) {
    event.preventDefault();
    setFeedbackStatus("");
    setCopyStatus("");

    const title = `HYROX Training: ${category}`;
    const body = feedbackBody();

    if (SUPPORT_EMAIL) {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
      setFeedbackStatus("Otevřel se e-mailový klient s připravenou zprávou.");
      return;
    }

    const issueUrl = `${GITHUB_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(issueUrl, "_blank", "noopener,noreferrer");
    setFeedbackStatus("Otevřel se připravený podnět na GitHubu. Odeslání tam ještě potvrď.");
  }

  async function copyFeedback() {
    try {
      await navigator.clipboard.writeText(feedbackBody());
      setCopyStatus("Text podnětu je zkopírovaný.");
    } catch {
      setCopyStatus("Kopírování se nepodařilo. Označ a zkopíruj text ručně.");
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-400">
          O aplikaci
        </p>
        <h2 className="mt-2 text-2xl font-black">Úvod a rychlá nápověda</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Znovu si projdi, k čemu aplikace slouží, co je HYROX a jak začít s prvním programem.
        </p>
        <button
          type="button"
          onClick={openOnboardingGuide}
          className="mt-5 min-h-12 w-full rounded-2xl bg-lime-400 px-5 py-3 font-black text-zinc-950 active:bg-lime-300"
        >
          Otevřít úvod do aplikace
        </button>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-400">
          FAQ
        </p>
        <h2 className="mt-2 text-2xl font-black">Časté otázky</h2>
        <div className="mt-5 divide-y divide-zinc-800">
          {faqs.map((item) => (
            <details key={item.question} className="group py-1">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold text-zinc-100">
                <span>{item.question}</span>
                <span
                  className="text-xl text-lime-400 transition group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="pb-4 pr-7 text-sm leading-6 text-zinc-400">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-400">
          Kontakt tvůrce
        </p>
        <h2 className="mt-2 text-2xl font-black">Připomínky a nápady</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Popiš chybu nebo návrh co nejkonkrétněji. Rozepsaný text se neukládá do cloudu.
        </p>

        <form onSubmit={submitFeedback} className="mt-5">
          <label htmlFor="feedback-category" className="block text-sm font-bold">
            Typ podnětu
          </label>
          <select
            id="feedback-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base outline-none focus:border-lime-400"
          >
            <option>Nápad na zlepšení</option>
            <option>Nahlášení chyby</option>
            <option>Dotaz k používání</option>
            <option>Jiná připomínka</option>
          </select>

          <label htmlFor="feedback-email" className="mt-5 block text-sm font-bold">
            E-mail pro odpověď <span className="font-normal text-zinc-500">(volitelný)</span>
          </label>
          <input
            id="feedback-email"
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="tvuj@email.cz"
            className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base outline-none placeholder:text-zinc-600 focus:border-lime-400"
          />

          <label htmlFor="feedback-message" className="mt-5 block text-sm font-bold">
            Zpráva
          </label>
          <textarea
            id="feedback-message"
            required
            minLength={10}
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Co se stalo nebo co by aplikace mohla dělat lépe?"
            className="mt-2 w-full resize-y rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base leading-6 outline-none placeholder:text-zinc-600 focus:border-lime-400"
          />

          {feedbackStatus && (
            <p className="mt-4 rounded-2xl border border-lime-400/25 bg-lime-400/10 p-3 text-sm leading-5 text-lime-200" role="status">
              {feedbackStatus}
            </p>
          )}
          {copyStatus && (
            <p className="mt-4 text-sm text-zinc-400" role="status">
              {copyStatus}
            </p>
          )}

          <button
            type="submit"
            className="mt-5 min-h-12 w-full rounded-2xl bg-lime-400 px-5 py-3 font-black text-zinc-950 active:bg-lime-300"
          >
            {SUPPORT_EMAIL ? "Připravit e-mail tvůrci" : "Otevřít podnět pro tvůrce"}
          </button>
          <button
            type="button"
            onClick={copyFeedback}
            className="mt-3 min-h-12 w-full rounded-2xl border border-zinc-700 px-5 py-3 font-bold text-zinc-300 active:bg-zinc-800"
          >
            Zkopírovat text podnětu
          </button>
        </form>
      </section>
    </div>
  );
}
