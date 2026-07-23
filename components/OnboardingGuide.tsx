"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const ONBOARDING_STORAGE_KEY = "hyrox-onboarding-seen-v1";
const ONBOARDING_STATE_EVENT = "hyrox-onboarding-state";
export const OPEN_ONBOARDING_EVENT = "hyrox-open-onboarding";

const steps = [
  {
    eyebrow: "Vítej",
    icon: "👋",
    title: "Trénink od plánu po výsledek",
    description:
      "HYROX Training ti pomůže naplánovat přípravu, odjet trénink s časovačem a sledovat výsledky na jednom místě.",
    points: [
      "Vyber si hotový program nebo samostatný trénink.",
      "Naplánuj jednotky do kalendáře a podle potřeby je přesuň.",
      "Po dokončení ulož RPE, váhy, poznámky a data z hodinek.",
    ],
  },
  {
    eyebrow: "Základ",
    icon: "🏁",
    title: "Co je HYROX?",
    description:
      "HYROX je fitness závod, ve kterém se osmkrát střídá běh 1 km s jedním funkčním stanovištěm.",
    points: [
      "Celkem tě čeká 8 km běhu a 8 funkčních stanovišť.",
      "Stanoviště jdou od SkiErgu a saní až po výpady a wall balls.",
      "Tréninky v aplikaci rozvíjejí běh, sílu i práci pod únavou.",
    ],
  },
  {
    eyebrow: "První kroky",
    icon: "🗓️",
    title: "Jak aplikaci začít používat",
    description:
      "Nejrychlejší cesta je vytvořit si program a nechat aplikaci rozložit tréninky do konkrétních dnů.",
    points: [
      "V Programu zvol cíl, úroveň, délku a počet tréninků týdně.",
      "V Plánu kontroluj dnešní jednotku a případné změny termínu.",
      "V Tréninku spusť časovač; ve Výsledcích pak sleduj vývoj.",
    ],
  },
  {
    eyebrow: "Data a pomoc",
    icon: "☁️",
    title: "Tvoje data zůstávají pod kontrolou",
    description:
      "Aplikace funguje i bez účtu. Cloud je volitelný a slouží k synchronizaci mezi zařízeními.",
    points: [
      "Bez přihlášení jsou data uložena v tomto prohlížeči.",
      "Screenshot se používá jen ke čtení údajů; ukládají se až potvrzené hodnoty.",
      "Úvod, FAQ, reset hesla i zpětnou vazbu najdeš kdykoli v Účtu.",
    ],
  },
] as const;

function readSeenState() {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function subscribeToSeenState(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(ONBOARDING_STATE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(ONBOARDING_STATE_EVENT, callback);
  };
}

export function openOnboardingGuide() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_ONBOARDING_EVENT));
  }
}

export default function OnboardingGuide() {
  const hasSeenGuide = useSyncExternalStore(
    subscribeToSeenState,
    readSeenState,
    () => true,
  );
  const [manualOpen, setManualOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const open = manualOpen || !hasSeenGuide;
  const step = steps[stepIndex];
  const lastStep = stepIndex === steps.length - 1;

  const rememberAndClose = useCallback(() => {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // The guide can still be closed when private storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent(ONBOARDING_STATE_EVENT));
    setManualOpen(false);
    setStepIndex(0);
  }, []);

  useEffect(() => {
    function handleOpen() {
      setStepIndex(0);
      setManualOpen(true);
    }

    window.addEventListener(OPEN_ONBOARDING_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        rememberAndClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, rememberAndClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-zinc-950/95 p-4 text-white backdrop-blur-sm safe-screen">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="mx-auto flex min-h-full w-full max-w-md items-center"
      >
        <section className="w-full overflow-hidden rounded-[2rem] border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div className="flex gap-2" aria-label={`Krok ${stepIndex + 1} z ${steps.length}`}>
              {steps.map((item, index) => (
                <span
                  key={item.title}
                  className={`h-2 rounded-full transition-all ${
                    index === stepIndex ? "w-8 bg-lime-400" : "w-2 bg-zinc-700"
                  }`}
                />
              ))}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={rememberAndClose}
              className="grid min-h-11 min-w-11 place-items-center rounded-xl text-2xl text-zinc-400 active:bg-zinc-800 active:text-white"
              aria-label="Zavřít úvod"
            >
              ×
            </button>
          </div>

          <div className="px-6 pb-6 pt-7">
            <div className="grid size-16 place-items-center rounded-2xl bg-lime-400/15 text-4xl" aria-hidden="true">
              {step.icon}
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-lime-400">
              {step.eyebrow}
            </p>
            <h2 id="onboarding-title" className="mt-2 text-3xl font-black tracking-tight">
              {step.title}
            </h2>
            <p className="mt-3 text-base leading-7 text-zinc-300">{step.description}</p>

            <ul className="mt-6 space-y-3">
              {step.points.map((point) => (
                <li key={point} className="flex gap-3 rounded-2xl bg-zinc-800/80 p-4">
                  <span className="mt-0.5 font-black text-lime-400" aria-hidden="true">
                    ✓
                  </span>
                  <span className="text-sm leading-6 text-zinc-200">{point}</span>
                </li>
              ))}
            </ul>

            {lastStep && (
              <p className="mt-5 text-xs leading-5 text-zinc-500">
                Jde o nezávislou tréninkovou pomůcku, nikoli oficiální aplikaci HYROX ani náhradu trenéra či zdravotního doporučení.
              </p>
            )}

            <div className="mt-7 grid grid-cols-[auto_1fr] gap-3">
              {stepIndex === 0 ? (
                <button
                  type="button"
                  onClick={rememberAndClose}
                  className="min-h-12 rounded-2xl px-4 font-bold text-zinc-400 active:bg-zinc-800"
                >
                  Přeskočit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStepIndex((current) => current - 1)}
                  className="min-h-12 rounded-2xl border border-zinc-700 px-5 font-bold text-zinc-200 active:bg-zinc-800"
                >
                  Zpět
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (lastStep) rememberAndClose();
                  else setStepIndex((current) => current + 1);
                }}
                className="min-h-12 rounded-2xl bg-lime-400 px-5 text-lg font-black text-zinc-950 active:bg-lime-300"
              >
                {lastStep ? "Začít používat aplikaci" : "Pokračovat"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
