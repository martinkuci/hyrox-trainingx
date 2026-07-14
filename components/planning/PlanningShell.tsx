import Link from "next/link";
import type { ReactNode } from "react";

type PlanningShellProps = {
  eyebrow: string;
  title: string;
  description?: string;
  backHref?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function PlanningShell({
  eyebrow,
  title,
  description,
  backHref = "/",
  action,
  children,
}: PlanningShellProps) {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-zinc-400 transition hover:text-white"
        >
          <span aria-hidden="true">←</span> Zpět
        </Link>

        <header className="mt-5 flex items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-lime-400">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </header>

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}


