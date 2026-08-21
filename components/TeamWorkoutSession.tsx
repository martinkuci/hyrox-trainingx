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
  deriveTeamWorkoutTiming,
  phaseForAssignment,
  recommendedWorkoutTargetSeconds,
  suggestedTeamSplit,
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

function event<T extends TeamWorkoutEvent["type"]>(type: T, payload: Omit<Extract<TeamWorkoutEvent, { type: T }>, "id" | "type" | "at">): Extract<TeamWorkoutEvent, { type: T }> {
  return { id: crypto.randomUUID(), type, at: new Date().toISOString(), ...payload } as Extract<TeamWorkoutEvent, { type: T }>;
}

function targetLabel(assignment: TeamStepAssignment, reps: number, distance: number) {
  if (assignment.targetReps) return `${reps} / ${assignment.targetReps} opakování`;
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

export default function TeamWorkoutSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { data, addResult } = useHyroxData();
  const [user] = useState(() => loadCloudUser());
  const [snapshot, setSnapshot] = useState<TeamWorkoutSnapshot>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [rpe, setRpe] = useState(7);
  const [now, setNow] = useState(() => Date.now());
  const [showPrevious, setShowPrevious] = useState(false);
  const [customProgress, setCustomProgress] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastCountdownCueRef = useRef<number | null>(null);
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
  const progress = current && state ? state.assignmentProgress[current.id] : undefined;
  const baseCanWork = Boolean(current && me && state && canParticipantWork(current, me.id, state));
  const teamResult = useMemo(() => session && snapshot ? buildTeamResult(session, snapshot.events) : undefined, [session, snapshot]);
  const existingResult = data.results.find((result) => result.teamSessionId === sessionId);
  const startMs = state?.startedAt ? Date.parse(state.startedAt) : NaN;
  const countdownSeconds = state?.status === "running" && Number.isFinite(startMs)
    ? Math.max(0, Math.ceil((startMs - now) / 1000))
    : 0;
  const canWork = baseCanWork && countdownSeconds === 0;
  const previous = state && session && state.currentAssignmentIndex > 0 ? session.assignments[state.currentAssignmentIndex - 1] : undefined;
  const next = state && session ? session.assignments[state.currentAssignmentIndex + 1] : undefined;
  const pacingTargetSeconds = session ? recommendedWorkoutTargetSeconds(session.workoutTemplate) : 0;
  const pacingPlan = useMemo(() => session && session.assignments.length ? buildTeamPacingPlan({
    assignments: session.assignments,
    targetWorkoutSeconds: recommendedWorkoutTargetSeconds(session.workoutTemplate),
    participantCount: session.participants.length,
    runningTarget: session.workoutTemplate.metadata?.runningTarget,
    format: session.format,
  }) : {}, [session]);
  const previewAssignments = useMemo(() => session ? buildTeamAssignments({ template: session.workoutTemplate, participants: session.participants, format: session.format }) : [], [session]);
  const previewPacingPlan = useMemo(() => session && previewAssignments.length ? buildTeamPacingPlan({
    assignments: previewAssignments,
    targetWorkoutSeconds: recommendedWorkoutTargetSeconds(session.workoutTemplate),
    participantCount: session.participants.length,
    runningTarget: session.workoutTemplate.metadata?.runningTarget,
    format: session.format,
  }) : {}, [previewAssignments, session]);
  const timing = useMemo(() => session && state && snapshot ? deriveTeamWorkoutTiming(session.assignments, snapshot.events, state.startedAt, state.completedAt, now) : undefined, [now, session, snapshot, state]);

  function ensureAudio() {
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
    } catch {
      // Audio cues are optional; the visual synchronized countdown remains authoritative.
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
        rpe,
        weights: "",
        notes: `Týmový workout · ${FORMAT_LABELS[session.format]} · celkem ${clock(timing.sessionSeconds)} · warm-up ${clock(timing.warmupSeconds)} · cooldown ${clock(timing.cooldownSeconds)} · pacing cíl ${clock(pacingTargetSeconds)}`,
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
        </div>
        <div className="mt-4 space-y-3">{teamResult?.participants.map((participant) => <div key={participant.participantId} className="ui-card p-4"><div className="flex items-center justify-between"><p className="font-black">{participant.displayName}</p><span className="ui-chip">{participant.completedAssignments} úseků</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm"><div className="ui-inset p-2"><b>{participant.reps}</b><span className="block text-[10px] text-zinc-500">reps</span></div><div className="ui-inset p-2"><b>{participant.distanceMeters} m</b><span className="block text-[10px] text-zinc-500">distance</span></div><div className="ui-inset p-2"><b>{clock(participant.durationSeconds)}</b><span className="block text-[10px] text-zinc-500">tracked work</span></div></div></div>)}</div>
        {!existingResult ? <section className="ui-card mt-4 p-5"><p className="font-black">Jak náročný byl trénink?</p><p className="mt-1 text-xs text-zinc-500">1 = velmi lehký · 10 = maximum</p><div className="mt-3 grid grid-cols-5 gap-2">{[1,2,3,4,5,6,7,8,9,10].map((value) => <button key={value} type="button" onClick={() => setRpe(value)} className={rpe === value ? "ui-button ui-button-primary px-2" : "ui-button ui-button-outline px-2"}>{value}</button>)}</div><button type="button" disabled={busy} onClick={() => void savePersonalResult()} className="ui-button ui-button-primary mt-4 w-full">Uložit výsledek</button><p className="mt-3 text-xs leading-5 text-zinc-500">Do týmu se sdílí společný postup. Tvoje hodnocení náročnosti a budoucí Health data zůstávají osobní.</p></section> : <p className="ui-feedback ui-feedback-success mt-4 text-sm">Týmový workout už je uložený v tvojí historii.</p>}
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
      <section className="ui-card mt-4 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Pacing plán</p><p className="mt-1 font-black">Cíl workout části {clock(pacingTargetSeconds)}</p></div><span className="ui-chip">orientační</span></div><p className="mt-2 text-xs leading-5 text-zinc-500">Warm-up a cooldown jsou synchronizované, ale do workout času se nepočítají.</p><div className="mt-3 space-y-2">{previewAssignments.filter((assignment) => phaseForAssignment(assignment) === "work").slice(0, 4).map((assignment) => <div key={assignment.id} className="ui-inset px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="font-bold">{assignment.stepName}</p><span className="font-mono text-sm text-accent">{clock(previewPacingPlan[assignment.id]?.targetSeconds)}</span></div><p className="mt-1 text-xs leading-5 text-zinc-500">{previewPacingPlan[assignment.id]?.splitSuggestion ?? previewPacingPlan[assignment.id]?.cue}</p></div>)}</div></section>
      <button type="button" disabled={busy} onClick={() => void toggleReady()} className={ready ? "ui-button ui-button-outline mt-4 w-full" : "ui-button ui-button-primary mt-4 w-full"}>{ready ? "Nejsem připraven" : "Jsem READY"}</button>
      {isHost && <button type="button" disabled={busy || !canStartTeamSession(session, state)} onClick={() => void startSession()} className="ui-button ui-button-accent mt-2 w-full">START TEAM WORKOUT · 10 s</button>}
      {isHost && !canStartTeamSession(session, state) && <p className="mt-3 text-center text-xs text-zinc-500">Start se odemkne, až budou alespoň dva sportovci READY.</p>}
      {error && <p className="ui-feedback mt-4 text-sm text-amber-200">{error}</p>}
    </section></main>
  );

  if (!current || !progress) return <main className="runner-shell grid min-h-dvh place-items-center text-zinc-400">Synchronizuji další úsek…</main>;
  const currentPhase = phaseForAssignment(current);
  const target = targetLabel(current, progress.reps, progress.distanceMeters);
  const activeName = session.participants.find((participant) => participant.id === progress.activeParticipantId)?.displayName;
  const currentPacing = pacingPlan[current.id];
  const distanceOptions = adaptiveProgressOptions(current.targetDistanceMeters, progress.distanceMeters, "distance");
  const repOptions = adaptiveProgressOptions(current.targetReps, progress.reps, "reps");
  const splitSuggestion = suggestedTeamSplit(current, session.participants.length);
  const primaryClock = currentPhase === "warmup" ? timing?.warmupSeconds : currentPhase === "cooldown" ? timing?.cooldownSeconds : timing?.workoutSeconds;
  const primaryClockLabel = currentPhase === "warmup" ? "Čas rozcvičení · mimo workout výsledek" : currentPhase === "cooldown" ? "Čas zklidnění · workout čas je zmrazen" : "Workout čas";

  function participantLiveStatus(id: string) {
    const name = session.participants.find((participant) => participant.id === id)?.displayName ?? "Sportovec";
    const completed = progress.completedByParticipantIds.includes(id);
    if (completed) return currentPhase === "warmup" ? "✓ Rozcvičení hotovo" : currentPhase === "cooldown" ? "✓ Zklidnění hotovo" : `✓ ${current.stepName} hotovo`;
    if (progress.activeParticipantId === id) return `Na řadě · ${current.stepName}`;
    if (current.mode === "simultaneous") return currentPhase === "warmup" ? "Rozcvičuje se" : currentPhase === "cooldown" ? "Zklidňuje se" : `Pracuje · ${current.stepName}`;
    return `Čeká na předávku od ${activeName ?? name}`;
  }

  if (countdownSeconds > 0) return (
    <main className="runner-shell safe-screen flex min-h-dvh flex-col px-5 text-center text-white">
      <header className="mx-auto grid w-full max-w-md grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="justify-self-start ui-chip ui-chip-accent">{FORMAT_LABELS[session.format]}</span><RunnerBrandButton onClick={minimizeSession} /><span className="justify-self-end font-mono text-sm text-zinc-500">{current.sequence + 1}/{session.assignments.length}</span></header>
      <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8"><p className="text-sm font-black uppercase tracking-[0.25em] text-accent">Připrav se</p><p className="mt-4 text-8xl font-black tabular-nums">{countdownSeconds}</p><p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{phaseTitle(current)}</p><h1 className="mt-2 text-5xl font-black leading-tight">{current.stepName}</h1>{current.stepDetail && <p className="mt-3 text-xl font-semibold leading-7 text-zinc-300">{current.stepDetail}</p>}<p className="mt-7 text-sm text-zinc-500">Odpočet je synchronizovaný pro všechny telefony v session.</p></section>
    </main>
  );

  return (
    <main className="runner-shell safe-screen min-h-dvh px-4 text-white"><section className="mx-auto w-full max-w-md py-3">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="justify-self-start ui-chip ui-chip-accent">{FORMAT_LABELS[session.format]}</span><RunnerBrandButton onClick={minimizeSession} /><div className="justify-self-end text-right"><p className="font-mono text-lg font-black text-zinc-200">{clock(timing?.sessionSeconds)}</p><p className="text-[9px] uppercase tracking-wider text-zinc-600">session celkem</p></div></header>

      <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.2em] text-accent">{phaseTitle(current)}</p><span className="font-mono text-sm text-zinc-500">{current.sequence + 1}/{session.assignments.length}</span></div>
      <h1 className="mt-1 text-4xl font-black leading-tight">{current.stepName}</h1>
      {current.stepDetail && <p className="mt-2 text-lg text-zinc-400">{current.stepDetail}</p>}
      <div className="mt-4 flex flex-wrap gap-2"><span className="ui-chip">{modeLabel(current)}</span>{activeName && <span className="ui-chip ui-chip-accent">Na řadě: {activeName}</span>}{current.exerciseId && <Link href={`/exercises/${encodeURIComponent(current.exerciseId)}`} className="ui-chip">Jak na to</Link>}</div>

      <div className="mt-5 text-center"><p className="font-mono text-5xl font-black tracking-tight">{clock(primaryClock)}</p><p className="mt-1 text-sm text-zinc-500">{primaryClockLabel}</p>{currentPhase !== "work" && <p className="mt-1 text-xs text-zinc-600">Workout čas: {clock(timing?.workoutSeconds)}</p>}</div>

      {target && <div className="ui-card ui-card-accent mt-5 p-5 text-center"><p className="text-xs uppercase tracking-wider text-zinc-500">Týmový postup</p><p className="mt-2 text-3xl font-black text-accent">{target}</p></div>}

      {currentPacing && <div className="ui-inset mt-4 px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-accent">Pacing</p>{currentPacing.targetSeconds && <span className="font-mono text-sm font-black text-accent">cíl {clock(currentPacing.targetSeconds)}</span>}</div><p className="mt-1 text-xs leading-5 text-zinc-400">{currentPacing.cue}</p>{currentPacing.splitSuggestion && <p className="mt-1 text-xs font-semibold leading-5 text-zinc-300">{currentPacing.splitSuggestion}</p>}</div>}

      <div className="runner-next-card ui-inset mt-4 flex items-center justify-between gap-3 px-4 py-3 text-left"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Následuje</p><p className="mt-0.5 font-black leading-5">{next?.stepName ?? "Týmový výsledek"}</p>{next?.stepDetail && <p className="mt-0.5 truncate text-xs text-zinc-400">{next.stepDetail}</p>}</div><span className="text-accent" aria-hidden="true">→</span></div>

      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={!previous} onClick={() => setShowPrevious(true)} className="ui-button ui-button-outline ui-button-sm">← Předchozí cvik</button>{current.exerciseId ? <Link href={`/exercises/${encodeURIComponent(current.exerciseId)}`} className="ui-button ui-button-outline ui-button-sm">Detail cviku</Link> : <span />}</div>

      <section className="ui-card mt-4 p-5">
        {canWork ? <>
          {current.mode === "shared-reps" && <div className="grid grid-cols-3 gap-2">{repOptions.map((value) => <button key={value} type="button" disabled={busy} onClick={() => void addProgress("reps", value)} className="ui-button ui-button-primary">+{value}</button>)}</div>}
          {current.mode === "shared-distance" && <div className="grid grid-cols-3 gap-2">{distanceOptions.map((value) => <button key={value} type="button" disabled={busy} onClick={() => void addProgress("distance", value)} className="ui-button ui-button-primary">+{value} m</button>)}</div>}
          {(current.mode === "shared-reps" || current.mode === "shared-distance") && <><div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><input type="number" min="1" inputMode="numeric" value={customProgress} onChange={(event) => setCustomProgress(event.target.value)} placeholder={current.mode === "shared-distance" ? "Jiná vzdálenost" : "Jiný počet"} className="ui-field" /><button type="button" disabled={busy || !Number(customProgress)} onClick={() => void addCustomProgress(current.mode === "shared-distance" ? "distance" : "reps")} className="ui-button ui-button-outline">Přidat</button></div><p className="mt-3 text-xs leading-5 text-zinc-500">Můžeš přidat více hodnot po sobě. <b className="text-zinc-300">PŘEDAT</b> zmáčkni až ve chvíli, kdy stanoviště skutečně přebírá partner.</p>{splitSuggestion && <p className="mt-2 text-xs font-bold leading-5 text-accent">{splitSuggestion}</p>}</>}
          {(current.mode === "simultaneous" || current.mode === "solo" || current.mode === "relay") && <button type="button" disabled={busy || progress.completedByParticipantIds.includes(me.id)} onClick={() => void completeMyStep()} className="ui-button ui-button-primary w-full">{progress.completedByParticipantIds.includes(me.id) ? "Hotovo · čekám na tým" : currentPhase === "warmup" ? "ROZCVIČENÍ HOTOVO" : currentPhase === "cooldown" ? "ZKLIDNĚNÍ HOTOVO" : "MŮJ ÚSEK HOTOVO"}</button>}
          {current.mode === "you-go-i-go" && <div className="grid gap-2"><button type="button" disabled={busy} onClick={() => void handoff()} className="ui-button ui-button-accent w-full">PŘEDAT →</button><button type="button" disabled={busy} onClick={() => void completeMyStep()} className="ui-button ui-button-outline w-full">Stanice hotová</button></div>}
          {progress.activeParticipantId && current.mode !== "you-go-i-go" && current.participantIds.length > 1 && <button type="button" disabled={busy} onClick={() => void handoff()} className="ui-button ui-button-accent mt-3 w-full">PŘEDAT →</button>}
        </> : <div className="text-center"><p className="text-2xl font-black">Připrav se</p><p className="mt-2 text-zinc-400">Teď pracuje {activeName ?? "tvůj týmový parťák"}. Na tvém telefonu se další stav přepne automaticky.</p>{next && <div className="ui-inset mt-4 px-4 py-3 text-left"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Potom následuje</p><p className="mt-1 font-black">{next.stepName}</p>{next.stepDetail && <p className="mt-1 text-xs text-zinc-400">{next.stepDetail}</p>}</div>}</div>}
        {isHost && <button type="button" disabled={busy} onClick={() => void completeTeamStep()} className="ui-button ui-button-ghost mt-4 w-full text-xs">Host: přeskočit / označit týmově hotovo</button>}
      </section>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${((current.sequence + 1) / Math.max(1, session.assignments.length)) * 100}%` }} /></div>
      <section className="mt-4 grid grid-cols-2 gap-2">{session.participants.map((participant) => { const contribution = state.contributions[participant.id]; return <div key={participant.id} className="ui-card p-3"><p className="truncate text-sm font-black">{participant.displayName}</p><p className="mt-1 text-xs font-semibold text-zinc-300">{participantLiveStatus(participant.id)}</p><p className="mt-1 text-[11px] text-zinc-500">{contribution?.reps ?? 0} reps · {contribution?.distanceMeters ?? 0} m</p></div>; })}</section>
      <p className="mt-5 text-center text-xs text-zinc-600">Session {session.joinCode} · stav se synchronizuje mezi telefony. Hodnocení náročnosti a Health data se nesdílí.</p>
      {error && <p className="ui-feedback mt-4 text-sm text-amber-200">{error}</p>}

      {showPrevious && previous && (
        <div className="runner-shell fixed inset-0 z-[90] overflow-y-auto text-white" role="dialog" aria-modal="true" aria-labelledby="team-previous-title"><div className="safe-screen mx-auto min-h-dvh w-full max-w-md px-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Předchozí úsek · {previous.sequence + 1}/{session.assignments.length}</p><h2 id="team-previous-title" className="mt-1 text-3xl font-black">{previous.stepName}</h2></div><span className="font-mono text-lg font-black text-zinc-300">{clock(timing?.sessionSeconds)}</span></div><p className="mt-3 text-sm font-black uppercase tracking-[0.16em] text-zinc-500">{phaseTitle(previous)}</p>{previous.stepDetail && <p className="mt-3 text-lg leading-7 text-zinc-300">{previous.stepDetail}</p>}<div className="ui-card mt-5 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Režim</p><p className="mt-1 font-black">{modeLabel(previous)}</p></div><div className="mt-6 grid gap-3">{previous.exerciseId && <Link href={`/exercises/${encodeURIComponent(previous.exerciseId)}`} className="ui-button ui-button-outline w-full">Jak na předchozí cvik</Link>}<button type="button" onClick={() => setShowPrevious(false)} className="ui-button ui-button-primary ui-button-lg w-full">Zpět na aktuální cvik</button></div><p className="mt-4 text-center text-xs text-zinc-500">Pouze náhled. Týmový postup se tím nevrací zpět.</p></div></div>
      )}
    </section></main>
  );
}
