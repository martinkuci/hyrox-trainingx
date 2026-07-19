import type { ReactNode } from "react";
import { StickyActionBar } from "@/components/navigation/StickyActionBar";
import { StickyBottomNavigation } from "@/components/navigation/StickyBottomNavigation";
import { StickyHeader } from "@/components/navigation/StickyHeader";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  backHref?: string;
  action?: ReactNode;
  bottomAction?: ReactNode;
  children: ReactNode;
};

export function PlanningShell({
  eyebrow,
  title,
  description,
  backHref = "/",
  action,
  bottomAction,
  children,
}: Props) {
  return (
    <>
      <StickyHeader title={title} fallbackHref={backHref} />

      <main
        className={`min-h-screen bg-zinc-950 px-4 pt-24 text-white sm:px-6 sm:pt-28 ${
          bottomAction ? "pb-52" : "pb-28"
        }`}
      >
        <div className="mx-auto w-full max-w-2xl">
          <header className="flex items-end justify-between gap-5">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-lime-400">
                {eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                {title}
              </h1>
              {description && (
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                  {description}
                </p>
              )}
            </div>
            {action}
          </header>

          <div className="mt-8">{children}</div>
        </div>
      </main>

      {bottomAction && <StickyActionBar>{bottomAction}</StickyActionBar>}
      <StickyBottomNavigation />
    </>
  );
}
