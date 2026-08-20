import type { TeamWorkoutFormat, TeamWorkoutSessionStatus } from "./team-training";

const ACTIVE_TEAM_SESSION_KEY = "enginn-active-team-session-v1";
export const ACTIVE_TEAM_SESSION_EVENT = "enginn-active-team-session-change";

export type ActiveTeamSession = {
  sessionId: string;
  joinCode: string;
  workoutTitle: string;
  format: TeamWorkoutFormat;
  status: TeamWorkoutSessionStatus;
  startedAt?: string;
  updatedAt: string;
};

function storage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(ACTIVE_TEAM_SESSION_EVENT));
}

export function loadActiveTeamSession(): ActiveTeamSession | null {
  const target = storage();
  if (!target) return null;
  try {
    const value = JSON.parse(target.getItem(ACTIVE_TEAM_SESSION_KEY) ?? "null") as ActiveTeamSession | null;
    return value?.sessionId && value.joinCode && value.workoutTitle ? value : null;
  } catch {
    return null;
  }
}

export function saveActiveTeamSession(session: Omit<ActiveTeamSession, "updatedAt">) {
  const target = storage();
  if (!target) return;
  target.setItem(ACTIVE_TEAM_SESSION_KEY, JSON.stringify({ ...session, updatedAt: new Date().toISOString() }));
  emit();
}

export function clearActiveTeamSession(sessionId?: string) {
  const target = storage();
  if (!target) return;
  if (sessionId) {
    const current = loadActiveTeamSession();
    if (current && current.sessionId !== sessionId) return;
  }
  target.removeItem(ACTIVE_TEAM_SESSION_KEY);
  emit();
}
