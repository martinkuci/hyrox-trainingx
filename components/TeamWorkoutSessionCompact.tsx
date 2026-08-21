"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RunnerBrandButton from "@/components/RunnerBrandButton";
import { useHyroxData } from "@/hooks/useHyroxData";
import { loadCloudUser } from "@/lib/firebase-rest";
import { clearActiveTeamSession, saveActiveTeamSession } from "@/lib/team-active-session";
import {
  adaptiveProgressOptions,
  buildTeamPacingPlan,
  currentAssignmentElapsedSeconds,
  deriveTeamWorkoutTiming,
  pacingDeltaBeforeAssignment,
  phaseForAssignment,
  recommendedWorkoutTargetSeconds,
  suggestedTeamSplit,
  workoutStartedAt,
} from "@/lib/team-pacing";
import { loadTeamProfile, rememberTeammates } from "@/lib/team-profile";
import type { TeamStepAssignment, TeamWorkoutEvent, TeamWorkoutSnapshot } from "@/lib/team-training";
import { teamWorkoutTransport } from "@/lib/team-training-firestore";
import {
  buildTeamAssignments,
  buildTeamResult,
  canParticipantWork,
  canStartTeamSession,
  deriveTeamWorkoutState,
  requiresStarterClaim,
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
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  const parts = hours > 0 ? [hours, minutes, rest] : [minutes, rest];
  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}

function pacingStatus(deltaSeconds: number | undefined) {
  if (deltaSeconds === undefined) return undefined;
  if (Math.abs(deltaSeconds) <= 5) return "na plánu";
  return deltaSeconds < 0 ? `${clock(Math.abs(deltaSeconds))} před plánem` : `${clock(deltaSeconds)} za plánem`;
}

function liveSegmentStatus(deltaSeconds: number | undefined, projected: boolean) {
  if (deltaSeconds === undefined) return undefined;
  if (Math.abs(deltaSeconds) <= 5) return projected ? "odhad na cíli" : "v cílovém čase";
  if (deltaSeconds < 0) return projected
    ? `odhad −${clock(Math.abs(deltaSeconds))}`
    : `rezerva ${clock(Math.abs(deltaSeconds))}`;
  return `+${clock(deltaSeconds)} nad cílem`;
}

function event<T extends TeamWorkoutEvent["type"]>(
  type: T,
  payload: Omit<Extract<TeamWorkoutEvent, { type: T }>, "id" | "type" | "at">,
): Extract<TeamWorkoutEvent, { type: T }> {
  return { id: crypto.randomUUID(), type, at: new Date().toISOString(), ...payload } as Extract<TeamWorkoutEvent, { type: T }>;
}

function targetLabel(assignment: TeamStepAssignment, reps: number, distance: number) {
  if (assignment.targetReps) return `${reps} / ${assignment.targetReps} reps`;
  if (assignment.targetDistanceMeters) return `${distance} / ${assignment.targetDistanceMeters} m`;
  return undefined;
}

function modeLabel(assignment: TeamStepAssignment) {
  if (assignment.mode !== "simultaneous") return MODE_LABELS[assignment.mode];
  if (phaseForAssignment(assignment) !== "work") return "společně / volně";
  return MODE_LABELS.simultaneous;
}

function phaseTitle(assignment: TeamStepAssignment) {
  const phase = phaseForAssignment(assignment);
  if (phase === "warmup") return "Rozcvičení";
  if (phase === "cooldown") return "Zklidnění";
  return assignment.blockTitle;
}

