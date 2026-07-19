"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/", icon: "🏠", label: "Domů" },
  { href: "/plan", icon: "📅", label: "Plán" },
  { href: "/workouts", icon: "🏋️", label: "Tréninky" },
  { href: "/history", icon: "📈", label: "Výsledky" },
  { href: "/account", icon: "👤", label: "Účet" },
] as const;

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/plan") {
    return (
      pathname.startsWith("/plan") ||
      pathname.startsWith("/calendar") ||
      pathname.startsWith("/programs")
    );
  }
  if (href === "/workouts") {
    return pathname.startsWith("/workouts") || pathname.startsWith("/workout/");
  }
  return pathname.startsWith(href);
}

export function StickyBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] text-white backdrop-blur"
      aria-label="Hlavní navigace"
    >
      <div className="mx-auto grid h-16 w-full max-w-2xl grid-cols-5 items-center gap-1 px-3">
        {navigationItems.map((item) => {
          const active = isActiveRoute(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-11 items-center justify-center rounded-xl px-2 text-2xl transition ${
                active
                  ? "bg-lime-400 text-zinc-950"
                  : "text-zinc-400 active:bg-zinc-800 active:text-white"
              }`}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              title={item.label}
            >
              <span aria-hidden="true">{item.icon}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
