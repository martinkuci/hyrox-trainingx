"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ACTIVE_TEAM_SESSION_EVENT,
  loadActiveTeamSession,
  type ActiveTeamSession,
} from "@/lib/team-active-session";

const FORMAT_LABELS = {
  shared: "Společný workout",
  doubles: "Partner / Doubles",
  relay: "Relay",
} as const;

export default function ActiveTeamSessionResume() {
  const pathname = usePathname();
  const [session, setSession] = useState<ActiveTeamSession | null>(null);

  useEffect(() => {
    const refresh = () => setSession(loadActiveTeamSession());
    refresh();
    window.addEventListener(ACTIVE_TEAM_SESSION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ACTIVE_TEAM_SESSION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!session || pathname.startsWith(`/team/session/${session.sessionId}`)) return null;
  if (session.status === "completed" || session.status === "cancelled") return null;

  const running = session.status === "running" || session.status === "paused";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[80] px-4">
      <Link
        href={`/team/session/${encodeURIComponent(session.sessionId)}`}
        className="ui-card ui-card-accent pointer-events-auto mx-auto flex w-full max-w-md items-center justify-between gap-4 border-accent/40 px-4 py-3 shadow-2xl shadow-black/50"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">
            {running ? "Probíhá týmový trénink" : "Aktivní týmová session"}
          </p>
          <p className="mt-0.5 truncate font-black text-white">{session.workoutTitle}</p>
          <p className="mt-0.5 text-xs text-zinc-400">{FORMAT_LABELS[session.format]} · {session.joinCode}</p>
        </div>
        <span className="ui-button ui-button-primary ui-button-sm shrink-0">Vrátit se</span>
      </Link>
    </div>
  );
}
