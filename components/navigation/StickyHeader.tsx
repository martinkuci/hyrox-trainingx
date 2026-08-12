"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  title?: string;
  fallbackHref?: string;
};

export function StickyHeader({ title, fallbackHref = "/" }: Props) {
  const router = useRouter();
  const pathname = usePathname();

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
          <Link href="/" className="grid size-10 place-items-center rounded-xl bg-accent font-black text-zinc-950" aria-label="Dnes">
            T
          </Link>
        ) : (
          <button
            type="button"
            onClick={goBack}
            className="flex min-h-11 min-w-11 items-center justify-start rounded-xl text-zinc-400 active:bg-white/5 active:text-white"
            aria-label="Zpět"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <Link
          href="/"
          className="flex min-h-11 items-center justify-self-center rounded-xl px-3 text-xs font-black uppercase tracking-[0.22em] text-white"
          aria-label="HYROX – domů"
        >
          <span className="mr-2 h-4 w-1 rounded-full bg-accent" aria-hidden="true" />
          Training
        </Link>

        <Link
          href="/account"
          className="flex min-h-11 min-w-11 items-center justify-end justify-self-end rounded-xl text-zinc-400 active:bg-white/5 active:text-white"
          aria-label="Účet a cloud"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="8" r="3.25" />
            <path d="M5.5 19.5c.5-3.75 2.67-5.75 6.5-5.75s6 2 6.5 5.75" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
