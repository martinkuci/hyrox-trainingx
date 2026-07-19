"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  title?: string;
  fallbackHref?: string;
};

export function StickyHeader({ title, fallbackHref = "/" }: Props) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 pt-[env(safe-area-inset-top)] text-white backdrop-blur"
      aria-label={title ? `Navigace stránky ${title}` : "Horní navigace"}
    >
      <div className="mx-auto grid h-16 w-full max-w-2xl grid-cols-3 items-center px-4">
        <button
          type="button"
          onClick={goBack}
          className="flex min-h-11 min-w-11 items-center justify-start rounded-xl text-zinc-300 transition active:bg-zinc-800 active:text-white"
          aria-label="Zpět"
        >
          <span className="text-2xl" aria-hidden="true">
            ←
          </span>
        </button>

        <Link
          href="/"
          className="justify-self-center rounded-lg px-3 py-2 text-sm font-black uppercase tracking-[0.24em] text-white"
          aria-label="HYROX – domů"
        >
          HYROX
        </Link>

        <Link
          href="/account"
          className="flex min-h-11 min-w-11 items-center justify-end justify-self-end rounded-xl text-zinc-300 transition active:bg-zinc-800 active:text-white"
          aria-label="Účet a cloud"
        >
          <span className="text-2xl" aria-hidden="true">
            ☁
          </span>
        </Link>
      </div>
    </header>
  );
}
