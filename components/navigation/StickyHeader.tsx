"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { EnginnMark, EnginnWordmark } from "@/components/EnginnBrand";
import { useCloudSyncState } from "@/hooks/useCloudSyncState";

type Props = {
  title?: string;
  fallbackHref?: string;
};

export function StickyHeader({ title, fallbackHref = "/" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const syncState = useCloudSyncState();
  const syncLabels = {
    local: { short: "Lokálně", label: "data pouze v tomto zařízení", dot: "bg-zinc-500" },
    offline: { short: "Offline", label: "bez připojení", dot: "bg-amber-300" },
    pending: { short: "Čeká", label: "změny čekají na synchronizaci", dot: "bg-amber-300" },
    syncing: { short: "Ukládám", label: "probíhá synchronizace", dot: "bg-accent animate-pulse" },
    synced: { short: "Uloženo", label: "data jsou synchronizovaná", dot: "bg-emerald-300" },
    error: { short: "Chyba", label: "synchronizace vyžaduje pozornost", dot: "bg-red-400" },
  } as const;
  const syncLabel = syncLabels[syncState.phase];

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#0a0b0d]/92 pt-[env(safe-area-inset-top)] text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl"
      aria-label={title ? `Navigace stránky ${title}` : "Horní navigace"}
    >
      <div className="mx-auto grid h-[4.25rem] w-full max-w-2xl grid-cols-3 items-center px-4 sm:px-6">
        {pathname === "/" ? (
          <Link href="/" className="grid size-11 place-items-center rounded-xl" aria-label="Enginn – dnes">
            <EnginnMark className="size-10" priority />
          </Link>
        ) : (
          <button
            type="button"
            onClick={goBack}
            className="ui-button ui-button-ghost ui-button-icon justify-start text-zinc-400"
            aria-label="Zpět"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <Link
          href="/"
          className="flex min-h-11 items-center justify-self-center rounded-xl px-2"
          aria-label="Enginn – domů"
        >
          <EnginnWordmark className="h-[1.15rem] w-auto" priority />
        </Link>

        <Link
          href="/account"
          className="flex min-h-11 max-w-full items-center justify-end gap-1.5 justify-self-end rounded-xl px-2 text-zinc-400"
          aria-label={`Účet a cloud – ${syncLabel.label}`}
        >
          <span className={`size-2 shrink-0 rounded-full ${syncLabel.dot}`} aria-hidden="true" />
          <span className="truncate text-[9px] font-black uppercase tracking-wide">
            {syncLabel.short}
          </span>
          <svg viewBox="0 0 24 24" className="hidden size-5 shrink-0 sm:block" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="8" r="3.25" />
            <path d="M5.5 19.5c.5-3.75 2.67-5.75 6.5-5.75s6 2 6.5 5.75" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
