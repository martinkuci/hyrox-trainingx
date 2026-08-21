"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import { loadCloudUser } from "@/lib/firebase-rest";
import { createTeamJoinCode, isValidTeamJoinCode, normalizeTeamJoinCode } from "@/lib/team-join-code";
import { recommendedWorkoutTargetSeconds } from "@/lib/team-pacing";
import { loadRecentTeammates, loadTeamProfile, saveTeamProfile } from "@/lib/team-profile";
import { teamWorkoutTransport } from "@/lib/team-training-firestore";
import type { TeamPacingSource, TeamWorkoutFormat, TeamWorkoutParticipant, TeamWorkoutSession } from "@/lib/team-training";

const FORMAT_LABELS: Record<TeamWorkoutFormat, { title: string; description: string }> = {
  shared: { title: "Společný workout", description: "Každý jede stejný workout na svém telefonu a vidí postup týmu." },
  doubles: { title: "Partner / Doubles", description: "Sdílené reps, vzdálenosti a YGIG předávky podle konkrétních cviků." },
  relay: { title: "Relay", description: "Enginn rozdělí úseky mezi členy týmu a hlídá pořadí střídání." },
};

const HYROX_REFERENCE_RACE_SECONDS = 90 * 60;

function phaseLabel(title: string) {
  const normalized = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (["rozcvi", "warmup", "warm-up", "rozbeh"].some((token) => normalized.includes(token))) return "Warm-up";
  if (["zklid", "cooldown", "cool-down", "regener"].some((token) => normalized.includes(token))) return "Cooldown";
  return title;
}

function parseTargetTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) return Math.max(60, Number(trimmed) * 60);
  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return undefined;
  if (parts.length === 2) return Math.max(60, parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.max(60, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return undefined;
}

function formatTarget(seconds: number | undefined) {
  if (!seconds) return "—";
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function visibleCarouselIndexes(total: number, current: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);
  const start = Math.max(0, Math.min(current - 2, total - 5));
  return Array.from({ length: 5 }, (_, offset) => start + offset);
}

export default function TeamTrainingPage() {
  const router = useRouter();
  const { data, ready } = useHyroxData();
  const user = loadCloudUser();
  const initialProfile = useMemo(() => loadTeamProfile(user), [user?.uid]);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [format, setFormat] = useState<TeamWorkoutFormat>("doubles");
  const formatRef = useRef<TeamWorkoutFormat>("doubles");
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(-1);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [workoutPickerOpen, setWorkoutPickerOpen] = useState(false);
  const [participantLimit, setParticipantLimit] = useState(2);
  const [scheduledFor, setScheduledFor] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [pacingSource, setPacingSource] = useState<TeamPacingSource>("auto");
  const [customPacingTarget, setCustomPacingTarget] = useState("");
  const touchStartX = useRef<number | null>(null);
  const recent = useMemo(() => loadRecentTeammates(), []);

  const templates = useMemo(() => data.templates.filter((template) => template.blocks.some((block) => block.steps.length > 0)), [data.templates]);
  const safeSelectedIndex = selectedWorkoutIndex < 0 ? 0 : templates.length ? Math.min(selectedWorkoutIndex, templates.length - 1) : 0;
  const safePickerIndex = templates.length ? Math.min(pickerIndex, templates.length - 1) : 0;
  const selectedTemplate = selectedWorkoutIndex < 0 ? undefined : templates[safeSelectedIndex];
  const pickerTemplate = templates[safePickerIndex];
  const isRaceSimulation = selectedTemplate?.metadata?.category === "race-simulation";
  const previousResult = useMemo(() => {
    if (!selectedTemplate) return undefined;
    const exactTeam = data.results
      .filter((result) => result.templateId === selectedTemplate.id && result.source === "team" && result.teamFormat === format && result.durationSeconds > 0)
      .sort((left, right) => left.durationSeconds - right.durationSeconds)[0];
    if (exactTeam) return exactTeam;
    return data.results
      .filter((result) => result.templateId === selectedTemplate.id && result.durationSeconds > 0)
      .sort((left, right) => left.durationSeconds - right.durationSeconds)[0];
  }, [data.results, format, selectedTemplate]);
  const automaticTargetSeconds = selectedTemplate ? recommendedWorkoutTargetSeconds(selectedTemplate) : undefined;
  const customInputSeconds = parseTargetTime(customPacingTarget);
  const customWorkoutTargetSeconds = isRaceSimulation && automaticTargetSeconds && customInputSeconds
    ? Math.max(5 * 60, Math.round(automaticTargetSeconds * customInputSeconds / HYROX_REFERENCE_RACE_SECONDS))
    : customInputSeconds;
  const selectedPacingTargetSeconds = pacingSource === "custom"
    ? customWorkoutTargetSeconds
    : pacingSource === "history"
      ? previousResult?.durationSeconds ?? automaticTargetSeconds
      : automaticTargetSeconds;
  const pickerTargetSeconds = pickerTemplate ? recommendedWorkoutTargetSeconds(pickerTemplate) : undefined;
  const dotIndexes = visibleCarouselIndexes(templates.length, safePickerIndex);

  function selectFormat(item: TeamWorkoutFormat) {
    formatRef.current = item;
    setFormat(item);
    if (item !== "relay") setParticipantLimit(2);
  }

  function openWorkoutPicker() {
    setPickerIndex(selectedWorkoutIndex < 0 ? 0 : safeSelectedIndex);
    setWorkoutPickerOpen(true);
  }

  function moveCarousel(direction: -1 | 1) {
    if (!templates.length) return;
    setPickerIndex((current) => (current + direction + templates.length) % templates.length);
  }

  function confirmWorkout() {
    if (!pickerTemplate) return;
    setSelectedWorkoutIndex(safePickerIndex);
    setPacingSource("auto");
    setCustomPacingTarget("");
    setWorkoutPickerOpen(false);
  }

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
    if (!user || !selectedTemplate || !selectedPacingTargetSeconds) return;
    setBusy(true); setError(undefined);
    saveTeamProfile({ displayName });
    try {
      let lastError: unknown;
      const selectedFormat = formatRef.current;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const code = createTeamJoinCode();
        const host = participant("host");
        const session: TeamWorkoutSession = {
          version: 1,
          id: code,
          joinCode: code,
          workoutTemplateId: selectedTemplate.id,
          workoutTemplate: structuredClone(selectedTemplate),
          format: selectedFormat,
          hostUserId: user.uid,
          status: "lobby",
          participantLimit: selectedFormat === "relay" ? Math.max(2, participantLimit) : 2,
          participants: [host],
          assignments: [],
          createdAt: new Date().toISOString(),
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
          pacingTargetSeconds: Math.round(selectedPacingTargetSeconds),
          pacingSource,
        };
        try {
          const created = await teamWorkoutTransport.createSession(session);
          if (created.session.format !== selectedFormat) throw new Error("Formát session se neuložil správně. Zkus session vytvořit znovu.");
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

          <section className="ui-card mt-5 min-w-0 overflow-x-hidden p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Vytvořit session</p>
            <div className="mt-4 grid min-w-0 gap-2">
              {(Object.keys(FORMAT_LABELS) as TeamWorkoutFormat[]).map((item) => {
                const active = format === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectFormat(item)}
                    className={active ? "ui-choice min-w-0 border-accent bg-accent/10 text-left shadow-[0_0_0_1px_rgba(184,255,74,0.35)]" : "ui-choice min-w-0 text-left"}
                  >
                    <span className="block break-words font-black">{FORMAT_LABELS[item].title}</span>
                    <span className="mt-1 block break-words text-xs leading-5 text-zinc-500">{FORMAT_LABELS[item].description}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Workout</p><p className="mt-1 text-xs text-zinc-500">Nejdřív zvol režim session, potom otevři výběr konkrétního workoutu.</p></div>{selectedTemplate && <span className="ui-chip shrink-0">{safeSelectedIndex + 1}/{templates.length}</span>}</div>
            {selectedTemplate ? <div className="ui-inset mt-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-black leading-5">{selectedTemplate.title}</p><p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-zinc-500">{selectedTemplate.description}</p></div><span className="ui-chip shrink-0">{selectedTemplate.durationMinutes} min</span></div><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-zinc-500">{selectedTemplate.blocks.length} bloků · cíl {formatTarget(automaticTargetSeconds)}</span><button type="button" onClick={openWorkoutPicker} className="ui-button ui-button-outline ui-button-sm shrink-0">Změnit workout</button></div></div> : <button type="button" onClick={openWorkoutPicker} className="ui-button ui-button-primary mt-3 w-full">Vybrat workout pro {FORMAT_LABELS[format].title}</button>}

            {selectedTemplate && <section className="ui-inset mt-5 min-w-0 p-4">
              <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Pacing cíl</p><p className="mt-1 text-xs text-zinc-500">{isRaceSimulation ? "Nováček může nechat doporučený odhad, zkušený sportovec může vyjít z historie nebo cíle celého HYROXu." : "Zvol doporučený odhad, svůj předchozí výkon nebo vlastní cílový čas workoutu."}</p></div><span className="ui-chip shrink-0">{formatTarget(selectedPacingTargetSeconds)}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button type="button" onClick={() => setPacingSource("auto")} className={pacingSource === "auto" ? "ui-button ui-button-primary ui-button-sm" : "ui-button ui-button-outline ui-button-sm"}>Doporučený cíl</button>
                {previousResult && <button type="button" onClick={() => setPacingSource("history")} className={pacingSource === "history" ? "ui-button ui-button-primary ui-button-sm" : "ui-button ui-button-outline ui-button-sm"}>Z historie</button>}
                <button type="button" onClick={() => setPacingSource("custom")} className={pacingSource === "custom" ? "ui-button ui-button-primary ui-button-sm" : "ui-button ui-button-outline ui-button-sm"}>{isRaceSimulation ? "Cíl závodu" : "Vlastní cíl"}</button>
              </div>
              {pacingSource === "auto" && <p className="mt-3 text-xs leading-5 text-zinc-500">Cíl vychází z typu aktivit, vzdáleností/opakování a rozdílné náročnosti jednotlivých částí.</p>}
              {pacingSource === "history" && previousResult && <p className="mt-3 text-xs leading-5 text-zinc-500">Používám nejlepší uložený čas tohoto workoutu: <b className="text-zinc-300">{formatTarget(previousResult.durationSeconds)}</b>.</p>}
              {pacingSource === "custom" && <div className="mt-3"><input value={customPacingTarget} onChange={(event) => setCustomPacingTarget(event.target.value)} placeholder={isRaceSimulation ? "např. 1:30:00 · cíl celého HYROXu" : "např. 36:00 · cíl workoutu"} inputMode="numeric" className="ui-field" /><p className={customPacingTarget && !customInputSeconds ? "mt-2 text-xs text-amber-300" : "mt-2 text-xs text-zinc-500"}>{customPacingTarget && !customInputSeconds ? "Čas zadej jako minuty, mm:ss nebo h:mm:ss." : isRaceSimulation && customInputSeconds ? `Cíl celého HYROXu ${formatTarget(customInputSeconds)} → cíl této simulace ${formatTarget(customWorkoutTargetSeconds)}.` : "Enginn z cílového času dopočítá rozdílné cíle jednotlivých částí workoutu."}</p></div>}
            </section>}

            {selectedTemplate && format === "relay" && (
              <div className="mt-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Počet lidí</p>
                <div className="mt-3 grid grid-cols-3 gap-2">{[2, 3, 4].map((count) => <button key={count} type="button" onClick={() => setParticipantLimit(count)} className={participantLimit === count ? "ui-button ui-button-primary" : "ui-button ui-button-outline"}>{count}</button>)}</div>
              </div>
            )}

            {selectedTemplate && <>
              <label className="mt-5 block text-xs font-black uppercase tracking-[0.18em] text-zinc-500" htmlFor="team-schedule">Kdy? <span className="normal-case tracking-normal text-zinc-600">(volitelné · pro remote)</span></label>
              <input id="team-schedule" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="ui-field mt-3" />

              <button type="button" disabled={busy || !ready || !selectedPacingTargetSeconds} onClick={() => void createSession()} className="ui-button ui-button-primary mt-5 w-full">{busy ? "Vytvářím…" : `Vytvořit ${FORMAT_LABELS[format].title} session`}</button>
            </>}
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

      {user && workoutPickerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="workout-picker-title">
          <div className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-md grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Vybrat workout</p><h2 id="workout-picker-title" className="mt-0.5 text-lg font-black">{pickerTemplate?.title ?? "Načítám workouty…"}</h2></div>
              <div className="flex shrink-0 items-center gap-2">{templates.length > 0 && <span className="ui-chip">{safePickerIndex + 1}/{templates.length}</span>}<button type="button" onClick={() => setWorkoutPickerOpen(false)} className="ui-button ui-button-ghost ui-button-sm" aria-label="Zavřít výběr workoutu">×</button></div>
            </header>

            <div className="min-h-0 overflow-hidden px-4 py-3">
              {pickerTemplate ? <div
                className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)]"
                onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
                onTouchEnd={(event) => {
                  const start = touchStartX.current;
                  const end = event.changedTouches[0]?.clientX;
                  touchStartX.current = null;
                  if (start === null || end === undefined || Math.abs(start - end) < 45) return;
                  moveCarousel(start > end ? 1 : -1);
                }}
              >
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="max-h-10 overflow-hidden text-sm leading-5 text-zinc-400">{pickerTemplate.description}</p>{pickerTemplate.metadata?.goal && <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-zinc-500"><b className="text-zinc-300">Cíl:</b> {pickerTemplate.metadata.goal}</p>}</div><div className="shrink-0 text-right"><span className="ui-chip">{pickerTemplate.durationMinutes} min</span><p className="mt-1 text-[10px] text-zinc-600">měřená část ~ {formatTarget(pickerTargetSeconds)}</p></div></div>
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Bloky a cviky</p>
                <div className="mt-2 min-h-0 overflow-y-auto overscroll-contain pr-1">
                  <div className="space-y-1.5">{pickerTemplate.blocks.map((block, index) => <div key={block.id} className="ui-inset grid grid-cols-[auto_1fr] gap-2 px-3 py-2"><span className="ui-chip h-fit shrink-0">{index + 1}</span><div className="min-w-0"><p className="text-sm font-black leading-5">{phaseLabel(block.title)}</p><p className="max-h-10 overflow-hidden text-[11px] leading-5 text-zinc-500">{block.steps.map((step) => step.name).join(" · ")}</p></div></div>)}</div>
                </div>
              </div> : <div className="grid h-full place-items-center text-sm text-zinc-500">Načítám knihovnu workoutů…</div>}
            </div>

            <footer className="border-t border-zinc-800 px-4 py-3">
              {templates.length > 1 && <div className="flex items-center gap-3"><button type="button" aria-label="Předchozí workout" onClick={() => moveCarousel(-1)} className="ui-button ui-button-outline ui-button-sm shrink-0">←</button><div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden">{dotIndexes[0] > 0 && <span className="text-xs text-zinc-600">…</span>}{dotIndexes.map((index) => <button key={templates[index].id} type="button" aria-label={`Workout ${index + 1}`} onClick={() => setPickerIndex(index)} className={index === safePickerIndex ? "h-2.5 w-2.5 shrink-0 rounded-full bg-accent" : "h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-700"} />)}{dotIndexes[dotIndexes.length - 1] < templates.length - 1 && <span className="text-xs text-zinc-600">…</span>}</div><button type="button" aria-label="Další workout" onClick={() => moveCarousel(1)} className="ui-button ui-button-outline ui-button-sm shrink-0">→</button></div>}
              <button type="button" disabled={!pickerTemplate} onClick={confirmWorkout} className="ui-button ui-button-primary mt-3 w-full">Vybrat tento workout</button>
            </footer>
          </div>
        </div>
      )}
    </PlanningShell>
  );
}
