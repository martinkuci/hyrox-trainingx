"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import {
  AUTH_EVENT,
  createEmailAccount,
  loadCloudUser,
  signInWithEmail,
  signOutCloud,
} from "@/lib/firebase-rest";
import type { CloudUser } from "@/lib/firebase-rest";

export default function AccountPage() {
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
            <div className="ui-feedback ui-feedback-success mt-6">
              <p className="font-black text-accent">Synchronizace je aktivní</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Tréninky, kalendář, výsledky a týdenní plány se ukládají do tvého účtu. Po přihlášení stejným e-mailem na telefonu a počítači uvidíš stejná data.
              </p>
            </div>
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
      </div>
    </PlanningShell>
  );
}
