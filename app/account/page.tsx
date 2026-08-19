"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import DataBackupCard from "@/components/DataBackupCard";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { useCloudSyncState } from "@/hooks/useCloudSyncState";
import { requestCloudSync } from "@/lib/cloud-sync-state";
import {
  AUTH_EVENT,
  createEmailAccount,
  loadCloudUser,
  signInWithEmail,
  signOutCloud,
} from "@/lib/firebase-rest";
import type { CloudUser } from "@/lib/firebase-rest";

export default function AccountPage() {
  const syncState = useCloudSyncState();
  const [user, setUser] = useState<CloudUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => setUser(loadCloudUser());
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    return () => window.removeEventListener(AUTH_EVENT, refresh);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await signInWithEmail(email, password);
      else await createEmailAccount(email, password);
      setUser(loadCloudUser());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Přihlášení selhalo.");
    } finally {
      setBusy(false);
    }
  }

  const syncPresentation = {
    local: {
      title: "Kontroluji cloud",
      description: "Ověřuji stav přihlášení a poslední uloženou verzi.",
      tone: "",
    },
    offline: {
      title: syncState.pending ? "Změny čekají v zařízení" : "Jsi offline",
      description: syncState.pending
        ? "Data jsou bezpečně uložená v tomto zařízení a odešlou se automaticky po návratu internetu."
        : "Aplikaci můžeš dál používat. Nové změny zůstanou v zařízení do návratu internetu.",
      tone: "ui-feedback-warning",
    },
    pending: {
      title: "Změny čekají na odeslání",
      description: "Lokální kopie je uložená. Cloudová synchronizace se spustí během okamžiku.",
      tone: "ui-feedback-warning",
    },
    syncing: {
      title: "Synchronizuji…",
      description: "Odesílám nejnovější lokální data do tvého účtu.",
      tone: "",
    },
    synced: {
      title: "Všechna data jsou uložená",
      description: syncState.lastSyncedAt
        ? `Poslední synchronizace ${new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "short" }).format(new Date(syncState.lastSyncedAt))}.`
        : "Tréninky, plán a výsledky jsou synchronizované s cloudem.",
      tone: "ui-feedback-success",
    },
    error: {
      title: "Synchronizace vyžaduje pozornost",
      description: syncState.error ?? "Data zůstala bezpečně v zařízení. Zkus synchronizaci zopakovat.",
      tone: "ui-feedback-danger",
    },
  }[syncState.phase];

  return (
    <PlanningShell
      eyebrow="Profil"
      title="Účet a cloud"
      description="Spravuj přihlášení a bezpečnou synchronizaci tréninkových dat mezi zařízeními."
      backHref="/"
    >
      <div className="mx-auto max-w-md">
        {user ? (
          <section className="ui-card p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m7 12 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <p className="font-black">Přihlášeno</p>
                <p className="text-sm text-zinc-400">{user.email}</p>
              </div>
            </div>
            <div className={`ui-feedback mt-6 ${syncPresentation.tone}`} aria-live="polite">
              <p className="font-black">{syncPresentation.title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {syncPresentation.description}
              </p>
            </div>
            {syncState.phase === "error" && (
              <button
                type="button"
                onClick={requestCloudSync}
                className="ui-button ui-button-accent mt-4 w-full"
              >
                Zkusit synchronizaci znovu
              </button>
            )}
            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Tréninky, kalendář, výsledky a týdenní plány se nejdřív ukládají do tohoto zařízení. Cloud je následně bezpečně synchronizuje mezi přihlášenými zařízeními.
            </p>
            <button
              type="button"
              onClick={() => { signOutCloud(); setUser(null); }}
              className="ui-button ui-button-outline mt-6 w-full"
            >
              Odhlásit se
            </button>
          </section>
        ) : (
          <section className="ui-card p-6">
            <div className="ui-feedback mb-6">
              <p className="font-black">Data jsou pouze v tomto zařízení</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Tréninky můžeš používat i bez účtu. Pro zálohu a přenos mezi telefonem a počítačem se přihlas ke cloudu.
              </p>
            </div>
            <div className="ui-segmented grid grid-cols-2">
              <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")} className="ui-choice px-3 py-3">Přihlášení</button>
              <button type="button" aria-pressed={mode === "register"} onClick={() => setMode("register")} className="ui-choice px-3 py-3">Nový účet</button>
            </div>

            <form onSubmit={submit} className="mt-6">
              <label className="block text-sm font-bold" htmlFor="email">E-mail</label>
              <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="ui-field mt-2" />

              <label className="mt-5 block text-sm font-bold" htmlFor="password">Heslo</label>
              <input id="password" type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} className="ui-field mt-2" />

              {error && <p role="alert" className="ui-feedback ui-feedback-danger mt-4 text-sm">{error}</p>}

              <button disabled={busy} className="ui-button ui-button-primary ui-button-lg mt-6 w-full">
                {busy ? "Pracuji…" : mode === "login" ? "Přihlásit se" : "Vytvořit účet"}
              </button>
            </form>

            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Při prvním přihlášení se současná data z tohoto zařízení nahrají do cloudu, pokud je účet ještě prázdný.
            </p>
          </section>
        )}
        <section className="ui-card mt-6 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Trénování</p>
          <h2 className="mt-2 text-xl font-black">Moje tréninková místa</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Upravuj fitka a další místa, kam chodíš cvičit, včetně dostupného vybavení.
          </p>
          <Link href="/account/locations" className="ui-button ui-button-outline mt-5 w-full">
            Spravovat tréninková místa
          </Link>
        </section>
        <section className="ui-card mt-6 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Podpora</p>
          <h2 className="mt-2 text-xl font-black">Nápověda a kontakt</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Najdi odpovědi, obnov heslo, pošli technický dotaz nebo navrhni vylepšení aplikace.
          </p>
          <Link href="/help" className="ui-button ui-button-outline mt-5 w-full">
            Otevřít centrum nápovědy
          </Link>
        </section>
        <DataBackupCard />
      </div>
    </PlanningShell>
  );
}
