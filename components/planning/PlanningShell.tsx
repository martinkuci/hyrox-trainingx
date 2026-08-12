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
    <div className="app-shell min-h-screen text-white">
      <StickyHeader title={title} fallbackHref={backHref} />

      <main
        className={`app-content-safe min-h-screen px-4 sm:px-6 ${
          bottomAction ? "app-content-safe-with-action" : ""
        }`}
      >
        <div className="mx-auto w-full max-w-2xl">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">
                {eyebrow}
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.035em] sm:text-4xl">
                {title}
              </h1>
              {description && (
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
                  {description}
                </p>
              )}
            </div>
            {action && <div className="w-full sm:w-auto">{action}</div>}
          </header>

          <div className="mt-7">{children}</div>
        </div>
      </main>

      {bottomAction && <StickyActionBar>{bottomAction}</StickyActionBar>}
      <StickyBottomNavigation />
    </div>
  );
}
