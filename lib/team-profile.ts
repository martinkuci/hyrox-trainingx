import type { CloudUser } from "./firebase-rest";
import type { TeamWorkoutParticipant } from "./team-training";

const PROFILE_KEY = "enginn-team-profile-v1";
const RECENT_KEY = "enginn-team-recent-v1";

export type TeamProfile = {
  displayName: string;
};

export type RecentTeammate = {
  id: string;
  displayName: string;
  lastSessionId: string;
  lastTrainedAt: string;
};

function storage() {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function defaultDisplayName(user: CloudUser | null) {
  if (!user?.email) return "Sportovec";
  const name = user.email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return name ? name.replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase()) : "Sportovec";
}

export function loadTeamProfile(user: CloudUser | null): TeamProfile {
  const fallback = { displayName: defaultDisplayName(user) };
  const target = storage();
  if (!target) return fallback;
  try {
    const parsed = JSON.parse(target.getItem(PROFILE_KEY) ?? "null") as Partial<TeamProfile> | null;
    return { displayName: parsed?.displayName?.trim() || fallback.displayName };
  } catch { return fallback; }
}

export function saveTeamProfile(profile: TeamProfile) {
  const target = storage();
  if (!target) return;
  target.setItem(PROFILE_KEY, JSON.stringify({ displayName: profile.displayName.trim() || "Sportovec" }));
}

export function loadRecentTeammates(): RecentTeammate[] {
  const target = storage();
  if (!target) return [];
  try {
    const value = JSON.parse(target.getItem(RECENT_KEY) ?? "[]") as RecentTeammate[];
    return Array.isArray(value) ? value.slice(0, 12) : [];
  } catch { return []; }
}

export function rememberTeammates(sessionId: string, participants: TeamWorkoutParticipant[], ownParticipantId: string) {
  const target = storage();
  if (!target) return;
  const now = new Date().toISOString();
  const previous = loadRecentTeammates();
  const next = [...participants]
    .filter((participant) => participant.id !== ownParticipantId)
    .reduce<RecentTeammate[]>((items, participant) => {
      const teammate: RecentTeammate = { id: participant.userId ?? participant.id, displayName: participant.displayName, lastSessionId: sessionId, lastTrainedAt: now };
      return [teammate, ...items.filter((item) => item.id !== teammate.id)];
    }, previous)
    .slice(0, 12);
  target.setItem(RECENT_KEY, JSON.stringify(next));
}
