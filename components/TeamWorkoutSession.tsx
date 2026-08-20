"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHyroxData } from "@/hooks/useHyroxData";
import { loadCloudUser } from "@/lib/firebase-rest";
import { loadTeamProfile, rememberTeammates } from "@/lib/team-profile";
import type { TeamStepAssignment, TeamWorkoutEvent, TeamWorkoutSnapshot } from "@/lib/team-training";
import { teamWorkoutTransport } from "@/lib/team-training-firestore";
import {
  buildTeamAssignments,
  buildTeamResult,
  canParticipantWork,
  canStartTeamSession,
  deriveTeamWorkoutState,
} from "@/lib/team-workout-engine";

const FORMAT_LABELS = { shared: "Společný workout", doubles: "Partner / Doubles", relay: "Relay" } as const;
const MODE_LABELS = {
  solo: "jeden sportovec",
  simultaneous: "všichni současně",
  "shared-reps": "společné opakování",
  "shared-distance": "společná vzdálenost",
  relay: "štafeta",
  "you-go-i-go": "you go / I go",
} as const;

function clock(seconds: number | undefined) {
  if (seconds === undefined) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function event<T extends TeamWorkoutEvent["type"]>(type: T, payload: Omit<Extract<TeamWorkoutEvent, { type: T }>, "id" | "type" | "at">): Extract<TeamWorkoutEvent, { type: T }> {
  return { id: crypto.randomUUID(), type, at: new Date().toISOString(), ...payload } as Extract<TeamWorkoutEvent, { type: T }>;
}

function targetLabel(assignment: TeamStepAssignment, reps: number, distance: number) {
  if (assignment.targetReps) return `${reps} / ${assignment.targetReps} opakování`;
  if (assignment.targetDistanceMeters) return `${distance} / ${assignment.targetDistanceMeters} m`;
  return undefined;
}

export default function TeamWorkoutSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { data, addResult } = useHyroxData();
  const [user] = useState(() => loadCloudUser());
  const [snapshot, setSnapshot] = useState<TeamWorkoutSnapshot>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [rpe, setRpe] = useState(7);
  const participantId = user ? `athlete-${user.uid}` : "";
  const profile = useMemo(() => loadTeamProfile(user), [user?.uid]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const connect = async () => {
      try {
        const current = await teamWorkoutTransport.getSession(sessionId);
        if (!current) throw new Error("Týmová session nebyla nalezena.");
        let joined = current;
        if (!current.session.participants.some((participant) => participant.userId === user.uid)) {
          joined = await teamWorkoutTransport.joinSession(sessionId, {
            id: participantId,
            userId: user.uid,
            displayName: profile.displayName,
            role: current.session.hostUserId === user.uid ? "host" : "athlete",
            status: "joined",
            joinedAt: new Date().toISOString(),
          });
        }
        if (cancelled) return;
        setSnapshot(joined);
        unsubscribe = teamWorkoutTransport.subscribe(sessionId, setSnapshot, (reason) => setError(reason.message));
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Připojení k session selhalo.");
      }
    };
    void connect();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [participantId, profile.displayName, sessionId, user]);

  const session = snapshot?.session;
  const state = useMemo(() => session && snapshot ? deriveTeamWorkoutState(session, snapshot.events) : undefined, [session, snapshot]);
  const me = session?.participants.find((participant) => participant.id === participantId || participant.userId === user?.uid);
  const isHost = Boolean(user && session?.hostUserId === user.uid);
  const ready = Boolean(state && me && state.readyParticipantIds.includes(me.id));
  const current = state?.currentAssignment;
  const progress = current && state ? state.assignmentProgress[current.id] : undefined;
  const canWork = Boolean(current && me && state && canParticipantWork(current, me.id, state));
  const teamResult = useMemo(() => session && snapshot ? buildTeamResult(session, snapshot.events) : undefined, [session, snapshot]);
  const existingResult = data.results.find((result) => result.teamSessionId === sessionId);

  async function publish(teamEvent: TeamWorkoutEvent) {
    setBusy(true); setError(undefined);
    try { setSnapshot(await teamWorkoutTransport.publishEvent(sessionId, teamEvent)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Akci se nepodařilo synchronizovat."); }
    finally { setBusy(false); }
  }

  async function toggleReady() {
    if (!me) return;
    await publish(event("participant-ready", { participantId: me.id, ready: !ready }));
  }

  async function startSession() {
    if (!session || !state || !me || !isHost || !canStartTeamSession(session, state)) return;
    setBusy(true); setError(undefined);
    try {
      const assignments = buildTeamAssignments({ template: session.workoutTemplate, participants: session.participants, format: session.format });
      const startedAt = new Date().toISOString();
      const updated = await teamWorkoutTransport.updateSession(session.id, { assignments, status: "running", startedAt });
      setSnapshot(await teamWorkoutTransport.publishEvent(session.id, { id: "session-started", type: "session-started", participantId: me.id, at: startedAt }));
      if (!updated.session.assignments.length) throw new Error("Workout nemá žádné týmové úseky.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Start session selhal."); }
    finally { setBusy(false); }
  }

  async function addProgress(kind: "reps" | "distance", value: number) {
    if (!me || !current || !canWork) return;
    await publish(event("step-progress", {
      participantId: me.id,
      assignmentId: current.id,
      ...(kind === "reps" ? { repsDelta: value } : { distanceMetersDelta: value }),
    }));
  }

  async function completeMyStep() {
    if (!me || !current || !canWork) return;
    await publish(event("participant-step-completed", { participantId: me.id, assignmentId: current.id }));
  }

  async function completeTeamStep() {
    if (!me || !current || !isHost) return;
    await publish(event("team-step-completed", { participantId: me.id, assignmentId: current.id }));
  }

  async function handoff() {
    if (!me || !current || !progress?.activeParticipantId || progress.activeParticipantId !== me.id) return;
    const index = current.participantIds.indexOf(me.id);
    const next = current.participantIds[(index + 1) % current.participantIds.length];
    if (!next || next === me.id) return;
    await publish(event("handoff", { participantId: me.id, nextParticipantId: next, assignmentId: current.id }));
  }

  useEffect(() => {
    if (!session || !state || !me || !isHost || state.status !== "running" || state.currentAssignment) return;
    const alreadyDone = snapshot?.events.some((item) => item.type === "session-completed");
    if (alreadyDone) return;
    const completedAt = new Date().toISOString();
    void teamWorkoutTransport.updateSession(session.id, { status: "completed", completedAt })
      .then(() => teamWorkoutTransport.publishEvent(session.id, { id: "session-completed", type: "session-completed", participantId: me.id, at: completedAt }))
      .then(setSnapshot)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Dokončení session selhalo."));
  }, [isHost, me, session, snapshot?.events, state]);

  async function savePersonalResult() {
    if (!session || !state || !me || !teamResult || existingResult) return;
    setBusy(true); setError(undefined);
    try {
      const durationSeconds = teamResult.teamDurationSeconds ?? Math.max(1, Math.round((Date.now() - Date.parse(state.startedAt ?? new Date().toISOString())) / 1000));
      await teamWorkoutTransport.publishEvent(session.id, event("participant-finished", { participantId: me.id, durationSeconds, rpe }));
      const contribution = state.contributions[me.id] ?? { participantId: me.id, reps: 0, distanceMeters: 0, durationSeconds: 0, completedAssignments: 0 };
      addResult({
        templateId: session.workoutTemplate.id,
        workoutTitle: session.workoutTemplate.title,
        workoutCode: session.workoutTemplate.metadata?.workoutCode,
        templateVersion: session.workoutTemplate.metadata?.templateVersion,
        metadataSnapshot: session.workoutTemplate.metadata ? structuredClone(session.workoutTemplate.metadata) : undefined,
        teamSessionId: session.id,
        teamJoinCode: session.joinCode,
        teamFormat: session.format,
        teamContribution: {
          reps: contribution.reps,
          distanceMeters: contribution.distanceMeters,
          durationSeconds: contribution.durationSeconds,
          completedAssignments: contribution.completedAssignments,
        },
        completedAt: new Date().toISOString(),
        durationSeconds,
        rpe,
        weights: "",
        notes: `Týmový workout · ${FORMAT_LABELS[session.format]}`,
        splits: [],
        source: "team",
      });
      rememberTeammates(session.id, session.participants, me.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Výsledek se nepodařilo uložit."); }
    finally { setBusy(false); }
  }

  async function shareSession() {
    if (!session) return;
    const url = `${window.location.origin}/team/session/${encodeURIComponent(session.joinCode)}`;
    const text = `Přidej se ke mně na Enginn: ${session.workoutTemplate.title} · kód ${session.joinCode}`;
    try {
      if (navigator.share) await navigator.share({ title: "Enginn Team Training", text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
    } catch { /* user cancelled share */ }
  }

  if (!user) return <main className="runner-shell grid min-h-dvh place-items-center px-5 text-white"><section className="ui-card max-w-sm p-6 text-center"><h1 className="text-2xl font-black">Přihlas se do Enginnu</h1><p className="mt-2 text-zinc-400">Pro připojení k týmové session potřebujeme tvůj účet.</p><Link href="/account" className="ui-button ui-button-primary mt-5 w-full">Přihlásit se</Link></section></main>;
  if (!session || !state || !me) return <main className="runner-shell grid min-h-dvh place-items-center px-5 text-zinc-400">{error ?? "Připojuji týmovou session…"}</main>;

  if (state.status === "completed") return (
    <main className="runner-shell safe-screen min-h-dvh px-4 text-white">
      <section className="mx-auto w-full max-w-md py-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Team Result</p>
        <h1 className="mt-1 text-3xl font-black">{session.workoutTemplate.title}</h1>
        <div className="ui-card ui-card-accent mt-5 p-5"><p className="text-xs font-black uppercase tracking-wider text-zinc-500">Týmový čas</p><p className="mt-1 font-mono text-5xl font-black text-accent">{clock(teamResult?.teamDurationSeconds)}</p><p className="mt-2 text-sm text-zinc-400">{FORMAT_LABELS[session.format]} · {session.joinCode}</p></div>
        <div className="mt-4 space-y-3">{teamResult?.participants.map((participant) => <div key={participant.participantId} className="ui-card p-4"><div className="flex items-center justify-between"><p className="font-black">{participant.displayName}</p><span className="ui-chip">{participant.completedAssignments} úseků</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm"><div className="ui-inset p-2"><b>{participant.reps}</b><span className="block text-[10px] text-zinc-500">reps</span></div><div className="ui-inset p-2"><b>{participant.distanceMeters} m</b><span className="block text-[10px] text-zinc-500">distance</span></div><div className="ui-inset p-2"><b>{clock(participant.durationSeconds)}</b><span className="block text-[10px] text-zinc-500">tracked work</span></div></div></div>)}</div>
        {!existingResult ? <section className="ui-card mt-4 p-5"><p className="font-black">Jak těžké to pro tebe bylo?</p><div className="mt-3 grid grid-cols-5 gap-2">{[5,6,7,8,9,10].map((value) => <button key={value} type="button" onClick={() => setRpe(value)} className={rpe === value ? "ui-button ui-button-primary px-2" : "ui-button ui-button-outline px-2"}>{value}</button>)}</div><button type="button" disabled={busy} onClick={() => void savePersonalResult()} className="ui-button ui-button-primary mt-4 w-full">Uložit do mojí historie</button><p className="mt-3 text-xs leading-5 text-zinc-500">Do týmu se sdílí společný postup. Tvoje RPE a budoucí Health data zůstávají ve tvém osobním výsledku.</p></section> : <p className="ui-feedback ui-feedback-success mt-4 text-sm">Týmový workout už je uložený v tvojí historii.</p>}
        <div className="mt-4 grid gap-2"><Link href="/history" className="ui-button ui-button-primary">Historie</Link><Link href="/team" className="ui-button ui-button-outline">Další týmový workout</Link></div>
        {error && <p className="ui-feedback mt-4 text-sm text-amber-200">{error}</p>}
      </section>
    </main>
  );

  if (state.status === "lobby" || state.status === "ready") return (
    <main className="runner-shell safe-screen min-h-dvh px-4 text-white"><section className="mx-auto w-full max-w-md py-5">
      <button type="button" onClick={() => router.push("/team")} className="ui-button ui-button-ghost ui-button-sm">← Týmové tréninky</button>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-accent">{FORMAT_LABELS[session.format]}</p><h1 className="mt-1 text-3xl font-black">{session.workoutTemplate.title}</h1>
      <div className="ui-card ui-card-accent mt-5 p-5 text-center"><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Join kód</p><p className="mt-2 font-mono text-4xl font-black text-accent">{session.joinCode}</p><button type="button" onClick={() => void shareSession()} className="ui-button ui-button-outline mt-4 w-full">Sdílet pozvánku</button></div>
      {session.scheduledFor && <p className="ui-feedback mt-4 text-sm">Naplánováno: <b>{new Date(session.scheduledFor).toLocaleString("cs-CZ")}</b></p>}
      <section className="ui-card mt-4 p-5"><div className="flex items-center justify-between"><h2 className="font-black">Tým</h2><span className="ui-chip">{session.participants.length}/{session.participantLimit}</span></div><div className="mt-3 space-y-2">{session.participants.map((participant) => <div key={participant.id} className="ui-inset flex items-center justify-between px-4 py-3"><div><p className="font-bold">{participant.displayName}</p><p className="text-xs text-zinc-500">{participant.role === "host" ? "Host" : "Sportovec"}</p></div><span className={state.readyParticipantIds.includes(participant.id) ? "ui-chip ui-chip-accent" : "ui-chip"}>{state.readyParticipantIds.includes(participant.id) ? "READY" : "čeká"}</span></div>)}</div></section>
      <button type="button" disabled={busy} onClick={() => void toggleReady()} className={ready ? "ui-button ui-button-outline mt-4 w-full" : "ui-button ui-button-primary mt-4 w-full"}>{ready ? "Nejsem připraven" : "Jsem READY"}</button>
      {isHost && <button type="button" disabled={busy || !canStartTeamSession(session, state)} onClick={() => void startSession()} className="ui-button ui-button-accent mt-2 w-full">START TEAM WORKOUT</button>}
      {isHost && !canStartTeamSession(session, state) && <p className="mt-3 text-center text-xs text-zinc-500">Start se odemkne, až budou alespoň dva sportovci READY.</p>}
      {error && <p className="ui-feedback mt-4 text-sm text-amber-200">{error}</p>}
    </section></main>
  );

  if (!current || !progress) return <main className="runner-shell grid min-h-dvh place-items-center text-zinc-400">Synchronizuji další úsek…</main>;
  const target = targetLabel(current, progress.reps, progress.distanceMeters);
  const activeName = session.participants.find((participant) => participant.id === progress.activeParticipantId)?.displayName;

  return (
    <main className="runner-shell safe-screen min-h-dvh px-4 text-white"><section className="mx-auto w-full max-w-md py-5">
      <header className="flex items-center justify-between"><span className="ui-chip ui-chip-accent">{FORMAT_LABELS[session.format]}</span><span className="font-mono text-sm text-zinc-500">{current.sequence + 1}/{session.assignments.length}</span></header>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-accent">{current.blockTitle}</p><h1 className="mt-1 text-4xl font-black leading-tight">{current.stepName}</h1>{current.stepDetail && <p className="mt-2 text-lg text-zinc-400">{current.stepDetail}</p>}
      <div className="mt-4 flex flex-wrap gap-2"><span className="ui-chip">{MODE_LABELS[current.mode]}</span>{activeName && <span className="ui-chip ui-chip-accent">Na řadě: {activeName}</span>}</div>
      {target && <div className="ui-card ui-card-accent mt-5 p-6 text-center"><p className="text-xs uppercase tracking-wider text-zinc-500">Týmový postup</p><p className="mt-2 text-3xl font-black text-accent">{target}</p></div>}

      <section className="ui-card mt-5 p-5">
        {canWork ? <>
          {(current.mode === "shared-reps") && <div className="grid grid-cols-3 gap-2">{[1,5,10].map((value) => <button key={value} type="button" disabled={busy} onClick={() => void addProgress("reps", value)} className="ui-button ui-button-primary">+{value}</button>)}</div>}
          {(current.mode === "shared-distance") && <div className="grid grid-cols-3 gap-2">{[100,250,500].map((value) => <button key={value} type="button" disabled={busy} onClick={() => void addProgress("distance", value)} className="ui-button ui-button-primary">+{value} m</button>)}</div>}
          {(current.mode === "simultaneous" || current.mode === "solo" || current.mode === "relay") && <button type="button" disabled={busy || progress.completedByParticipantIds.includes(me.id)} onClick={() => void completeMyStep()} className="ui-button ui-button-primary w-full">{progress.completedByParticipantIds.includes(me.id) ? "Hotovo · čekám na tým" : "MŮJ ÚSEK HOTOVO"}</button>}
          {current.mode === "you-go-i-go" && <div className="grid gap-2"><button type="button" disabled={busy} onClick={() => void handoff()} className="ui-button ui-button-accent w-full">PŘEDAT →</button><button type="button" disabled={busy} onClick={() => void completeMyStep()} className="ui-button ui-button-outline w-full">Stanice hotová</button></div>}
          {progress.activeParticipantId && current.mode !== "you-go-i-go" && current.participantIds.length > 1 && <button type="button" disabled={busy} onClick={() => void handoff()} className="ui-button ui-button-accent mt-3 w-full">PŘEDAT →</button>}
        </> : <div className="text-center"><p className="text-2xl font-black">Připrav se</p><p className="mt-2 text-zinc-400">Teď pracuje {activeName ?? "tvůj týmový parťák"}. Na tvém telefonu se další stav přepne automaticky.</p></div>}
        {isHost && <button type="button" disabled={busy} onClick={() => void completeTeamStep()} className="ui-button ui-button-ghost mt-4 w-full text-xs">Host: přeskočit / označit týmově hotovo</button>}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2">{session.participants.map((participant) => { const contribution = state.contributions[participant.id]; return <div key={participant.id} className="ui-card p-3"><p className="truncate text-sm font-black">{participant.displayName}</p><p className="mt-1 text-xs text-zinc-500">{contribution?.reps ?? 0} reps · {contribution?.distanceMeters ?? 0} m</p></div>; })}</section>
      <p className="mt-5 text-center text-xs text-zinc-600">Session {session.joinCode} · stav se synchronizuje mezi telefony. Osobní RPE a Health data se nesdílí.</p>
      {error && <p className="ui-feedback mt-4 text-sm text-amber-200">{error}</p>}
    </section></main>
  );
}
