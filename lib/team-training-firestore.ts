import { getValidCloudUser } from "./firebase-rest";
import type {
  TeamWorkoutEvent,
  TeamWorkoutParticipant,
  TeamWorkoutSession,
  TeamWorkoutSnapshot,
  TeamWorkoutTransport,
} from "./team-training";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const COLLECTION = "teamSessions";
const POLL_INTERVAL_MS = 1200;

type FirestoreDocument = {
  fields?: {
    payload?: { stringValue?: string };
    updatedAt?: { timestampValue?: string };
  };
  updateTime?: string;
};

type StoredTeamPayload = {
  session: TeamWorkoutSession;
  events: TeamWorkoutEvent[];
  revision: number;
};

function ensureConfigured() {
  if (!PROJECT_ID) throw new Error("Firebase není nakonfigurovaný pro týmové tréninky.");
}

function documentUrl(sessionId: string) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${encodeURIComponent(sessionId)}`;
}

async function authorizedFetch(url: string, init?: RequestInit) {
  ensureConfigured();
  const user = await getValidCloudUser();
  if (!user) throw new Error("Pro týmový trénink se nejdřív přihlas do Enginnu.");
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${user.idToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

function parseDocument(body: FirestoreDocument): TeamWorkoutSnapshot {
  const raw = body.fields?.payload?.stringValue;
  if (!raw) throw new Error("Týmová session má neplatný formát.");
  const payload = JSON.parse(raw) as StoredTeamPayload;
  if (!payload.session?.id || !Array.isArray(payload.events)) throw new Error("Týmová session má neplatný obsah.");
  return { ...payload, updateTime: body.updateTime };
}

async function getSnapshot(sessionId: string) {
  const response = await authorizedFetch(documentUrl(sessionId));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Týmovou session se nepodařilo načíst.");
  return parseDocument(await response.json() as FirestoreDocument);
}

async function writeSnapshot(snapshot: TeamWorkoutSnapshot, expectedUpdateTime?: string) {
  const query = expectedUpdateTime ? `?currentDocument.updateTime=${encodeURIComponent(expectedUpdateTime)}` : "";
  const response = await authorizedFetch(`${documentUrl(snapshot.session.id)}${query}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        payload: { stringValue: JSON.stringify({ session: snapshot.session, events: snapshot.events, revision: snapshot.revision }) },
        updatedAt: { timestampValue: new Date().toISOString() },
        joinCode: { stringValue: snapshot.session.joinCode },
        hostUserId: { stringValue: snapshot.session.hostUserId },
        status: { stringValue: snapshot.session.status },
      },
    }),
  });
  if (response.status === 409 || response.status === 412) return null;
  if (!response.ok) {
    if (response.status === 403) throw new Error("Firebase nepovolil přístup k týmové session. Zkontroluj Firestore pravidla pro teamSessions.");
    throw new Error("Týmovou session se nepodařilo uložit.");
  }
  return parseDocument(await response.json() as FirestoreDocument);
}

async function mutateSession(
  sessionId: string,
  mutate: (snapshot: TeamWorkoutSnapshot) => TeamWorkoutSnapshot,
  attempts = 3,
): Promise<TeamWorkoutSnapshot> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await getSnapshot(sessionId);
    if (!current) throw new Error("Týmová session už neexistuje.");
    const next = mutate(current);
    const written = await writeSnapshot(next, current.updateTime);
    if (written) return written;
  }
  throw new Error("Session se mezitím změnila na jiném telefonu. Zkus akci znovu.");
}

export class FirestoreTeamWorkoutTransport implements TeamWorkoutTransport {
  async createSession(session: TeamWorkoutSession) {
    const existing = await getSnapshot(session.id);
    if (existing) throw new Error("Tento join kód už existuje. Vytvoř session znovu.");
    const created = await writeSnapshot({ session, events: [], revision: 1 });
    if (!created) throw new Error("Týmovou session se nepodařilo vytvořit.");
    return created;
  }

  getSession(joinCode: string) {
    return getSnapshot(joinCode.trim().toUpperCase());
  }

  joinSession(joinCode: string, participant: TeamWorkoutParticipant) {
    const id = joinCode.trim().toUpperCase();
    return mutateSession(id, (snapshot) => {
      const existing = snapshot.session.participants.find((item) => item.id === participant.id || (participant.userId && item.userId === participant.userId));
      const participants = existing
        ? snapshot.session.participants.map((item) => item.id === existing.id ? { ...item, ...participant, id: existing.id, status: "joined" as const } : item)
        : [...snapshot.session.participants, { ...participant, status: "joined" as const }];
      if (participants.length > snapshot.session.participantLimit) throw new Error("Týmová session je už plná.");
      const joinedId = existing?.id ?? participant.id;
      const joinedEvent: TeamWorkoutEvent = { id: `join-${joinedId}`, type: "participant-joined", participantId: joinedId, at: new Date().toISOString() };
      return {
        ...snapshot,
        session: { ...snapshot.session, participants },
        events: snapshot.events.some((event) => event.id === joinedEvent.id) ? snapshot.events : [...snapshot.events, joinedEvent],
        revision: snapshot.revision + 1,
      };
    });
  }

  publishEvent(sessionId: string, event: TeamWorkoutEvent) {
    return mutateSession(sessionId, (snapshot) => {
      if (snapshot.events.some((item) => item.id === event.id)) return snapshot;
      return { ...snapshot, events: [...snapshot.events, event], revision: snapshot.revision + 1 };
    });
  }

  subscribe(sessionId: string, onSnapshot: (snapshot: TeamWorkoutSnapshot) => void, onError?: (error: Error) => void) {
    let cancelled = false;
    let lastRevision = -1;
    const poll = async () => {
      try {
        const snapshot = await getSnapshot(sessionId);
        if (!cancelled && snapshot && snapshot.revision !== lastRevision) {
          lastRevision = snapshot.revision;
          onSnapshot(snapshot);
        }
      } catch (error) {
        if (!cancelled) onError?.(error instanceof Error ? error : new Error("Synchronizace session selhala."));
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    const refresh = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }
}

export const teamWorkoutTransport = new FirestoreTeamWorkoutTransport();
