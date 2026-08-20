"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useHyroxData } from "@/hooks/useHyroxData";
import { parseHealthActivities } from "@/lib/health-data";
import {
  AUTH_EVENT,
  getValidCloudUser,
  loadCloudUser,
  type CloudUser,
} from "@/lib/firebase-rest";


type StravaStatus = {
  configured: boolean;
  connected: boolean;
  athleteName?: string;
  scopes?: string[];
  expiresAt?: number;
};

type Feedback = {
  tone: "success" | "warning" | "danger";
  text: string;
};

function callbackFeedback(value: string | null): Feedback | null {
  switch (value) {
    case "connected":
      return { tone: "success", text: "Strava je připojená. Načti poslední aktivity do Enginnu." };
    case "denied":
      return { tone: "warning", text: "Připojení Stravy bylo zrušeno bez změny dat." };
    case "missing-scope":
      return { tone: "danger", text: "Strava nedostala potřebné oprávnění ke čtení aktivit. Připoj ji znovu a povol přístup k aktivitám." };
    case "invalid-state":
      return { tone: "danger", text: "Připojení Stravy vypršelo nebo se nepodařilo bezpečně ověřit. Spusť připojení znovu." };
    case "not-configured":
      return { tone: "warning", text: "Strava zatím není na serveru Enginn nakonfigurovaná." };
    case "exchange-failed":
    case "oauth-error":
      return { tone: "danger", text: "Připojení Stravy se nepodařilo dokončit. Zkus to znovu později." };
    default:
      return null;
  }
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function HealthPageContent() {
  const searchParams = useSearchParams();
  const { data, ready, mergeHealthActivities } = useHyroxData();
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const callbackNotice = callbackFeedback(searchParams.get("strava"));

  const stravaActivities = (data.healthData?.activities ?? [])
    .filter((activity) => activity.provider === "strava")
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  const lastSyncedAt = data.healthData?.lastSyncedAt?.strava;

  useEffect(() => {
    const refresh = () => setUser(loadCloudUser());
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    return () => window.removeEventListener(AUTH_EVENT, refresh);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      const cloudUser = await getValidCloudUser();
      if (!active) return;
      setUser(cloudUser);
      if (!cloudUser) {
        setStatus(null);
        setStatusLoading(false);
        return;
      }

      setStatusLoading(true);
      try {
        const response = await fetch("/api/strava/status", {
          headers: { Authorization: `Bearer ${cloudUser.idToken}` },
          cache: "no-store",
        });
        const body = await response.json() as StravaStatus & { error?: string };
        if (!active) return;
        if (!response.ok) throw new Error(body.error || "Stav Stravy se nepodařilo načíst.");
        setStatus(body);
      } catch (reason) {
        if (!active) return;
        setStatus(null);
        setFeedback({
          tone: "danger",
          text: reason instanceof Error ? reason.message : "Stav Stravy se nepodařilo načíst.",
        });
      } finally {
        if (active) setStatusLoading(false);
      }
    }

    void loadStatus();
    return () => { active = false; };
  }, [searchParams]);

  async function authenticatedUser() {
    const cloudUser = await getValidCloudUser();
    setUser(cloudUser);
    if (!cloudUser) throw new Error("Pro Stravu se nejdřív přihlas ke cloudovému účtu Enginn.");
    return cloudUser;
  }

  async function connectStrava() {
    setBusyAction("connect");
    setFeedback(null);
    try {
      const cloudUser = await authenticatedUser();
      const response = await fetch("/api/strava/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${cloudUser.idToken}` },
      });
      const body = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Stravu se nepodařilo připojit.");
      if (!body.authorizationUrl) throw new Error("Server nevrátil bezpečný odkaz pro Stravu.");

      const authorizationUrl = new URL(body.authorizationUrl);
      if (authorizationUrl.origin !== "https://www.strava.com") {
        throw new Error("Server vrátil neplatný odkaz pro Stravu.");
      }
      window.location.assign(authorizationUrl.toString());
    } catch (reason) {
      setFeedback({
        tone: "danger",
        text: reason instanceof Error ? reason.message : "Stravu se nepodařilo připojit.",
      });
      setBusyAction(null);
    }
  }

  async function syncStrava() {
    setBusyAction("sync");
    setFeedback(null);
    try {
      const cloudUser = await authenticatedUser();
      const response = await fetch("/api/strava/activities", {
        headers: { Authorization: `Bearer ${cloudUser.idToken}` },
        cache: "no-store",
      });
      const body = await response.json() as {
        activities?: unknown;
        importedAt?: string;
        athleteName?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Aktivity ze Stravy se nepodařilo načíst.");

      const activities = parseHealthActivities(body.activities, "strava");
      const importedAt = typeof body.importedAt === "string" && !Number.isNaN(Date.parse(body.importedAt))
        ? body.importedAt
        : new Date().toISOString();
      mergeHealthActivities("strava", activities, importedAt);
      setStatus((current) => current ? { ...current, connected: true, athleteName: body.athleteName ?? current.athleteName } : current);
      setFeedback({
        tone: "success",
        text: `Synchronizováno ${activities.length} posledních aktivit ze Stravy.`,
      });
    } catch (reason) {
      setFeedback({
        tone: "danger",
        text: reason instanceof Error ? reason.message : "Aktivity ze Stravy se nepodařilo načíst.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function disconnectStrava() {
    setBusyAction("disconnect");
    setFeedback(null);
    try {
      const cloudUser = await authenticatedUser();
      const response = await fetch("/api/strava/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${cloudUser.idToken}` },
      });
      const body = await response.json() as { disconnected?: boolean; error?: string };
      if (!response.ok || !body.disconnected) {
        throw new Error(body.error || "Stravu se nepodařilo odpojit.");
      }
      setStatus((current) => current ? { ...current, connected: false, athleteName: undefined, scopes: undefined } : current);
      setFeedback({
        tone: "success",
        text: "Strava byla odpojena. Už importované aktivity v Enginnu zůstaly zachované.",
      });
    } catch (reason) {
      setFeedback({
        tone: "danger",
        text: reason instanceof Error ? reason.message : "Stravu se nepodařilo odpojit.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <PlanningShell
      eyebrow="Profil"
      title="Health & Activity"
      description="Připoj externí zdroje pohybu a fyziologických dat. Enginn ukládá jen importované metriky; přístupové tokeny Stravy zůstávají mimo lokální tréninková data a zálohy."
      backHref="/account"
    >
      <div className="space-y-5">
        {(callbackNotice || feedback) && (
          <div className={`ui-feedback ui-feedback-${(feedback ?? callbackNotice)?.tone}`} role="status">
            <p className="text-sm font-bold leading-6">{(feedback ?? callbackNotice)?.text}</p>
          </div>
        )}

        <section className="ui-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">První zdroj · 3D.1</p>
              <h2 className="mt-2 text-2xl font-black">Strava</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Načítá poslední sportovní aktivity, délku, vzdálenost a dostupné metriky jako průměrný nebo maximální tep.
              </p>
            </div>
            <span className={`ui-chip shrink-0 ${status?.connected ? "ui-chip-success" : ""}`}>
              {statusLoading ? "Kontroluji" : status?.connected ? "Připojeno" : "Nepřipojeno"}
            </span>
          </div>

          {!user ? (
            <div className="ui-feedback ui-feedback-warning mt-5">
              <p className="font-black">Nejdřív se přihlas do Enginnu</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Strava je navázaná na tvůj cloudový účet, aby se nemohla omylem připojit k jinému profilu.
              </p>
              <Link href="/account" className="ui-button ui-button-primary mt-4 w-full">Přejít na přihlášení</Link>
            </div>
          ) : statusLoading ? (
            <div className="ui-inset mt-5 h-24 animate-pulse" aria-label="Kontroluji Strava připojení" />
          ) : status && !status.configured ? (
            <div className="ui-feedback ui-feedback-warning mt-5">
              <p className="font-black">Strava ještě není nakonfigurovaná na serveru</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Uživatelská část je připravená. Pro skutečné připojení zbývá doplnit Strava Client ID a Client Secret do serverového prostředí.
              </p>
            </div>
          ) : status?.connected ? (
            <div className="mt-5">
              <div className="ui-inset p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Připojený sportovec</p>
                <p className="mt-1 font-black text-zinc-100">{status.athleteName || "Strava účet"}</p>
                {lastSyncedAt && (
                  <p className="mt-1 text-xs text-zinc-500">Poslední import: {formatDate(lastSyncedAt)}</p>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={syncStrava}
                  disabled={busyAction !== null}
                  className="ui-button ui-button-primary w-full"
                >
                  {busyAction === "sync" ? "Synchronizuji…" : "Načíst poslední aktivity"}
                </button>
                <button
                  type="button"
                  onClick={disconnectStrava}
                  disabled={busyAction !== null}
                  className="ui-button ui-button-outline w-full"
                >
                  {busyAction === "disconnect" ? "Odpojuji…" : "Odpojit Stravu"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectStrava}
              disabled={busyAction !== null}
              className="ui-button ui-button-primary ui-button-lg mt-5 w-full"
            >
              {busyAction === "connect" ? "Otevírám Stravu…" : "Připojit Stravu"}
            </button>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <FutureProviderCard
            title="Apple Health"
            description="Tep, HRV, spánek a workouty přes nativní HealthKit po převodu Enginnu do iOS aplikace."
          />
          <FutureProviderCard
            title="Health Connect"
            description="Android zdroje pohybu, tepových a recovery dat přes společnou Health vrstvu."
          />
        </section>

        <section className="ui-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Importované aktivity</p>
              <h2 className="mt-2 text-xl font-black">Poslední data ze Stravy</h2>
            </div>
            <span className="ui-chip">{stravaActivities.length}</span>
          </div>

          {!ready ? (
            <div className="ui-inset mt-5 h-28 animate-pulse" />
          ) : stravaActivities.length === 0 ? (
            <div className="ui-inset mt-5 p-5 text-sm leading-6 text-zinc-400">
              Zatím tu nejsou žádné Strava aktivity. Po připojení použij „Načíst poslední aktivity“.
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {stravaActivities.slice(0, 10).map((activity) => (
                <article key={activity.id} className="ui-inset p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-zinc-100">{activity.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">{activity.sportType} · {formatDate(activity.startedAt)}</p>
                    </div>
                    <span className="ui-chip shrink-0">{formatDuration(activity.durationSeconds)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activity.distanceKm !== undefined && <span className="ui-chip">{activity.distanceKm.toFixed(2)} km</span>}
                    {activity.averageHeartRate !== undefined && <span className="ui-chip">Ø {activity.averageHeartRate} bpm</span>}
                    {activity.maxHeartRate !== undefined && <span className="ui-chip">Max {activity.maxHeartRate} bpm</span>}
                    {activity.averageWatts !== undefined && <span className="ui-chip">Ø {Math.round(activity.averageWatts)} W</span>}
                    {activity.calories !== undefined && <span className="ui-chip">{activity.calories} kcal</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="px-1 text-xs leading-5 text-zinc-600">
          Strava přístupové a refresh tokeny nejsou součástí lokální zálohy ani tréninkového JSONu. Do Enginnu se ukládají pouze importované aktivity a metriky potřebné pro budoucí tréninkové vyhodnocení.
        </p>
      </div>
    </PlanningShell>
  );
}

function FutureProviderCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="ui-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-black">{title}</h2>
        <span className="ui-chip">Další krok</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
    </article>
  );
}

export default function HealthPage() {
  return (
    <Suspense fallback={<div className="app-shell min-h-screen bg-black" />}>
      <HealthPageContent />
    </Suspense>
  );
}
