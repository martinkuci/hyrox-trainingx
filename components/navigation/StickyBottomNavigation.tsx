"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/", icon: "today", label: "Dnes" },
  { href: "/plan", icon: "plan", label: "Plán" },
  { href: "/workouts", icon: "train", label: "Trénovat" },
  { href: "/history", icon: "results", label: "Výsledky" },
  { href: "/account", icon: "profile", label: "Profil" },
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
  if (href === "/history") {
    return pathname.startsWith("/history") || pathname.startsWith("/results");
  }
  return pathname.startsWith(href);
}

export function StickyBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/8 bg-[#0a0b0d]/94 pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-12px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl"
      aria-label="Hlavní navigace"
    >
      <div className="mx-auto grid h-[4.5rem] w-full max-w-2xl grid-cols-5 items-stretch gap-1 px-2 pt-1">
        {navigationItems.map((item) => {
          const active = isActiveRoute(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 transition ${
                active
                  ? "text-accent"
                  : "text-zinc-500 active:bg-white/5 active:text-zinc-200"
              }`}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              title={item.label}
            >
              {active && <span className="absolute top-0 h-0.5 w-5 rounded-full bg-accent" aria-hidden="true" />}
              <NavigationIcon name={item.icon} />
              <span className="whitespace-nowrap text-[9px] font-bold leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavigationIcon({ name }: { name: (typeof navigationItems)[number]["icon"] }) {
  const common = "size-[1.35rem]";

  if (name === "today") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20H5a1 1 0 0 1-1-1v-8.5Z" /><path d="M9 20v-6h6v6" /></svg>;
  if (name === "plan") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 9h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" strokeLinecap="round" /></svg>;
  if (name === "train") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6.5 8v8M3.5 9.5v5M17.5 8v8M20.5 9.5v5M6.5 12h11" strokeLinecap="round" /></svg>;
  if (name === "results") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" strokeLinecap="round" /></svg>;
}
