"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import { loadCloudUser } from "@/lib/firebase-rest";
import { createTeamJoinCode, isValidTeamJoinCode, normalizeTeamJoinCode } from "@/lib/team-join-code";
import { loadRecentTeammates, loadTeamProfile, saveTeamProfile } from "@/lib/team-profile";
import { teamWorkoutTransport } from "@/lib/team-training-firestore";
import type { TeamWorkoutFormat, TeamWorkoutParticipant, TeamWorkoutSession } from "@/lib/team-training";

const FORMAT_LABELS: Record<TeamWorkoutFormat, { title: string; description: string }> = {
  shared: { title: "Společný workout", description: "Každý jede stejný workout na svém telefonu a vidí postup týmu." },
  doubles: { title: "Partner / Doubles", description: "Sdílené reps, vzdálenosti a YGIG předávky podle konkrétních cviků." },
  relay: { title: "Relay", description: "Enginn rozdělí úseky mezi členy týmu a hlídá pořadí střídání." },
};

export default function TeamTrainingPage() {
  const router = useRouter();
  const { data, ready } = useHyroxData();
  const user = loadCloudUser();
  const initialProfile = useMemo(() => loadTeamProfile(user), [user?.uid]);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [format, setFormat] = useState<TeamWorkoutFormat>("doubles");
  const [templateId, setTemplateId] = useState("");
  const [participantLimit, setParticipantLimit] = useState(2);
  const [scheduledFor, setScheduledFor] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const recent = useMemo(() => loadRecentTeammates(), []);

  const templates = useMemo(() => data.templates.filter((template) => template.blocks.some((block) => block.steps.length > 0)), [data.templates]);
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? templates[0];

  function participant(role: "host" | "athlete"): TeamWorkoutParticipant {
    if (!user) throw new Error("Pro týmový trénink se nejdřív přihlas.");
    return {
      id: `athlete-${user.uid}`,
      userId: user.uid,
      displayName: displayName.trim() || initialProfile.displayName,
      role,
      status: "joined",
      joinedAt: new Date().toISOString(),
    };
  }

  async function createSession() {
    if (!user || !selectedTemplate) return;
    setBusy(true); setError(undefined);
    saveTeamProfile({ displayName });
    try {
      let lastError: unknown;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const code = createTeamJoinCode();
        const host = participant("host");
        const session: TeamWorkoutSession = {
          version: 1,
          id: code,
          joinCode: code,
          workoutTemplateId: selectedTemplate.id,
          workoutTemplate: structuredClone(selectedTemplate),
          format,
          hostUserId: user.uid,
          status: "lobby",
          participantLimit: format === "relay" ? Math.max(2, participantLimit) : 2,
          participants: [host],
          assignments: [],
          createdAt: new Date().toISOString(),
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        };
        try {
          await teamWorkoutTransport.createSession(session);
          router.push(`/team/session/${encodeURIComponent(code)}`);
          return;
        } catch (err) { lastError = err; }
      }
      throw lastError instanceof Error ? lastError : new Error("Session se nepodařilo vytvořit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Session se nepodařilo vytvořit.");
    } finally { setBusy(false); }
  }

  async function joinSession() {
    if (!user) return;
    const code = normalizeTeamJoinCode(joinCode);
    if (!isValidTeamJoinCode(code)) { setError("Join kód má formát ENG-7K2M-9Q4P."); return; }
    setBusy(true); setError(undefined); saveTeamProfile({ displayName });
    try {
      const snapshot = await teamWorkoutTransport.getSession(code);
      if (!snapshot) throw new Error("Týmová session s tímto kódem neexistuje.");
      await teamWorkoutTransport.joinSession(code, participant(snapshot.session.hostUserId === user.uid ? "host" : "athlete"));
      router.push(`/team/session/${encodeURIComponent(code)}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Připojení se nepodařilo."); }
    finally { setBusy(false); }
  }

  return (
    <PlanningShell eyebrow="3B.3 · Multiplayer" title="Trénovat společně" description="Jeden workout, více telefonů. Lokálně ve fitku i na dálku." backHref="/workouts">
      {!user && (
        <section className="ui-card ui-card-accent p-6">
          <h2 className="text-xl font-black">Týmové session potřebují účet</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Přihlášení drží session bezpečně navázanou na jednotlivé sportovce a umožní reconnect na jiném telefonu.</p>
          <Link href="/account" className="ui-button ui-button-primary mt-4 w-full">Přihlásit se</Link>
        </section>
      )}

      {user && (
        <>
          <section className="ui-card p-5 sm:p-6">
            <label className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500" htmlFor="team-name">Tvoje jméno v session</label>
            <input id="team-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="ui-field mt-3" maxLength={32} />
          </section>

          <section className="ui-card mt-5 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Vytvořit session</p>
            <div className="mt-4 grid gap-2">
              {(Object.keys(FORMAT_LABELS) as TeamWorkoutFormat[]).map((item) => (
                <button key={item} type="button" onClick={() => { setFormat(item); if (item !== "relay") setParticipantLimit(2); }} className={format === item ? "ui-choice border-accent text-left" : "ui-choice text-left"}>
                  <span className="font-black">{FORMAT_LABELS[item].title}</span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">{FORMAT_LABELS[item].description}</span>
                </button>
              ))}
            </div>

            <label className="mt-5 block text-xs font-black uppercase tracking-[0.18em] text-zinc-500" htmlFor="team-workout">Workout</label>
            <select id="team-workout" value={selectedTemplate?.id ?? ""} onChange={(event) => setTemplateId(event.target.value)} className="ui-field mt-3" disabled={!ready}>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.title} · {template.durationMinutes} min</option>)}
            </select>

            {format === "relay" && (
              <div className="mt-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Počet lidí</p>
                <div className="mt-3 grid grid-cols-3 gap-2">{[2, 3, 4].map((count) => <button key={count} type="button" onClick={() => setParticipantLimit(count)} className={participantLimit === count ? "ui-button ui-button-primary" : "ui-button ui-button-outline"}>{count}</button>)}</div>
              </div>
            )}

            <label className="mt-5 block text-xs font-black uppercase tracking-[0.18em] text-zinc-500" htmlFor="team-schedule">Kdy? <span className="normal-case tracking-normal text-zinc-600">(volitelné · pro remote)</span></label>
            <input id="team-schedule" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="ui-field mt-3" />

            <button type="button" disabled={busy || !selectedTemplate} onClick={() => void createSession()} className="ui-button ui-button-primary mt-5 w-full">{busy ? "Vytvářím…" : "Vytvořit týmovou session"}</button>
          </section>

          <section className="ui-card mt-5 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Připojit se</p>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} onBlur={() => setJoinCode((value) => normalizeTeamJoinCode(value))} placeholder="ENG-7K2M-9Q4P" className="ui-field font-mono uppercase" maxLength={13} />
              <button type="button" disabled={busy} onClick={() => void joinSession()} className="ui-button ui-button-accent">Připojit</button>
            </div>
          </section>

          {recent.length > 0 && (
            <section className="ui-card mt-5 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Naposledy spolu</p><h2 className="mt-1 text-xl font-black">Spoluhráči</h2></div><span className="ui-chip">Remote ready</span></div>
              <div className="mt-4 space-y-2">{recent.slice(0, 5).map((teammate) => <div key={teammate.id} className="ui-inset flex items-center justify-between px-4 py-3"><span className="font-bold">{teammate.displayName}</span><span className="text-xs text-zinc-500">{new Date(teammate.lastTrainedAt).toLocaleDateString("cs-CZ")}</span></div>)}</div>
            </section>
          )}
        </>
      )}

      {error && <p className="ui-feedback mt-5 text-sm text-amber-200">{error}</p>}
    </PlanningShell>
  );
}
