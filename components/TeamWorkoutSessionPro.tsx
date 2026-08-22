"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RunnerBrandButton from "@/components/RunnerBrandButton";
import { useHyroxData } from "@/hooks/useHyroxData";
import { loadCloudUser } from "@/lib/firebase-rest";
import { buildStructuredTeamAssignments } from "@/lib/team-assignment-builder";
import { clearActiveTeamSession, saveActiveTeamSession } from "@/lib/team-active-session";
import {
  adaptiveProgressOptions,
  completionTime,
  deriveTeamWorkoutTiming,
  phaseForAssignment,
  recommendedWorkoutTargetSeconds,
  workoutStartedAt,
} from "@/lib/team-pacing";
import { buildStructuredTeamPacingPlan } from "@/lib/team-pacing-v2";
import { loadTeamProfile, rememberTeammates } from "@/lib/team-profile";
import { deriveParticipantMovementTotals } from "@/lib/team-result-metrics";
import type { TeamStepAssignment, TeamWorkoutEvent, TeamWorkoutSnapshot } from "@/lib/team-training";
import { teamWorkoutTransport } from "@/lib/team-training-firestore";
import {
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

function event<T extends TeamWorkoutEvent["type"]>(
  type: T,
  payload: Omit<Extract<TeamWorkoutEvent, { type: T }>, "id" | "type" | "at">,
): Extract<TeamWorkoutEvent, { type: T }> {
  return { id: crypto.randomUUID(), type, at: new Date().toISOString(), ...payload } as Extract<TeamWorkoutEvent, { type: T }>;
}

function targetLabel(
  assignment: TeamStepAssignment,
  reps: number,
  distance: number,
  completedParticipants: number,
) {
  if (assignment.mode === "simultaneous" && phaseForAssignment(assignment) === "work" && assignment.participantIds.length > 1) {
    return `${completedParticipants} / ${assignment.participantIds.length} hotovo`;
  }
  if (assignment.targetReps) return `${reps} / ${assignment.targetReps} reps`;
  if (assignment.targetDistanceMeters) return `${distance} / ${assignment.targetDistanceMeters} m`;
  if ((assignment.totalRounds ?? 1) > 1) return `Kolo ${assignment.round ?? 1} / ${assignment.totalRounds}`;
  return MODE_LABELS[assignment.mode];
}

function modeLabel(assignment: TeamStepAssignment) {
  if (assignment.mode !== "simultaneous") return MODE_LABELS[assignment.mode];
  if (phaseForAssignment(assignment) !== "work") return "společně / volně";
  return MODE_LABELS.simultaneous;
}

function phaseTitle(assignment: TeamStepAssignment) {
  const phase = phaseForAssignment(assignment);
  if (phase === "warmup") return "Warm-up";
  if (phase === "cooldown") return "Cooldown";
  return assignment.blockTitle;
}

function workoutReadyIds(events: TeamWorkoutEvent[]) {
  const ready = new Set<string>();
  for (const item of events) {
    if (item.type !== "workout-ready") continue;
    if (item.ready) ready.add(item.participantId);
    else ready.delete(item.participantId);
  }
  return ready;
}

export default function TeamWorkoutSessionPro({ sessionId }: { sessionId: string }) {
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
  const [showCustomProgress, setShowCustomProgress] = useState(false);
  const [customProgress, setCustomProgress] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastCountdownCueRef = useRef<number | null>(null);
  const workoutStartRequestedRef = useRef(false);
  const personalFinishRequestedRef = useRef(false);
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

  useEffect(() => {
    if (!user) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void teamWorkoutTransport.getSession(sessionId)
        .then((fresh) => { if (fresh) setSnapshot(fresh); })
        .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [sessionId, user]);

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
  const movementTotals = useMemo(() => session && snapshot ? deriveParticipantMovementTotals(session, snapshot.events) : {}, [session, snapshot]);
  const existingResult = data.results.find((result) => result.teamSessionId === sessionId);
  const personalFinish = me && state ? state.participantFinish[me.id] : undefined;

  const sessionStartMs = state?.startedAt ? Date.parse(state.startedAt) : NaN;
  const sessionCountdownSeconds = state?.status === "running" && Number.isFinite(sessionStartMs)
    ? Math.max(0, Math.ceil((sessionStartMs - now) / 1000))
    : 0;

  const workoutStartAt = snapshot ? workoutStartedAt(snapshot.events) : undefined;
  const workoutStartMs = workoutStartAt ? Date.parse(workoutStartAt) : NaN;
  const workoutCountdownSeconds = currentPhase === "work" && Number.isFinite(workoutStartMs)
    ? Math.max(0, Math.ceil((workoutStartMs - now) / 1000))
    : 0;
  const canWork = baseCanWork
    && sessionCountdownSeconds === 0
    && (currentPhase !== "work" || (Boolean(workoutStartAt) && workoutCountdownSeconds === 0));

  const previous = state && session && state.currentAssignmentIndex > 0 ? session.assignments[state.currentAssignmentIndex - 1] : undefined;
  const next = state && session ? session.assignments[state.currentAssignmentIndex + 1] : undefined;
  const pacingTargetSeconds = session ? session.pacingTargetSeconds ?? recommendedWorkoutTargetSeconds(session.workoutTemplate) : 0;
  const pacingPlan = useMemo(() => session && session.assignments.length ? buildStructuredTeamPacingPlan({
    assignments: session.assignments,
    targetWorkoutSeconds: session.pacingTargetSeconds ?? recommendedWorkoutTargetSeconds(session.workoutTemplate),
    participantCount: session.participants.length,
    runningTarget: session.workoutTemplate.metadata?.runningTarget,
    format: session.format,
  }) : {}, [session]);
  const previewAssignments = useMemo(() => session ? buildStructuredTeamAssignments({
    template: session.workoutTemplate,
    participants: session.participants,
    format: session.format,
  }) : [], [session]);
  const previewPacingPlan = useMemo(() => session && previewAssignments.length ? buildStructuredTeamPacingPlan({
    assignments: previewAssignments,
    targetWorkoutSeconds: session.pacingTargetSeconds ?? recommendedWorkoutTargetSeconds(session.workoutTemplate),
    participantCount: session.participants.length,
    runningTarget: session.workoutTemplate.metadata?.runningTarget,
    format: session.format,
  }) : {}, [previewAssignments, session]);
  const timing = useMemo(() => session && state && snapshot ? deriveTeamWorkoutTiming(
    session.assignments,
    snapshot.events,
    state.startedAt,
    state.completedAt,
    now,
  ) : undefined, [now, session, snapshot, state]);

  const workoutReady = useMemo(() => workoutReadyIds(snapshot?.events ?? []), [snapshot?.events]);
  const joinedParticipants = session?.participants.filter((participant) => participant.status !== "left" && participant.status !== "invited") ?? [];
  const allWorkoutReady = joinedParticipants.length >= 2 && joinedParticipants.every((participant) => workoutReady.has(participant.id));
  const briefingActive = currentPhase === "work" && !workoutStartAt && sessionCountdownSeconds === 0;
  const hasCooldown = session?.assignments.some((assignment) => phaseForAssignment(assignment) === "cooldown") ?? false;
  const showPersonalSummary = Boolean(personalFinish || state?.status === "completed");

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
    const isStart = seconds === 0;
    if (context) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const duration = isStart ? 0.82 : 0.18;
      oscillator.type = "square";
      oscillator.frequency.value = isStart ? 1560 : seconds <= 3 ? 1320 : 1080;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(isStart ? 0.72 : 0.5, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration + 0.03);
    }
    if ("vibrate" in navigator) navigator.vibrate(isStart ? [180, 60, 180] : 75);
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
      personalFinished: Boolean(personalFinish),
    });
  }

  function minimizeSession() {
    rememberActiveSession();
    router.push("/");
  }

  useEffect(() => {
    if (!session || !state || !me) return;
    if (state.status === "cancelled" || existingResult) {
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
      personalFinished: Boolean(state.participantFinish[me.id]),
    });
  }, [existingResult, me, session, state]);

  useEffect(() => {
    if (state?.status !== "running") return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [state?.startedAt, state?.status]);

  const activeCountdownSeconds = sessionCountdownSeconds > 0 ? sessionCountdownSeconds : workoutCountdownSeconds;
  useEffect(() => {
    if (state?.status !== "running" || activeCountdownSeconds > 10) return;
    if (activeCountdownSeconds > 0) {
      if (lastCountdownCueRef.current === activeCountdownSeconds) return;
      lastCountdownCueRef.current = activeCountdownSeconds;
      countdownCue(activeCountdownSeconds);
      return;
    }
    if (lastCountdownCueRef.current === 1) {
      lastCountdownCueRef.current = 0;
      countdownCue(0);
    }
  }, [activeCountdownSeconds, state?.status]);

  useEffect(() => () => { void audioContextRef.current?.close(); }, []);

  useEffect(() => {
    if (!session || !snapshot || !me || !isHost || !briefingActive || !allWorkoutReady || workoutStartAt || workoutStartRequestedRef.current) return;
    workoutStartRequestedRef.current = true;
    ensureAudio();
    lastCountdownCueRef.current = null;
    const at = new Date(Date.now() + 10_000).toISOString();
    void teamWorkoutTransport.publishEvent(session.id, {
      id: crypto.randomUUID(),
      type: "workout-started",
      participantId: me.id,
      at,
    }).then(setSnapshot).catch((reason) => {
      workoutStartRequestedRef.current = false;
      setError(reason instanceof Error ? reason.message : "Start měřené části selhal.");
    });
  }, [allWorkoutReady, briefingActive, isHost, me, session, snapshot, workoutStartAt]);

  useEffect(() => {
    if (!session || !state || !me || !isHost || state.status !== "running" || state.currentAssignment) return;
    const alreadyDone = snapshot?.events.some((item) => item.type === "session-completed");
    if (alreadyDone) return;
    const completedAt = new Date().toISOString();
    void teamWorkoutTransport.updateSession(session.id, { status: "completed", completedAt })
      .then(() => teamWorkoutTransport.publishEvent(session.id, {
        id: "session-completed",
        type: "session-completed",
        participantId: me.id,
        at: completedAt,
      }))
      .then(setSnapshot)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Dokončení session selhalo."));
  }, [isHost, me, session, snapshot?.events, state]);

  useEffect(() => {
    if (!session || !state || !snapshot || !me || personalFinish || personalFinishRequestedRef.current || hasCooldown || !timing?.workoutCompleted) return;
    personalFinishRequestedRef.current = true;
    void teamWorkoutTransport.publishEvent(session.id, {
      id: crypto.randomUUID(),
      type: "participant-finished",
      participantId: me.id,
      durationSeconds: Math.max(1, timing.workoutSeconds),
      at: new Date().toISOString(),
    }).then(setSnapshot).catch((reason) => {
      personalFinishRequestedRef.current = false;
      setError(reason instanceof Error ? reason.message : "Dokončení výsledku selhalo.");
    });
  }, [hasCooldown, me, personalFinish, session, snapshot, state, timing]);

  async function publish(teamEvent: TeamWorkoutEvent) {
    setBusy(true);
    setError(undefined);
    try {
      const nextSnapshot = await teamWorkoutTransport.publishEvent(sessionId, teamEvent);
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Akci se nepodařilo synchronizovat.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function toggleReady() {
    if (!me) return;
    ensureAudio();
    await publish(event("participant-ready", { participantId: me.id, ready: !ready }));
  }

  async function toggleWorkoutReady() {
    if (!me) return;
    ensureAudio();
    await publish(event("workout-ready", { participantId: me.id, ready: !workoutReady.has(me.id) }));
  }

  async function startSession() {
    if (!session || !state || !me || !isHost || !canStartTeamSession(session, state)) return;
    setBusy(true);
    setError(undefined);
    ensureAudio();
    try {
      const assignments = buildStructuredTeamAssignments({
        template: session.workoutTemplate,
        participants: session.participants,
        format: session.format,
      });
      if (!assignments.length) throw new Error("Workout nemá žádné týmové úseky.");
      const startedAt = new Date(Date.now() + 10_000).toISOString();
      await teamWorkoutTransport.updateSession(session.id, { assignments, status: "running", startedAt });
      setSnapshot(await teamWorkoutTransport.publishEvent(session.id, {
        id: "session-started",
        type: "session-started",
        participantId: me.id,
        at: startedAt,
      }));
      setNow(Date.now());
      lastCountdownCueRef.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Start session selhal.");
    } finally {
      setBusy(false);
    }
  }

  async function claimCurrentStep() {
    if (!me || !current || !progress || progress.activeParticipantId || activeCountdownSeconds > 0 || !requiresStarterClaim(current)) return;
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
    setShowCustomProgress(false);
    await addProgress(kind, value);
  }

  async function completeMyStep() {
    if (!session || !snapshot || !state || !me || !current || !canWork) return;
    setBusy(true);
    setError(undefined);
    try {
      const completedAt = new Date().toISOString();
      const nextSnapshot = await teamWorkoutTransport.publishEvent(session.id, {
        id: crypto.randomUUID(),
        type: "participant-step-completed",
        participantId: me.id,
        assignmentId: current.id,
        at: completedAt,
      });
      setSnapshot(nextSnapshot);

      const currentIndex = session.assignments.findIndex((assignment) => assignment.id === current.id);
      const laterForMe = session.assignments.slice(currentIndex + 1).some((assignment) => assignment.participantIds.includes(me.id));
      if (currentPhase === "cooldown" && !laterForMe && !personalFinish) {
        const finishedSnapshot = await teamWorkoutTransport.publishEvent(session.id, {
          id: crypto.randomUUID(),
          type: "participant-finished",
          participantId: me.id,
          durationSeconds: Math.max(1, timing?.workoutSeconds ?? 1),
          at: completedAt,
        });
        personalFinishRequestedRef.current = true;
        setSnapshot(finishedSnapshot);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dokončení úseku selhalo.");
    } finally {
      setBusy(false);
    }
  }

  async function completeTeamStep() {
    if (!me || !current || !isHost || activeCountdownSeconds > 0) return;
    await publish(event("team-step-completed", { participantId: me.id, assignmentId: current.id }));
  }

  async function handoff() {
    if (!me || !current || !progress?.activeParticipantId || progress.activeParticipantId !== me.id || activeCountdownSeconds > 0) return;
    const index = current.participantIds.indexOf(me.id);
    const nextParticipant = current.participantIds[(index + 1) % current.participantIds.length];
    if (!nextParticipant || nextParticipant === me.id) return;
    await publish(event("handoff", { participantId: me.id, nextParticipantId: nextParticipant, assignmentId: current.id }));
  }

  async function savePersonalResult() {
    if (!session || !state || !snapshot || !me || !teamResult || existingResult || !timing) return;
    setBusy(true);
    setError(undefined);
    try {
      const finishAt = personalFinish?.at ?? new Date().toISOString();
      const durationSeconds = Math.max(1, personalFinish?.durationSeconds ?? timing.workoutSeconds ?? teamResult.teamDurationSeconds ?? 1);
      if (!personalFinish || personalFinish.rpe !== rpe) {
        setSnapshot(await teamWorkoutTransport.publishEvent(session.id, {
          id: crypto.randomUUID(),
          type: "participant-finished",
          participantId: me.id,
          durationSeconds,
          rpe,
          at: finishAt,
        }));
      }

      const contribution = state.contributions[me.id] ?? { participantId: me.id, reps: 0, distanceMeters: 0, durationSeconds: 0, completedAssignments: 0 };
      const movement = movementTotals[me.id] ?? { reps: contribution.reps, distanceMeters: contribution.distanceMeters };
      const firstWork = session.assignments.find((assignment) => phaseForAssignment(assignment) === "work");
      const lastWork = [...session.assignments].reverse().find((assignment) => phaseForAssignment(assignment) === "work");
      const workoutEndAt = lastWork ? completionTime(lastWork, snapshot.events) : undefined;
      const finishMs = Date.parse(finishAt);
      const sessionStart = state.startedAt ? Date.parse(state.startedAt) : NaN;
      const workoutEndMs = workoutEndAt ? Date.parse(workoutEndAt) : NaN;
      const personalSessionSeconds = Number.isFinite(finishMs) && Number.isFinite(sessionStart)
        ? Math.max(0, Math.floor((finishMs - sessionStart) / 1000))
        : timing.sessionSeconds;
      const personalCooldownSeconds = Number.isFinite(finishMs) && Number.isFinite(workoutEndMs)
        ? Math.max(0, Math.floor((finishMs - workoutEndMs) / 1000))
        : timing.cooldownSeconds;

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
          reps: movement.reps,
          distanceMeters: movement.distanceMeters,
          durationSeconds: contribution.durationSeconds,
          completedAssignments: contribution.completedAssignments,
        },
        completedAt: finishAt,
        durationSeconds,
        sessionDurationSeconds: personalSessionSeconds,
        warmupDurationSeconds: timing.warmupSeconds,
        cooldownDurationSeconds: personalCooldownSeconds,
        pacingTargetSeconds,
        rpe,
        weights: "",
        notes: `Týmový workout · ${FORMAT_LABELS[session.format]} · celkem ${clock(personalSessionSeconds)} · warm-up ${clock(timing.warmupSeconds)} · příprava ${clock(timing.briefingSeconds)} · cooldown ${clock(personalCooldownSeconds)} · pacing cíl ${clock(pacingTargetSeconds)}${firstWork ? "" : " · bez měřené části"}`,
        splits: [],
        source: "team",
      });
      rememberTeammates(session.id, session.participants, me.id);
      clearActiveTeamSession(session.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Výsledek se nepodařilo uložit.");
    } finally {
      setBusy(false);
    }
  }

  async function copyJoinCode() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.joinCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1600);
    } catch {
      setError("Kód se nepodařilo zkopírovat.");
    }
  }

  async function shareSession() {
    if (!session) return;
    const text = `Přidej se ke mně na Enginn: ${session.workoutTemplate.title} · kód ${session.joinCode}`;
    try {
      if (navigator.share) await navigator.share({ title: "Enginn Team Training", text });
      else {
        await navigator.clipboard.writeText(text);
        setCodeCopied(true);
        window.setTimeout(() => setCodeCopied(false), 1600);
      }
    } catch {
      // user cancelled share
    }
  }

  if (!user) return <main className="runner-shell grid min-h-dvh place-items-center px-5 text-white"><section className="ui-card max-w-sm p-6 text-center"><h1 className="text-2xl font-black">Přihlas se do Enginnu</h1><p className="mt-2 text-zinc-400">Pro připojení k týmové session potřebujeme tvůj účet.</p><Link href="/account" className="ui-button ui-button-primary mt-5 w-full">Přihlásit se</Link></section></main>;
  if (!session || !state || !me) return <main className="runner-shell grid min-h-dvh place-items-center px-5 text-zinc-400">{error ?? "Připojuji týmovou session…"}</main>;

  if (showPersonalSummary) {
    const myContribution = state.contributions[me.id] ?? { reps: 0, distanceMeters: 0, durationSeconds: 0, completedAssignments: 0 };
    const myMovement = movementTotals[me.id] ?? { reps: myContribution.reps, distanceMeters: myContribution.distanceMeters };
    const partnerStillWorking = session.participants.some((participant) => participant.id !== me.id && !state.participantFinish[participant.id]);
    const partnerStillWorkingName = session.participants.find((participant) => participant.id !== me.id && !state.participantFinish[participant.id])?.displayName;
    const lastWork = [...session.assignments].reverse().find((assignment) => phaseForAssignment(assignment) === "work");
    const workoutEndAt = lastWork ? completionTime(lastWork, snapshot?.events ?? []) : undefined;
    const finishAt = personalFinish?.at;
    const finishMs = finishAt ? Date.parse(finishAt) : NaN;
    const startMs = state.startedAt ? Date.parse(state.startedAt) : NaN;
    const workoutEndMs = workoutEndAt ? Date.parse(workoutEndAt) : NaN;
    const summarySessionSeconds = Number.isFinite(finishMs) && Number.isFinite(startMs)
      ? Math.max(0, Math.floor((finishMs - startMs) / 1000))
      : timing?.sessionSeconds;
    const summaryCooldownSeconds = Number.isFinite(finishMs) && Number.isFinite(workoutEndMs)
      ? Math.max(0, Math.floor((finishMs - workoutEndMs) / 1000))
      : timing?.cooldownSeconds;

    return (
      <main className="runner-shell safe-screen min-h-dvh px-4 text-white">
        <section className="mx-auto w-full max-w-md py-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Můj výsledek</p><h1 className="mt-1 text-3xl font-black">{session.workoutTemplate.title}</h1></div><span className={existingResult ? "ui-chip ui-chip-accent" : "ui-chip"}>{existingResult ? "Uloženo" : "Neuloženo"}</span></div>
          <div className="ui-card ui-card-accent mt-5 p-5"><p className="text-xs font-black uppercase tracking-wider text-zinc-500">Workout čas</p><p className="mt-1 font-mono text-5xl font-black text-accent">{clock(personalFinish?.durationSeconds ?? timing?.workoutSeconds)}</p><p className="mt-2 text-sm text-zinc-400">{FORMAT_LABELS[session.format]} · {session.joinCode}</p><div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs"><div className="ui-inset p-2"><b>{clock(timing?.warmupSeconds)}</b><span className="block text-[10px] text-zinc-500">warm-up</span></div><div className="ui-inset p-2"><b>{clock(timing?.briefingSeconds)}</b><span className="block text-[10px] text-zinc-500">příprava</span></div><div className="ui-inset p-2"><b>{clock(summaryCooldownSeconds)}</b><span className="block text-[10px] text-zinc-500">cooldown</span></div><div className="ui-inset p-2"><b>{clock(summarySessionSeconds)}</b><span className="block text-[10px] text-zinc-500">session celkem</span></div></div></div>
          {partnerStillWorking && <p className="mt-3 text-xs text-zinc-500">✓ Tvůj výkon je dokončen{partnerStillWorkingName ? ` · ${partnerStillWorkingName} ještě dokončuje session` : " · druhý sportovec ještě dokončuje session"}.</p>}
          <div className="mt-4 space-y-3">{teamResult?.participants.map((participant) => { const movement = movementTotals[participant.participantId] ?? { reps: participant.reps, distanceMeters: participant.distanceMeters }; return <div key={participant.participantId} className="ui-card p-4"><div className="flex items-center justify-between gap-3"><p className="font-black">{participant.displayName}</p><span className={participant.finish ? "ui-chip ui-chip-accent" : "ui-chip"}>{participant.finish ? "hotovo" : "dokončuje"}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm"><div className="ui-inset p-2"><b>{movement.reps}</b><span className="block text-[10px] text-zinc-500">reps</span></div><div className="ui-inset p-2"><b>{movement.distanceMeters} m</b><span className="block text-[10px] text-zinc-500">distance</span></div><div className="ui-inset p-2"><b>{clock(participant.durationSeconds)}</b><span className="block text-[10px] text-zinc-500">work</span></div></div></div>; })}</div>
          {!existingResult ? <section className="ui-card mt-4 p-5"><p className="font-black">Jak náročný byl trénink?</p><p className="mt-1 text-xs text-zinc-500">1 = velmi lehký · 10 = maximum</p><div className="mt-3 grid grid-cols-5 gap-2">{[1,2,3,4,5,6,7,8,9,10].map((value) => <button key={value} type="button" onClick={() => setRpe(value)} className={rpe === value ? "ui-button ui-button-primary px-2" : "ui-button ui-button-outline px-2"}>{value}</button>)}</div><button type="button" disabled={busy} onClick={() => void savePersonalResult()} className="ui-button ui-button-primary mt-4 w-full">Uložit záznam</button><p className="mt-3 text-xs leading-5 text-zinc-500">Výsledek zatím není uložený. Pokud odejdeš do Historie nebo na hlavní obrazovku, Enginn ti nabídne návrat k jeho dokončení.</p></section> : <p className="ui-feedback ui-feedback-success mt-4 text-sm">Týmový workout je uložený v tvojí historii.</p>}
          <div className="mt-4 grid gap-2"><Link href="/" className="ui-button ui-button-primary">Zpět na hlavní obrazovku</Link><Link href="/history" className="ui-button ui-button-outline">Detail výsledku / Historie</Link><Link href="/team" className="ui-button ui-button-ghost">Nový týmový workout</Link></div>
          {error && <p className="ui-feedback mt-4 text-sm text-amber-200">{error}</p>}
        </section>
      </main>
    );
  }

  if (state.status === "lobby" || state.status === "ready") return (
    <main className="runner-shell safe-screen min-h-dvh px-4 text-white"><section className="mx-auto w-full max-w-md py-5"><button type="button" onClick={() => router.push("/team")} className="ui-button ui-button-ghost ui-button-sm">← Týmové tréninky</button><p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-accent">{FORMAT_LABELS[session.format]}</p><h1 className="mt-1 text-3xl font-black">{session.workoutTemplate.title}</h1><div className="ui-card ui-card-accent mt-5 p-5"><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Join kód</p><div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2"><p className="min-w-0 truncate font-mono text-3xl font-black text-accent">{session.joinCode}</p><button type="button" onClick={() => void copyJoinCode()} className="ui-button ui-button-outline ui-button-sm">{codeCopied ? "✓ Zkopírováno" : "Kopírovat"}</button></div><button type="button" onClick={() => void shareSession()} className="ui-button ui-button-outline mt-3 w-full">Sdílet kód</button></div>{session.scheduledFor && <p className="ui-feedback mt-4 text-sm">Naplánováno: <b>{new Date(session.scheduledFor).toLocaleString("cs-CZ")}</b></p>}<section className="ui-card mt-4 p-5"><div className="flex items-center justify-between"><h2 className="font-black">Tým</h2><span className="ui-chip">{session.participants.length}/{session.participantLimit}</span></div><div className="mt-3 space-y-2">{session.participants.map((participant) => <div key={participant.id} className="ui-inset flex items-center justify-between px-4 py-3"><div><p className="font-bold">{participant.displayName}</p><p className="text-xs text-zinc-500">{participant.role === "host" ? "Host" : "Sportovec"}</p></div><span className={state.readyParticipantIds.includes(participant.id) ? "ui-chip ui-chip-accent" : "ui-chip"}>{state.readyParticipantIds.includes(participant.id) ? "READY" : "čeká"}</span></div>)}</div></section><section className="ui-card mt-4 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Pacing plán</p><p className="mt-1 font-black">Cíl měřené části {clock(pacingTargetSeconds)}</p></div><span className="ui-chip">{session.pacingSource === "custom" ? "vlastní cíl" : session.pacingSource === "history" ? "z historie" : "doporučený"}</span></div><p className="mt-2 text-xs leading-5 text-zinc-500">Warm-up a cooldown jsou mimo výsledný workout čas. Pacing zatím zobrazuje plánované cíle; skutečné live tempo doplní později měřená data.</p><div className="mt-3 space-y-2">{previewAssignments.filter((assignment) => phaseForAssignment(assignment) === "work").slice(0, 4).map((assignment) => { const preview = previewPacingPlan[assignment.id]; return <div key={assignment.id} className="ui-inset px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="font-bold">{assignment.stepName}{(assignment.totalRounds ?? 1) > 1 ? ` · ${assignment.round}/${assignment.totalRounds}` : ""}</p><span className="font-mono text-sm text-accent">{clock(preview?.movementTargetSeconds ?? preview?.targetSeconds)}</span></div><p className="mt-1 text-xs leading-5 text-zinc-500">{[preview?.paceLabel ? `Plánovaný průměr ${preview.paceLabel}` : undefined, preview?.splitSuggestion ?? preview?.cue].filter(Boolean).join(" · ")}</p></div>; })}</div></section><button type="button" disabled={busy} onClick={() => void toggleReady()} className={ready ? "ui-button ui-button-outline mt-4 w-full" : "ui-button ui-button-primary mt-4 w-full"}>{ready ? "Nejsem připraven" : "Jsem READY"}</button>{isHost && <button type="button" disabled={busy || !canStartTeamSession(session, state)} onClick={() => void startSession()} className="ui-button ui-button-accent mt-2 w-full">START SESSION · 10 s</button>}{isHost && !canStartTeamSession(session, state) && <p className="mt-3 text-center text-xs text-zinc-500">Start se odemkne, až budou alespoň dva sportovci READY.</p>}{error && <p className="ui-feedback mt-4 text-sm text-amber-200">{error}</p>}</section></main>
  );

  if (!current || !progress) return <main className="runner-shell grid min-h-dvh place-items-center text-zinc-400">Synchronizuji další úsek…</main>;

  const liveSession = session;
  const liveCurrent = current;
  const liveProgress = progress;
  const target = targetLabel(liveCurrent, liveProgress.reps, liveProgress.distanceMeters, liveProgress.completedByParticipantIds.length);
  const activeName = liveSession.participants.find((participant) => participant.id === liveProgress.activeParticipantId)?.displayName;
  const currentPacing = pacingPlan[liveCurrent.id];
  const distanceOptions = adaptiveProgressOptions(liveCurrent.targetDistanceMeters, liveProgress.distanceMeters, "distance").slice(0, 3);
  const repOptions = adaptiveProgressOptions(liveCurrent.targetReps, liveProgress.reps, "reps").slice(0, 3);
  const primaryClock = currentPhase === "warmup" ? timing?.warmupSeconds : currentPhase === "cooldown" ? timing?.cooldownSeconds : timing?.workoutSeconds;
  const primaryClockLabel = currentPhase === "warmup" ? "WARM-UP · MIMO WORKOUT ČAS" : currentPhase === "cooldown" ? "COOLDOWN · MIMO WORKOUT ČAS" : "WORKOUT";
  const starterClaimRequired = currentPhase === "work" && requiresStarterClaim(liveCurrent) && !liveProgress.activeParticipantId;
  const progressFraction = liveCurrent.mode === "simultaneous" && liveCurrent.participantIds.length > 1
    ? Math.min(1, liveProgress.completedByParticipantIds.length / liveCurrent.participantIds.length)
    : liveCurrent.targetDistanceMeters
      ? Math.min(1, liveProgress.distanceMeters / liveCurrent.targetDistanceMeters)
      : liveCurrent.targetReps
        ? Math.min(1, liveProgress.reps / liveCurrent.targetReps)
        : undefined;
  const currentParticipantProgress = Object.fromEntries(liveCurrent.participantIds.map((id) => {
    let reps = 0;
    let distance = 0;
    for (const item of snapshot.events) {
      if (item.type !== "step-progress" || item.assignmentId !== liveCurrent.id || item.participantId !== id) continue;
      reps += Math.max(0, item.repsDelta ?? 0);
      distance += Math.max(0, item.distanceMetersDelta ?? 0);
    }
    return [id, { reps, distance }];
  }));

  function participantLiveStatus(id: string) {
    if (state?.participantFinish[id]) return "✓ session hotová";
    const completed = liveProgress.completedByParticipantIds.includes(id);
    if (completed) return currentPhase === "warmup" ? "✓ warm-up hotovo" : currentPhase === "cooldown" ? "✓ cooldown hotovo" : "✓ hotovo";
    if (starterClaimRequired) return "volba startujícího";
    if (liveProgress.activeParticipantId === id) return `na řadě · ${liveCurrent.stepName}`;
    if (liveCurrent.mode === "simultaneous") return currentPhase === "warmup" ? "warm-up" : currentPhase === "cooldown" ? "cooldown" : "pracuje";
    return `čeká na ${activeName ?? "partnera"}`;
  }

  if (briefingActive) {
    const workAssignments = liveSession.assignments.filter((assignment) => phaseForAssignment(assignment) === "work");
    return (
      <main className="runner-shell safe-screen min-h-dvh px-4 text-white"><section className="mx-auto flex min-h-dvh w-full max-w-md flex-col py-4"><header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="justify-self-start ui-chip ui-chip-accent">{FORMAT_LABELS[liveSession.format]}</span><RunnerBrandButton onClick={minimizeSession} /><div className="justify-self-end text-right"><p className="font-mono text-lg font-black">{clock(timing?.sessionSeconds)}</p><p className="text-[9px] uppercase tracking-wider text-zinc-600">session</p></div></header><div className="mt-5"><p className="text-xs font-black uppercase tracking-[0.24em] text-accent">Příprava na workout</p><h1 className="mt-1 text-3xl font-black">Strategie před startem</h1><p className="mt-2 text-sm leading-5 text-zinc-400">Workout čas zatím neběží. Projděte si plán, oba potvrďte připravenost a Enginn spustí synchronizovaný odpočet 10 s.</p></div><div className="ui-card ui-card-accent mt-4 flex items-center justify-between gap-4 p-4"><div><p className="text-[10px] uppercase tracking-wider text-zinc-500">Cíl měřené části</p><p className="mt-1 font-mono text-3xl font-black text-accent">{clock(pacingTargetSeconds)}</p></div><span className="ui-chip">{workAssignments.length} úseků</span></div><div className="ui-card mt-3 min-h-0 flex-1 overflow-y-auto p-3"><div className="space-y-2">{workAssignments.map((assignment) => { const pacing = pacingPlan[assignment.id]; return <div key={assignment.id} className="ui-inset px-3 py-2.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{assignment.stepName}</p><p className="mt-0.5 text-[10px] text-zinc-500">{(assignment.totalRounds ?? 1) > 1 ? `Kolo ${assignment.round}/${assignment.totalRounds} · ` : ""}{modeLabel(assignment)}</p></div><span className="shrink-0 font-mono text-sm font-black text-accent">{clock(pacing?.movementTargetSeconds ?? pacing?.targetSeconds)}</span></div>{(pacing?.paceLabel || pacing?.splitSuggestion) && <p className="mt-1 text-[11px] leading-4 text-zinc-400">{[pacing?.paceLabel ? `Plánovaný průměr ${pacing.paceLabel}` : undefined, pacing?.splitSuggestion].filter(Boolean).join(" · ")}</p>}</div>; })}</div></div><div className="mt-3 grid grid-cols-2 gap-2">{liveSession.participants.map((participant) => <div key={participant.id} className="ui-inset px-3 py-2"><p className="truncate text-sm font-black">{participant.displayName}</p><p className={workoutReady.has(participant.id) ? "mt-0.5 text-xs text-accent" : "mt-0.5 text-xs text-zinc-500"}>{workoutReady.has(participant.id) ? "✓ připraven" : "čeká"}</p></div>)}</div><button type="button" disabled={busy || Boolean(workoutStartAt)} onClick={() => void toggleWorkoutReady()} className={workoutReady.has(me.id) ? "ui-button ui-button-outline mt-3 w-full" : "ui-button ui-button-primary mt-3 w-full"}>{workoutReady.has(me.id) ? "PŘIPRAVEN · ČEKÁM" : "JSEM PŘIPRAVEN"}</button><p className="mt-2 text-center text-[10px] leading-4 text-zinc-600">Kdo začne sdílené stanoviště, rozhodujete na místě. Enginn bez živých dat neurčuje, kdo je méně unavený.</p>{error && <p className="ui-feedback mt-2 text-xs text-amber-200">{error}</p>}</section></main>
    );
  }

  if (activeCountdownSeconds > 0) {
    const mainStart = workoutCountdownSeconds > 0;
    return (
      <main className="runner-shell safe-screen flex h-dvh flex-col px-5 text-center text-white"><header className="mx-auto grid w-full max-w-md grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="justify-self-start ui-chip ui-chip-accent">{FORMAT_LABELS[liveSession.format]}</span><RunnerBrandButton onClick={minimizeSession} /><span className="justify-self-end font-mono text-sm text-zinc-500">ÚSEK {liveCurrent.sequence + 1}/{liveSession.assignments.length}</span></header><section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center"><p className="text-sm font-black uppercase tracking-[0.25em] text-accent">{mainStart ? "Měřený workout startuje" : "Session startuje"}</p><p className="mt-3 font-mono text-8xl font-black tabular-nums">{activeCountdownSeconds}</p><p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{phaseTitle(liveCurrent)}</p><h1 className="mt-1 line-clamp-2 text-4xl font-black leading-tight">{liveCurrent.stepName}</h1><p className="mt-5 text-xs text-zinc-500">Hlasitý odpočet je synchronizovaný pro všechny telefony.</p></section></main>
    );
  }

  const meCompletedCurrent = liveProgress.completedByParticipantIds.includes(me.id);
  const titleFontSize = liveCurrent.stepName.length > 34
    ? "clamp(1.7rem, 6.8vw, 2.35rem)"
    : liveCurrent.stepName.length > 22
      ? "clamp(1.95rem, 7.8vw, 2.75rem)"
      : "clamp(2.2rem, 9vw, 3.15rem)";
  const participantColumns = `repeat(${Math.max(1, Math.min(liveSession.participants.length, 4))}, minmax(0, 1fr))`;

  return (
    <main className="runner-shell safe-screen text-white" style={{ height: "100dvh", overflow: "hidden" }}>
      <section className="mx-auto grid h-full w-full max-w-md gap-2 px-3 py-2" style={{ gridTemplateRows: "auto auto minmax(0, 1fr) auto auto" }}>
        <header className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="ui-chip ui-chip-accent max-w-[9rem] truncate justify-self-start">{FORMAT_LABELS[liveSession.format]}</span>
          <RunnerBrandButton onClick={minimizeSession} />
          <div className="justify-self-end text-right"><p className="font-mono text-base font-black">{clock(timing?.sessionSeconds)}</p><p className="text-[8px] uppercase tracking-[0.18em] text-zinc-600">session</p></div>
        </header>

        <section className="min-h-0 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2"><p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-accent">{phaseTitle(liveCurrent)}</p>{(liveCurrent.totalRounds ?? 1) > 1 && <span className="shrink-0 font-mono text-[10px] text-zinc-500">{liveCurrent.round}/{liveCurrent.totalRounds}</span>}</div>
          <h1 className="mt-0.5 line-clamp-2 font-black leading-[0.98]" style={{ fontSize: titleFontSize }}>{liveCurrent.stepName}</h1>
          {liveCurrent.stepDetail && <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{liveCurrent.stepDetail}</p>}
          <div className="mt-1.5 flex min-w-0 gap-1.5"><span className="ui-chip shrink-0 py-1 text-[10px]">{modeLabel(liveCurrent)}</span>{liveCurrent.exerciseId && <Link href={`/exercises/${encodeURIComponent(liveCurrent.exerciseId)}`} className="ui-chip shrink-0 py-1 text-[10px]">Jak na to</Link>}</div>
          <div className="mt-1 text-center"><p className="font-mono font-black leading-[0.86] tracking-[-0.07em]" style={{ fontSize: "clamp(4.6rem, 20vw, 6.75rem)" }}>{clock(primaryClock)}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.28em] text-accent">{primaryClockLabel}</p></div>
        </section>

        <section className="min-h-0 overflow-hidden">
          {currentPhase === "work" ? <div className="grid content-start gap-2">
            <div className="ui-inset min-w-0 px-3 py-2.5"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Týmový postup</p><span className="truncate text-base font-black text-accent">{target}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-accent" style={{ width: `${progressFraction !== undefined ? Math.max(2, progressFraction * 100) : ((liveCurrent.sequence + 1) / Math.max(1, liveSession.assignments.length)) * 100}%` }} /></div></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="ui-inset min-w-0 px-3 py-2.5"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-accent">Pacing</p><button type="button" onClick={() => setShowStrategy(true)} className="text-[9px] font-bold text-zinc-500">Strategie</button></div><p className="mt-0.5 truncate font-mono text-xs font-black">Cíl {clock(currentPacing?.movementTargetSeconds ?? currentPacing?.targetSeconds)}</p>{currentPacing?.paceLabel && <p className="mt-0.5 line-clamp-2 text-[10px] font-black text-accent">Průměr {currentPacing.paceLabel}</p>}{currentPacing?.transitionSeconds ? <p className="mt-0.5 truncate text-[9px] text-zinc-600">Přechod cca {clock(currentPacing.transitionSeconds)}</p> : null}</div>
              <div className="ui-inset flex min-w-0 items-center justify-between gap-2 px-3 py-2.5"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Následuje</p><p className="mt-1 line-clamp-2 text-sm font-black">{next?.stepName ?? "Týmový výsledek"}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-full border border-accent/25 text-lg text-accent">→</span></div>
            </div>
          </div> : <div className="grid grid-cols-2 gap-2">
            <div className="ui-inset px-3 py-3 text-xs leading-5 text-zinc-400">{currentPhase === "warmup" ? "Warm-up se synchronizuje, ale nepočítá se do workout času." : "Cooldown patří do celkové délky session, ne do výsledného workout času."}</div>
            <div className="ui-inset flex min-w-0 items-center justify-between gap-2 px-3 py-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Následuje</p><p className="mt-1 line-clamp-2 text-sm font-black">{next?.stepName ?? "Týmový výsledek"}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-full border border-accent/25 text-lg text-accent">→</span></div>
          </div>}
        </section>

        <section className="grid shrink-0 gap-1.5">
          {starterClaimRequired ? <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-2.5 text-center"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-accent">Kdo začíná?</p><p className="mt-0.5 text-sm font-black">Rozhodněte podle situace</p><p className="mx-auto mt-0.5 line-clamp-2 max-w-xs text-[10px] leading-4 text-zinc-500">Enginn startujícího zatím neurčuje. Rozhodněte podle dechu, pocitu a aktuální únavy.</p><button type="button" disabled={busy} onClick={() => void claimCurrentStep()} className="ui-button ui-button-primary mt-2 w-full">ZAČÍNÁM JÁ</button></div> : canWork ? <>
            {(liveCurrent.mode === "shared-reps" || liveCurrent.mode === "shared-distance") && <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-2.5"><div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="font-black uppercase tracking-[0.16em] text-zinc-500">Moje práce</span><span className="font-mono font-black text-accent">{liveCurrent.mode === "shared-distance" ? `${currentParticipantProgress[me.id]?.distance ?? 0} m` : `${currentParticipantProgress[me.id]?.reps ?? 0} reps`}</span></div><div className="grid grid-cols-4 gap-1.5">{(liveCurrent.mode === "shared-distance" ? distanceOptions : repOptions).map((value) => <button key={value} type="button" disabled={busy} onClick={() => void addProgress(liveCurrent.mode === "shared-distance" ? "distance" : "reps", value)} className="ui-button ui-button-primary min-h-10 px-1 text-xs">+{value}{liveCurrent.mode === "shared-distance" ? "m" : ""}</button>)}<button type="button" onClick={() => setShowCustomProgress((value) => !value)} className="ui-button ui-button-outline min-h-10 px-1 text-xs">Jiná</button></div>{showCustomProgress && <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-1.5"><input type="number" min="1" inputMode="numeric" value={customProgress} onChange={(input) => setCustomProgress(input.target.value)} placeholder={liveCurrent.mode === "shared-distance" ? "metry" : "reps"} className="ui-field min-h-9 py-1.5" /><button type="button" disabled={busy || !Number(customProgress)} onClick={() => void addCustomProgress(liveCurrent.mode === "shared-distance" ? "distance" : "reps")} className="ui-button ui-button-outline ui-button-sm">Přidat</button></div>}<div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-zinc-500">{liveCurrent.participantIds.map((id) => <span key={id}><b className="text-zinc-300">{liveSession.participants.find((participant) => participant.id === id)?.displayName}:</b> {liveCurrent.mode === "shared-distance" ? `${currentParticipantProgress[id]?.distance ?? 0} m` : `${currentParticipantProgress[id]?.reps ?? 0} reps`}</span>)}</div>{liveProgress.activeParticipantId === me.id && liveCurrent.participantIds.length > 1 && <button type="button" disabled={busy} onClick={() => void handoff()} className="ui-button ui-button-accent mt-2 w-full">PŘEDAT →</button>}</div>}
            {(liveCurrent.mode === "simultaneous" || liveCurrent.mode === "solo" || liveCurrent.mode === "relay") && <button type="button" disabled={busy || meCompletedCurrent} onClick={() => void completeMyStep()} className="ui-button ui-button-primary w-full">{meCompletedCurrent ? "✓ HOTOVO · ČEKÁM NA PARTNERA" : currentPhase === "warmup" ? "WARM-UP HOTOVO" : currentPhase === "cooldown" ? "COOLDOWN HOTOVO" : "MŮJ ÚSEK HOTOVO"}</button>}
            {liveCurrent.mode === "you-go-i-go" && <div className="grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => void handoff()} className="ui-button ui-button-accent">PŘEDAT →</button><button type="button" disabled={busy} onClick={() => void completeMyStep()} className="ui-button ui-button-outline">Stanice hotová</button></div>}
          </> : <div className="ui-inset px-3 py-2 text-center"><p className="text-sm font-black">{meCompletedCurrent ? "✓ HOTOVO · ČEKÁM NA PARTNERA" : "Připrav se"}</p><p className="mt-0.5 truncate text-[10px] text-zinc-500">{meCompletedCurrent ? "Partner dokončuje svůj úsek." : `Teď pracuje ${activeName ?? "tvůj parťák"}. Stav se přepne automaticky.`}</p></div>}
          {isHost && <button type="button" disabled={busy} onClick={() => void completeTeamStep()} className="w-full rounded-[1rem] border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] font-bold text-zinc-600">◎ Host: označit týmově hotovo</button>}
        </section>

        <section className="grid shrink-0 gap-1.5" style={{ gridTemplateColumns: participantColumns }}>{liveSession.participants.slice(0, 4).map((participant) => { const contribution = state.contributions[participant.id]; return <div key={participant.id} className="ui-inset min-w-0 border border-accent/20 px-2.5 py-2"><div className="flex items-center justify-between gap-1"><p className="truncate text-xs font-black">{participant.displayName}</p><span className="shrink-0 font-mono text-[9px] text-zinc-500">{clock(contribution?.durationSeconds ?? 0)}</span></div><p className={state.participantFinish[participant.id] ? "mt-0.5 truncate text-[9px] text-accent" : "mt-0.5 truncate text-[9px] text-zinc-400"}>{participantLiveStatus(participant.id)}</p></div>; })}</section>

        {error && <p className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-amber-950/90 px-3 py-1.5 text-[10px] text-amber-200">{error}</p>}

        {showStrategy && <div className="runner-shell fixed inset-0 z-[95] overflow-y-auto text-white" role="dialog" aria-modal="true"><div className="safe-screen mx-auto min-h-dvh w-full max-w-md px-4 py-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Strategie</p><h2 className="mt-1 text-2xl font-black">Plán měřené části</h2></div><button type="button" onClick={() => setShowStrategy(false)} className="ui-button ui-button-outline ui-button-sm">Zavřít</button></div><div className="mt-4 space-y-2">{liveSession.assignments.filter((assignment) => phaseForAssignment(assignment) === "work").map((assignment) => { const pacing = pacingPlan[assignment.id]; return <div key={assignment.id} className="ui-inset p-3"><div className="flex justify-between gap-3"><div><p className="font-black">{assignment.stepName}</p><p className="mt-0.5 text-xs text-zinc-500">{(assignment.totalRounds ?? 1) > 1 ? `Kolo ${assignment.round}/${assignment.totalRounds} · ` : ""}{modeLabel(assignment)}</p></div><span className="font-mono text-sm font-black text-accent">{clock(pacing?.movementTargetSeconds ?? pacing?.targetSeconds)}</span></div>{(pacing?.paceLabel || pacing?.splitSuggestion || pacing?.cue) && <p className="mt-1 text-xs text-zinc-400">{[pacing?.paceLabel ? `Plánovaný průměr ${pacing.paceLabel}` : undefined, pacing?.splitSuggestion, pacing?.cue].filter(Boolean).join(" · ")}</p>}</div>; })}</div></div></div>}
        {showPrevious && previous && <div className="runner-shell fixed inset-0 z-[95] overflow-y-auto text-white" role="dialog" aria-modal="true"><div className="safe-screen mx-auto min-h-dvh w-full max-w-md px-5 py-5"><p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Předchozí úsek</p><h2 className="mt-1 text-3xl font-black">{previous.stepName}</h2>{previous.stepDetail && <p className="mt-3 text-zinc-300">{previous.stepDetail}</p>}<div className="ui-card mt-5 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Režim</p><p className="mt-1 font-black">{modeLabel(previous)}</p></div><button type="button" onClick={() => setShowPrevious(false)} className="ui-button ui-button-primary mt-6 w-full">Zpět na aktuální cvik</button><p className="mt-4 text-center text-xs text-zinc-500">Pouze náhled. Týmový postup se nevrací zpět.</p></div></div>}
      </section>
    </main>
  );
}
