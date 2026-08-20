# Enginn 3B.3 Team Training — Firestore beta

## Architecture

Team Training uses the existing Firebase Authentication identity and a provider-neutral `TeamWorkoutTransport` abstraction.

Current PWA transport:

`Team UI / runner -> TeamWorkoutTransport -> Firestore REST -> teamSessions/{joinCode}`

The browser keeps its local UI state while Firestore stores an append-only logical event log and the current session snapshot. The transport polls approximately every 1.2 seconds and refreshes immediately when the tab becomes visible again. Event IDs are idempotent and writes use the Firestore document `updateTime` as an optimistic concurrency precondition.

This intentionally avoids adding the full Firebase SDK to the PWA. A later Capacitor/native client can replace only the transport with native/SDK listeners without rewriting the workout/session model.

## Session data

A session contains:

- a high-entropy readable capability code (`ENG-7K2M-9Q4P` style),
- an immutable snapshot of the selected workout,
- format (`shared`, `doubles`, `relay`),
- participant display names and technical user/participant IDs,
- assignments and shared progress events,
- session timestamps and status.

The team session does **not** contain HealthKit / Health Connect metrics, personal readiness, sleep, HRV, private notes, or the personal RPE saved into a user's Enginn history. Those stay in the user's personal result/cloud data.

## Beta Firestore rules

`teamSessions` must be enabled for authenticated users before remote multiplayer can work. The current beta uses the document ID as a capability secret; therefore anonymous access must remain disabled.

A minimal beta rule is conceptually:

```text
match /teamSessions/{sessionId} {
  allow read, write: if request.auth != null;
}
```

Do not enable public/anonymous access to this collection.

The capability code uses eight symbols from a 32-character alphabet (~40 bits) rather than the original four-digit prototype, making casual guessing impractical while remaining easy to share verbally.

## Production hardening path

Before broad public rollout, migrate the session document from a single JSON payload to structured fields/subcollections:

- `hostUserId`
- `participantUserIds`
- `sessionSecretHash` or invite membership records
- `events/{eventId}`
- `participants/{userId}`

Then restrict reads/writes to session members and validate event authorship in Firestore rules. A server-side invite/join endpoint can atomically exchange the capability code for membership without granting generic authenticated reads.

Other recommended production controls:

- session expiry / TTL,
- rate limits on joins and progress events,
- maximum event count and payload size,
- explicit leave/kick controls,
- audit fields for moderation/debugging,
- push notifications only after opt-in.

## Reliability contract

The product should remain usable if connectivity briefly disappears. Each device owns its display state and sends small idempotent events. On reconnect it derives the current team state from the newest session snapshot/event log rather than assuming one phone is permanently authoritative.

The host may control session-level transitions, but the host phone should not become the sole source of truth for completed work.