export default function TeamWorkoutSessionCompact({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { data, addResult } = useHyroxData();
  const [user] = useState(() => loadCloudUser());
  const [snapshot, setSnapshot] = useState<TeamWorkoutSnapshot>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [rpe, setRpe] = useState(7);
  const [now, setNow] = useState(() => Date.now());
  const [showPrevious, setShowPrevious] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [customProgress, setCustomProgress] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastCountdownCueRef = useRef<number | null>(null);
  const workoutStartPublishingRef = useRef(false);
  const participantId = user ? `athlete-${user.uid}` : "";
  const profile = useMemo(() => loadTeamProfile(user), [user?.uid]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const connect = async () => {
      try {
        const currentSnapshot = await teamWorkoutTransport.getSession(sessionId);
        if (!currentSnapshot) throw new Error("Týmová session nebyla nalezena.");
        let joined = currentSnapshot;
        if (!currentSnapshot.session.participants.some((participant) => participant.userId === user.uid)) {
          joined = await teamWorkoutTransport.joinSession(sessionId, {
            id: participantId,
            userId: user.uid,
            displayName: profile.displayName,
            role: currentSnapshot.session.hostUserId === user.uid ? "host" : "athlete",
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
  const currentPhase = current ? phaseForAssignment(current) : undefined;
  const progress = current && state ? state.assignmentProgress[current.id] : undefined;
  const baseCanWork = Boolean(current && me && state && canParticipantWork(current, me.id, state));
  const teamResult = useMemo(() => session && snapshot ? buildTeamResult(session, snapshot.events) : undefined, [session, snapshot]);
  const existingResult = data.results.find((result) => result.teamSessionId === sessionId);

  const sessionStartMs = state?.startedAt ? Date.parse(state.startedAt) : NaN;
  const sessionCountdownSeconds = state?.status === "running" && Number.isFinite(sessionStartMs)
    ? Math.max(0, Math.ceil((sessionStartMs - now) / 1000))
    : 0;
  const explicitWorkoutStartedAt = snapshot ? workoutStartedAt(snapshot.events) : undefined;
  const workoutStartMs = explicitWorkoutStartedAt ? Date.parse(explicitWorkoutStartedAt) : NaN;
  const workoutCountdownSeconds = currentPhase === "work" && Number.isFinite(workoutStartMs) && now < workoutStartMs
    ? Math.max(0, Math.ceil((workoutStartMs - now) / 1000))
    : 0;
  const countdownSeconds = Math.max(sessionCountdownSeconds, workoutCountdownSeconds);
  const workoutHasStarted = currentPhase !== "work" || (Number.isFinite(workoutStartMs) && now >= workoutStartMs);
  const canWork = baseCanWork && sessionCountdownSeconds === 0 && workoutHasStarted;

  const previous = state && session && state.currentAssignmentIndex > 0 ? session.assignments[state.currentAssignmentIndex - 1] : undefined;
  const next = state && session ? session.assignments[state.currentAssignmentIndex + 1] : undefined;
  const pacingTargetSeconds = session ? session.pacingTargetSeconds ?? recommendedWorkoutTargetSeconds(session.workoutTemplate) : 0;
  const pacingPlan = useMemo(() => session && session.assignments.length ? buildTeamPacingPlan({
    assignments: session.assignments,
    targetWorkoutSeconds: session.pacingTargetSeconds ?? recommendedWorkoutTargetSeconds(session.workoutTemplate),
    participantCount: session.participants.length,
    runningTarget: session.workoutTemplate.metadata?.runningTarget,
    format: session.format,
  }) : {}, [session]);
  const previewAssignments = useMemo(() => session ? buildTeamAssignments({ template: session.workoutTemplate, participants: session.participants, format: session.format }) : [], [session]);
  const previewPacingPlan = useMemo(() => session && previewAssignments.length ? buildTeamPacingPlan({
    assignments: previewAssignments,
    targetWorkoutSeconds: session.pacingTargetSeconds ?? recommendedWorkoutTargetSeconds(session.workoutTemplate),
    participantCount: session.participants.length,
    runningTarget: session.workoutTemplate.metadata?.runningTarget,
    format: session.format,
  }) : {}, [previewAssignments, session]);
  const timing = useMemo(() => session && state && snapshot
    ? deriveTeamWorkoutTiming(session.assignments, snapshot.events, state.startedAt, state.completedAt, now)
    : undefined, [now, session, snapshot, state]);

  const workoutReadyParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of snapshot?.events ?? []) {
      if (item.type !== "workout-ready") continue;
      if (item.ready) ids.add(item.participantId);
      else ids.delete(item.participantId);
    }
    return [...ids];
  }, [snapshot?.events]);
  const workoutReady = Boolean(me && workoutReadyParticipantIds.includes(me.id));
  const joinedParticipants = session?.participants.filter((participant) => participant.status !== "left" && participant.status !== "invited") ?? [];
  const allWorkoutReady = joinedParticipants.length >= 2 && joinedParticipants.every((participant) => workoutReadyParticipantIds.includes(participant.id));
  const needsWorkoutBriefing = Boolean(current && currentPhase === "work" && !explicitWorkoutStartedAt);

  function ensureAudio() {
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
    } catch {
      // Audio is optional. The synchronized visual countdown remains authoritative.
    }
  }

  function countdownCue(seconds: number) {
    const context = audioContextRef.current;
    if (context) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = seconds === 1 ? 1440 : 1120;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(seconds === 1 ? 0.5 : 0.35, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.27);
    }
    if ("vibrate" in navigator) navigator.vibrate(seconds === 1 ? [90, 45, 90] : 70);
  }

  function rememberActiveSession() {
    if (!session || !state) return;
    saveActiveTeamSession({
      sessionId: session.id,
      joinCode: session.joinCode,
      workoutTitle: session.workoutTemplate.title,
      format: session.format,
      status: state.status,
      startedAt: state.startedAt,
    });
  }

  function minimizeSession() {
    rememberActiveSession();
    router.push("/");
  }

  useEffect(() => {
    if (!session || !state || !me) return;
    if (state.status === "completed" || state.status === "cancelled") {
      clearActiveTeamSession(session.id);
      return;
    }
    saveActiveTeamSession({
      sessionId: session.id,
      joinCode: session.joinCode,
      workoutTitle: session.workoutTemplate.title,
      format: session.format,
      status: state.status,
      startedAt: state.startedAt,
    });
  }, [me, session, state]);

  useEffect(() => {
    if (state?.status !== "running") return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [state?.startedAt, state?.status]);

  useEffect(() => {
    if (state?.status !== "running" || countdownSeconds < 1 || countdownSeconds > 3) return;
    if (lastCountdownCueRef.current === countdownSeconds) return;
    lastCountdownCueRef.current = countdownSeconds;
    countdownCue(countdownSeconds);
  }, [countdownSeconds, state?.status]);

  useEffect(() => () => { void audioContextRef.current?.close(); }, []);

  useEffect(() => {
    if (!session || !me || !isHost || !needsWorkoutBriefing || !allWorkoutReady || explicitWorkoutStartedAt) return;
    if (workoutStartPublishingRef.current) return;
    workoutStartPublishingRef.current = true;
    ensureAudio();
    const at = new Date(Date.now() + 10_000).toISOString();
    void teamWorkoutTransport.publishEvent(session.id, {
      id: crypto.randomUUID(),
      type: "workout-started",
      participantId: me.id,
      at,
    }).then((nextSnapshot) => {
      setSnapshot(nextSnapshot);
      setNow(Date.now());
      lastCountdownCueRef.current = null;
    }).catch((reason) => {
      workoutStartPublishingRef.current = false;
      setError(reason instanceof Error ? reason.message : "Start workoutu se nepodařilo synchronizovat.");
    });
  }, [allWorkoutReady, explicitWorkoutStartedAt, isHost, me, needsWorkoutBriefing, session]);

  async function publish(teamEvent: TeamWorkoutEvent) {
    setBusy(true); setError(undefined);
    try { setSnapshot(await teamWorkoutTransport.publishEvent(sessionId, teamEvent)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Akci se nepodařilo synchronizovat."); }
    finally { setBusy(false); }
  }

  async function toggleReady() {
    if (!me) return;
    ensureAudio();
    await publish(event("participant-ready", { participantId: me.id, ready: !ready }));
  }

  async function toggleWorkoutReady() {
    if (!me || !needsWorkoutBriefing) return;
    ensureAudio();
    await publish(event("workout-ready", { participantId: me.id, ready: !workoutReady }));
  }

  async function startSession() {
    if (!session || !state || !me || !isHost || !canStartTeamSession(session, state)) return;
    setBusy(true); setError(undefined); ensureAudio();
    try {
      const assignments = buildTeamAssignments({ template: session.workoutTemplate, participants: session.participants, format: session.format });
      if (!assignments.length) throw new Error("Workout nemá žádné týmové úseky.");
      const startedAt = new Date(Date.now() + 10_000).toISOString();
      await teamWorkoutTransport.updateSession(session.id, { assignments, status: "running", startedAt });
      setSnapshot(await teamWorkoutTransport.publishEvent(session.id, { id: "session-started", type: "session-started", participantId: me.id, at: startedAt }));
      setNow(Date.now());
      lastCountdownCueRef.current = null;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Start session selhal."); }
    finally { setBusy(false); }
  }

  async function claimCurrentStep() {
    if (!me || !current || !progress || progress.activeParticipantId || countdownSeconds > 0 || !requiresStarterClaim(current)) return;
    await publish(event("step-started", { participantId: me.id, assignmentId: current.id }));
  }

  async function addProgress(kind: "reps" | "distance", value: number) {
    if (!me || !current || !canWork || value <= 0) return;
    await publish(event("step-progress", {
      participantId: me.id,
      assignmentId: current.id,
      ...(kind === "reps" ? { repsDelta: value } : { distanceMetersDelta: value }),
    }));
  }

  async function addCustomProgress(kind: "reps" | "distance") {
    const value = Math.max(0, Number(customProgress));
    if (!value) return;
    setCustomProgress("");
    await addProgress(kind, value);
  }

  async function completeMyStep() {
    if (!me || !current || !canWork) return;
    if (currentPhase === "work" && snapshot && ["simultaneous", "solo", "relay"].includes(current.mode)) {
      const elapsed = currentAssignmentElapsedSeconds(session?.assignments ?? [], snapshot.events, state?.startedAt, current.id, Date.now());
      if (elapsed && elapsed > 0) {
        await publish(event("step-progress", { participantId: me.id, assignmentId: current.id, durationSecondsDelta: elapsed }));
      }
    }
    await publish(event("participant-step-completed", { participantId: me.id, assignmentId: current.id }));
  }

  async function completeTeamStep() {
    if (!me || !current || !isHost || countdownSeconds > 0) return;
    await publish(event("team-step-completed", { participantId: me.id, assignmentId: current.id }));
  }

  async function handoff() {
    if (!me || !current || !progress?.activeParticipantId || progress.activeParticipantId !== me.id || countdownSeconds > 0) return;
    const index = current.participantIds.indexOf(me.id);
    const nextParticipant = current.participantIds[(index + 1) % current.participantIds.length];
    if (!nextParticipant || nextParticipant === me.id) return;
    await publish(event("handoff", { participantId: me.id, nextParticipantId: nextParticipant, assignmentId: current.id }));
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
    if (!session || !state || !me || !teamResult || existingResult || !timing) return;
    setBusy(true); setError(undefined);
    try {
      const durationSeconds = Math.max(1, timing.workoutSeconds || teamResult.teamDurationSeconds || 1);
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
        sessionDurationSeconds: timing.sessionSeconds,
        warmupDurationSeconds: timing.warmupSeconds,
        cooldownDurationSeconds: timing.cooldownSeconds,
        pacingTargetSeconds,
        rpe,
        weights: "",
        notes: `Týmový workout · ${FORMAT_LABELS[session.format]} · celkem ${clock(timing.sessionSeconds)} · warm-up ${clock(timing.warmupSeconds)} · příprava ${clock(timing.briefingSeconds)} · cooldown ${clock(timing.cooldownSeconds)} · pacing cíl ${clock(pacingTargetSeconds)}`,
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
        <div className="ui-card ui-card-accent mt-5 p-5">
          <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Workout čas</p>
          <p className="mt-1 font-mono text-5xl font-black text-accent">{clock(timing?.workoutSeconds)}</p>
          <p className="mt-2 text-sm text-zinc-400">{FORMAT_LABELS[session.format]} · {session.joinCode}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="ui-inset p-2"><b>{clock(timing?.warmupSeconds)}</b><span className="block text-[10px] text-zinc-500">warm-up</span></div>
            <div className="ui-inset p-2"><b>{clock(timing?.sessionSeconds)}</b><span className="block text-[10px] text-zinc-500">celkem</span></div>
            <div className="ui-inset p-2"><b>{clock(timing?.cooldownSeconds)}</b><span className="block text-[10px] text-zinc-500">cooldown</span></div>
          </div>
          {(timing?.briefingSeconds ?? 0) > 0 && <p className="mt-3 text-center text-xs text-zinc-500">Příprava / strategie: {clock(timing?.briefingSeconds)}</p>}
        </div>
        <div className="mt-4 space-y-3">{teamResult?.participants.map((participant) => <div key={participant.participantId} className="ui-card p-4"><div className="flex items-center justify-between gap-2"><p className="font-black">{participant.displayName}</p><span className="ui-chip">práce na {participant.completedAssignments} úsecích</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm"><div className="ui-inset p-2"><b>{participant.reps}</b><span className="block text-[10px] text-zinc-500">reps</span></div><div className="ui-inset p-2"><b>{participant.distanceMeters} m</b><span className="block text-[10px] text-zinc-500">distance</span></div><div className="ui-inset p-2"><b>{clock(participant.durationSeconds)}</b><span className="block text-[10px] text-zinc-500">tracked work</span></div></div></div>)}</div>
        {!existingResult ? <section className="ui-card mt-4 p-5"><p className="font-black">Jak náročný byl trénink?</p><p className="mt-1 text-xs text-zinc-500">1 = velmi lehký · 10 = maximum</p><div className="mt-3 grid grid-cols-5 gap-2">{[1,2,3,4,5,6,7,8,9,10].map((value) => <button key={value} type="button" onClick={() => setRpe(value)} className={rpe === value ? "ui-button ui-button-primary px-2" : "ui-button ui-button-outline px-2"}>{value}</button>)}</div><button type="button" disabled={busy} onClick={() => void savePersonalResult()} className="ui-button ui-button-primary mt-4 w-full">Uložit výsledek</button></section> : <p className="ui-feedback ui-feedback-success mt-4 text-sm">Týmový workout už je uložený v tvojí historii.</p>}
        <div className="mt-4 grid gap-2"><Link href="/" className="ui-button ui-button-primary">Zpět na hlavní obrazovku</Link><Link href="/history" className="ui-button ui-button-outline">Detail výsledku / Historie</Link><Link href="/team" className="ui-button ui-button-ghost">Nový týmový workout</Link></div>
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
      <section className="ui-card mt-4 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Pacing plán</p><p className="mt-1 font-black">Cíl workout části {clock(pacingTargetSeconds)}</p></div><span className="ui-chip">{session.pacingSource === "custom" ? "vlastní cíl" : session.pacingSource === "history" ? "z historie" : "odhad"}</span></div><div className="mt-3 space-y-2">{previewAssignments.filter((assignment) => phaseForAssignment(assignment) === "work").slice(0, 4).map((assignment) => <div key={assignment.id} className="ui-inset px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="font-bold">{assignment.stepName}</p><span className="font-mono text-sm text-accent">{clock(previewPacingPlan[assignment.id]?.targetSeconds)}</span></div></div>)}</div></section>
      <button type="button" disabled={busy} onClick={() => void toggleReady()} className={ready ? "ui-button ui-button-outline mt-4 w-full" : "ui-button ui-button-primary mt-4 w-full"}>{ready ? "Nejsem připraven" : "Jsem READY"}</button>
      {isHost && <button type="button" disabled={busy || !canStartTeamSession(session, state)} onClick={() => void startSession()} className="ui-button ui-button-accent mt-2 w-full">START SESSION · 10 s</button>}
      {isHost && !canStartTeamSession(session, state) && <p className="mt-3 text-center text-xs text-zinc-500">Start se odemkne, až budou alespoň dva sportovci READY.</p>}
      {error && <p className="ui-feedback mt-4 text-sm text-amber-200">{error}</p>}
    </section></main>
  );

  if (!current || !progress) return <main className="runner-shell grid min-h-dvh place-items-center text-zinc-400">Synchronizuji další úsek…</main>;

  const liveSession = session;
  const liveProgress = progress;
  const liveCurrent = current;
  const target = targetLabel(liveCurrent, liveProgress.reps, liveProgress.distanceMeters);
  const activeName = liveSession.participants.find((participant) => participant.id === liveProgress.activeParticipantId)?.displayName;
  const currentPacing = pacingPlan[liveCurrent.id];
  const pacingDeltaSeconds = snapshot ? pacingDeltaBeforeAssignment(liveSession.assignments, snapshot.events, state.startedAt, liveCurrent.id, pacingPlan) : undefined;
  const pacingState = currentPhase === "work" ? pacingStatus(pacingDeltaSeconds) : undefined;
  const segmentElapsedSeconds = currentPhase === "work" && snapshot
    ? currentAssignmentElapsedSeconds(liveSession.assignments, snapshot.events, state.startedAt, liveCurrent.id, now)
    : undefined;
  const progressFraction = liveCurrent.targetDistanceMeters
    ? Math.min(1, liveProgress.distanceMeters / liveCurrent.targetDistanceMeters)
    : liveCurrent.targetReps
      ? Math.min(1, liveProgress.reps / liveCurrent.targetReps)
      : undefined;
  const projectedSegmentSeconds = segmentElapsedSeconds !== undefined && progressFraction && progressFraction > 0.08
    ? Math.round(segmentElapsedSeconds / progressFraction)
    : undefined;
  const liveSegmentDeltaSeconds = currentPacing?.targetSeconds && segmentElapsedSeconds !== undefined
    ? (projectedSegmentSeconds ?? segmentElapsedSeconds) - currentPacing.targetSeconds
    : undefined;
  const liveSegmentState = currentPhase === "work" ? liveSegmentStatus(liveSegmentDeltaSeconds, projectedSegmentSeconds !== undefined) : undefined;
  const distanceOptions = adaptiveProgressOptions(liveCurrent.targetDistanceMeters, liveProgress.distanceMeters, "distance");
  const repOptions = adaptiveProgressOptions(liveCurrent.targetReps, liveProgress.reps, "reps");
  const splitSuggestion = suggestedTeamSplit(liveCurrent, liveSession.participants.length);
  const primaryClock = currentPhase === "warmup" ? timing?.warmupSeconds : currentPhase === "cooldown" ? timing?.cooldownSeconds : timing?.workoutSeconds;
  const primaryClockLabel = currentPhase === "warmup" ? "warm-up · mimo výsledek" : currentPhase === "cooldown" ? "cooldown · workout zmrazen" : "workout";
  const starterClaimRequired = currentPhase === "work" && requiresStarterClaim(liveCurrent) && !liveProgress.activeParticipantId;
  const starterLoads = liveCurrent.participantIds
    .map((id) => ({ id, seconds: state.contributions[id]?.durationSeconds ?? 0, name: liveSession.participants.find((participant) => participant.id === id)?.displayName ?? "Sportovec" }))
    .sort((left, right) => left.seconds - right.seconds);
  const recommendedStarter = starterLoads[0];
  const starterLoadDifference = starterLoads.length > 1 ? Math.max(0, starterLoads[starterLoads.length - 1].seconds - starterLoads[0].seconds) : 0;

  function participantLiveStatus(id: string) {
    const completed = liveProgress.completedByParticipantIds.includes(id);
    if (completed) return currentPhase === "warmup" ? "✓ rozcvičení" : currentPhase === "cooldown" ? "✓ zklidnění" : "✓ hotovo";
    if (starterClaimRequired) return "volba startu";
    if (liveProgress.activeParticipantId === id) return `na řadě · ${liveCurrent.stepName}`;
    if (liveCurrent.mode === "simultaneous") return currentPhase === "warmup" ? "rozcvičuje se" : currentPhase === "cooldown" ? "zklidňuje se" : "pracuje";
    return `čeká na ${activeName ?? "partnera"}`;
  }

  const workAssignments = liveSession.assignments.filter((assignment) => phaseForAssignment(assignment) === "work");
  const strategyRows = workAssignments.map((assignment) => ({ assignment, pacing: pacingPlan[assignment.id] }));

  if (needsWorkoutBriefing) return (
    <main className="runner-shell safe-screen h-dvh overflow-hidden px-3 text-white">
      <section className="mx-auto flex h-full w-full max-w-md flex-col py-2">
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="ui-chip ui-chip-accent justify-self-start">{FORMAT_LABELS[liveSession.format]}</span><RunnerBrandButton onClick={minimizeSession} /><div className="justify-self-end text-right"><p className="font-mono text-sm font-black">{clock(timing?.sessionSeconds)}</p><p className="text-[8px] uppercase tracking-wider text-zinc-600">session</p></div></header>
        <div className="mt-2 shrink-0"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-accent">Příprava na workout</p><h1 className="mt-1 text-2xl font-black leading-tight">Strategie před startem</h1><p className="mt-1 text-xs text-zinc-400">Workout čas zatím neběží. Projděte si plán, oba potvrďte připravenost a Enginn spustí synchronizovaný odpočet 10 s.</p></div>
        <div className="ui-card ui-card-accent mt-3 shrink-0 px-4 py-3"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-zinc-500">Cíl měřené části</p><p className="font-mono text-2xl font-black text-accent">{clock(pacingTargetSeconds)}</p></div><span className="ui-chip">{workAssignments.length} úseků</span></div></div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2">
          <div className="space-y-2">{strategyRows.map(({ assignment, pacing }) => <div key={assignment.id} className="ui-inset px-3 py-2"><div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-sm font-black">{assignment.stepName}</p><span className="shrink-0 font-mono text-xs text-accent">{clock(pacing?.targetSeconds)}</span></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500">{pacing?.paceLabel && <span>{pacing.paceLabel}</span>}{pacing?.splitSuggestion && <span>{pacing.splitSuggestion}</span>}</div></div>)}</div>
        </div>
        <div className="mt-3 shrink-0"><div className="grid grid-cols-2 gap-2">{joinedParticipants.map((participant) => <div key={participant.id} className={workoutReadyParticipantIds.includes(participant.id) ? "ui-inset border border-accent/40 px-3 py-2" : "ui-inset px-3 py-2"}><p className="truncate text-xs font-black">{participant.displayName}</p><p className={workoutReadyParticipantIds.includes(participant.id) ? "text-[10px] text-accent" : "text-[10px] text-zinc-500"}>{workoutReadyParticipantIds.includes(participant.id) ? "✓ připraven" : "čeká"}</p></div>)}</div><button type="button" disabled={busy} onClick={() => void toggleWorkoutReady()} className={workoutReady ? "ui-button ui-button-outline mt-2 w-full" : "ui-button ui-button-primary mt-2 w-full"}>{workoutReady ? "ZRUŠIT PŘIPRAVENOST" : "JSEM PŘIPRAVEN"}</button><p className="mt-1 text-center text-[10px] text-zinc-600">Kdo začne jednotlivá sdílená stanoviště se rozhoduje až na místě přes ZAČÍNÁM JÁ.</p></div>
        {error && <p className="mt-2 shrink-0 text-center text-xs text-amber-200">{error}</p>}
      </section>
    </main>
  );

  if (countdownSeconds > 0) return (
    <main className="runner-shell safe-screen flex h-dvh flex-col overflow-hidden px-4 text-center text-white">
      <header className="mx-auto grid w-full max-w-md shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="ui-chip ui-chip-accent justify-self-start">{FORMAT_LABELS[liveSession.format]}</span><RunnerBrandButton onClick={minimizeSession} /><span className="justify-self-end font-mono text-xs text-zinc-500">{liveCurrent.sequence + 1}/{liveSession.assignments.length}</span></header>
      <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center"><p className="text-xs font-black uppercase tracking-[0.25em] text-accent">{workoutCountdownSeconds > 0 ? "Workout startuje" : "Připrav se"}</p><p className="mt-2 text-7xl font-black tabular-nums">{countdownSeconds}</p><p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{phaseTitle(liveCurrent)}</p><h1 className="mt-1 text-3xl font-black leading-tight">{liveCurrent.stepName}</h1><p className="mt-4 text-xs text-zinc-500">Odpočet je synchronizovaný na všech telefonech.</p></section>
    </main>
  );

  return (
    <main className="runner-shell safe-screen h-dvh overflow-hidden px-3 text-white">
      <section className="mx-auto flex h-full w-full max-w-md flex-col py-2">
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="ui-chip ui-chip-accent justify-self-start">{FORMAT_LABELS[liveSession.format]}</span><RunnerBrandButton onClick={minimizeSession} /><div className="justify-self-end text-right"><p className="font-mono text-sm font-black text-zinc-200">{clock(timing?.sessionSeconds)}</p><p className="text-[8px] uppercase tracking-wider text-zinc-600">session</p></div></header>

        <div className="mt-1 grid shrink-0 grid-cols-[1fr_auto] items-end gap-3">
          <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-accent">{phaseTitle(liveCurrent)}</p><span className="text-[9px] text-zinc-600">{liveCurrent.sequence + 1}/{liveSession.assignments.length}</span></div><h1 className="line-clamp-2 text-[clamp(1.55rem,7vw,2.15rem)] font-black leading-[1.02]">{liveCurrent.stepName}</h1>{liveCurrent.stepDetail && <p className="mt-0.5 truncate text-[11px] text-zinc-500">{liveCurrent.stepDetail}</p>}</div>
          <div className="shrink-0 text-right"><p className="font-mono text-[clamp(2rem,10vw,3rem)] font-black leading-none tracking-tight">{clock(primaryClock)}</p><p className="mt-0.5 text-[8px] uppercase tracking-wider text-zinc-600">{primaryClockLabel}</p></div>
        </div>

        <div className="mt-2 flex shrink-0 items-center gap-1.5 overflow-hidden"><span className="ui-chip shrink-0">{modeLabel(liveCurrent)}</span>{activeName && <span className="ui-chip ui-chip-accent min-w-0 truncate">Na řadě: {activeName}</span>}{liveCurrent.exerciseId && <Link href={`/exercises/${encodeURIComponent(liveCurrent.exerciseId)}`} className="ui-chip shrink-0">Jak na to</Link>}</div>

        {target && <div className="ui-inset mt-2 flex shrink-0 items-center justify-between gap-3 px-3 py-2"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Týmový postup</span><span className="text-lg font-black text-accent">{target}</span></div>}

        {currentPacing && currentPhase === "work" && <div className="ui-inset mt-2 shrink-0 px-3 py-2"><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-accent">Pacing</span>{currentPacing.paceLabel && <span className="truncate text-[10px] font-bold text-zinc-300">{currentPacing.paceLabel}</span>}</div><span className="shrink-0 font-mono text-xs font-black text-accent">{clock(segmentElapsedSeconds)} / {clock(currentPacing.targetSeconds)}</span></div><div className="mt-0.5 flex items-center justify-between gap-2"><p className={liveSegmentDeltaSeconds !== undefined && liveSegmentDeltaSeconds > 5 ? "truncate text-[11px] font-black text-amber-300" : "truncate text-[11px] font-black text-accent"}>{liveSegmentState ?? "živý pacing"}</p><button type="button" onClick={() => setShowStrategy(true)} className="shrink-0 text-[10px] font-bold text-zinc-500">Strategie</button></div>{pacingState && <p className="truncate text-[9px] text-zinc-600">Předchozí: {pacingState}</p>}</div>}
        {currentPacing && currentPhase !== "work" && <div className="ui-inset mt-2 shrink-0 px-3 py-2"><p className="text-[10px] text-zinc-400">{currentPacing.cue}</p></div>}

        <div className="runner-next-card ui-inset mt-2 flex shrink-0 items-center justify-between gap-2 px-3 py-2"><div className="min-w-0"><span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-600">Následuje</span><p className="truncate text-xs font-black">{next?.stepName ?? "Týmový výsledek"}</p></div><div className="flex shrink-0 gap-2"><button type="button" disabled={!previous} onClick={() => setShowPrevious(true)} className="text-xs font-black text-zinc-400">←</button><span className="text-accent">→</span></div></div>

        <section className="ui-card mt-2 min-h-0 flex-1 overflow-y-auto p-3">
          {starterClaimRequired ? <div className="flex h-full flex-col justify-center text-center"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Kdo začíná?</p><p className="mt-1 text-lg font-black">Rozhodněte podle situace</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{starterLoadDifference >= 10 && recommendedStarter ? `Doporučený start: ${recommendedStarter.name} · zatím odpracoval o ${clock(starterLoadDifference)} méně.` : "Zátěž je vyrovnaná. Začněte podle dechu, pocitu a toho, kdo je připravený."}</p><button type="button" disabled={busy} onClick={() => void claimCurrentStep()} className="ui-button ui-button-primary mt-2 w-full">ZAČÍNÁM JÁ</button></div> : canWork ? <div className="flex h-full flex-col justify-center">
            {liveCurrent.mode === "shared-reps" && <div className="grid grid-cols-3 gap-1.5">{repOptions.map((value) => <button key={value} type="button" disabled={busy} onClick={() => void addProgress("reps", value)} className="ui-button ui-button-primary ui-button-sm">+{value}</button>)}</div>}
            {liveCurrent.mode === "shared-distance" && <div className="grid grid-cols-3 gap-1.5">{distanceOptions.map((value) => <button key={value} type="button" disabled={busy} onClick={() => void addProgress("distance", value)} className="ui-button ui-button-primary ui-button-sm">+{value} m</button>)}</div>}
            {(liveCurrent.mode === "shared-reps" || liveCurrent.mode === "shared-distance") && <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5"><input type="number" min="1" inputMode="numeric" value={customProgress} onChange={(inputEvent) => setCustomProgress(inputEvent.target.value)} placeholder={liveCurrent.mode === "shared-distance" ? "Jiná vzdálenost" : "Jiný počet"} className="ui-field h-10 min-h-0 py-1 text-sm" /><button type="button" disabled={busy || !Number(customProgress)} onClick={() => void addCustomProgress(liveCurrent.mode === "shared-distance" ? "distance" : "reps")} className="ui-button ui-button-outline ui-button-sm">Přidat</button></div>}
            {splitSuggestion && (liveCurrent.mode === "shared-reps" || liveCurrent.mode === "shared-distance") && <p className="mt-1 truncate text-[9px] font-bold text-accent">{splitSuggestion}</p>}
            {(liveCurrent.mode === "simultaneous" || liveCurrent.mode === "solo" || liveCurrent.mode === "relay") && <button type="button" disabled={busy || liveProgress.completedByParticipantIds.includes(me.id)} onClick={() => void completeMyStep()} className="ui-button ui-button-primary w-full">{liveProgress.completedByParticipantIds.includes(me.id) ? "HOTOVO · ČEKÁM" : currentPhase === "warmup" ? "ROZCVIČENÍ HOTOVO" : currentPhase === "cooldown" ? "ZKLIDNĚNÍ HOTOVO" : "MŮJ ÚSEK HOTOVO"}</button>}
            {liveCurrent.mode === "you-go-i-go" && <div className="grid gap-1.5"><button type="button" disabled={busy} onClick={() => void handoff()} className="ui-button ui-button-accent w-full">PŘEDAT →</button><button type="button" disabled={busy} onClick={() => void completeMyStep()} className="ui-button ui-button-outline ui-button-sm w-full">Stanice hotová</button></div>}
            {liveProgress.activeParticipantId && liveCurrent.mode !== "you-go-i-go" && liveCurrent.participantIds.length > 1 && <button type="button" disabled={busy} onClick={() => void handoff()} className="ui-button ui-button-accent mt-2 w-full">PŘEDAT →</button>}
          </div> : <div className="flex h-full flex-col justify-center text-center"><p className="text-lg font-black">Čekáš na partnera</p><p className="mt-1 text-xs text-zinc-400">Teď pracuje {activeName ?? "tvůj týmový parťák"}. Stav se přepne automaticky.</p></div>}
          {isHost && <button type="button" disabled={busy} onClick={() => void completeTeamStep()} className="mt-1 w-full text-[9px] font-bold text-zinc-600">Host: přeskočit / týmově hotovo</button>}
        </section>

        <div className="mt-2 h-0.5 shrink-0 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${((liveCurrent.sequence + 1) / Math.max(1, liveSession.assignments.length)) * 100}%` }} /></div>
        <section className="mt-2 grid shrink-0 grid-cols-2 gap-1.5">{liveSession.participants.map((participant) => { const contribution = state.contributions[participant.id]; return <div key={participant.id} className="ui-inset min-w-0 px-2.5 py-1.5"><div className="flex items-center justify-between gap-1"><p className="truncate text-[11px] font-black">{participant.displayName}</p><span className="shrink-0 text-[9px] text-zinc-500">{clock(contribution?.durationSeconds ?? 0)}</span></div><p className="truncate text-[9px] font-semibold text-zinc-400">{participantLiveStatus(participant.id)}</p></div>; })}</section>
        {error && <p className="mt-1 shrink-0 truncate text-center text-[10px] text-amber-200">{error}</p>}

        {showPrevious && previous && <div className="runner-shell fixed inset-0 z-[90] overflow-y-auto text-white" role="dialog" aria-modal="true"><div className="safe-screen mx-auto min-h-dvh w-full max-w-md px-5"><p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Předchozí úsek</p><h2 className="mt-1 text-3xl font-black">{previous.stepName}</h2>{previous.stepDetail && <p className="mt-3 text-lg text-zinc-300">{previous.stepDetail}</p>}<button type="button" onClick={() => setShowPrevious(false)} className="ui-button ui-button-primary mt-6 w-full">Zpět na aktuální cvik</button></div></div>}
        {showStrategy && <div className="runner-shell fixed inset-0 z-[95] overflow-y-auto text-white" role="dialog" aria-modal="true"><div className="safe-screen mx-auto min-h-dvh w-full max-w-md px-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Strategie</p><h2 className="mt-1 text-3xl font-black">{liveSession.workoutTemplate.title}</h2></div><span className="font-mono text-lg font-black text-accent">{clock(pacingTargetSeconds)}</span></div><div className="mt-5 space-y-2">{strategyRows.map(({ assignment, pacing }) => <div key={assignment.id} className="ui-inset px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="font-black">{assignment.stepName}</p><span className="font-mono text-sm text-accent">{clock(pacing?.targetSeconds)}</span></div>{pacing?.paceLabel && <p className="mt-1 text-xs text-zinc-400">{pacing.paceLabel}</p>}{pacing?.splitSuggestion && <p className="mt-1 text-xs text-zinc-500">{pacing.splitSuggestion}</p>}</div>)}</div><button type="button" onClick={() => setShowStrategy(false)} className="ui-button ui-button-primary mt-6 w-full">Zpět do workoutu</button></div></div>}
      </section>
    </main>
  );
}
