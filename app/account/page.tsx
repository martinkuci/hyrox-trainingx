"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import HelpCenter from "@/components/account/HelpCenter";
import {
  AUTH_EVENT,
  createEmailAccount,
  loadCloudUser,
  sendPasswordResetEmail,
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
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
    setNotice("");
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

  async function requestPasswordReset(targetEmail: string) {
    setResetBusy(true);
    setError("");
    setNotice("");
    try {
      await sendPasswordResetEmail(targetEmail);
      setNotice(
        "Pokud k tomuto e-mailu účet existuje, dorazí na něj odkaz pro nastavení nového hesla.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Obnova hesla se nepodařila.");
    } finally {
      setResetBusy(false);
    }
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  return (
    <main className="min-h-dvh bg-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-400">
          Účet
        </p>
        <h1 className="mt-2 text-4xl font-black">Cloud a pomoc</h1>
        <p className="mt-3 leading-6 text-zinc-400">
          Synchronizuj tréninky mezi zařízeními nebo pokračuj bez účtu pouze v tomto prohlížeči.
        </p>

        {user ? (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-full bg-lime-400 font-black text-zinc-950">
                ✓
              </div>
              <div className="min-w-0">
                <p className="font-bold">Přihlášeno</p>
                <p className="truncate text-sm text-zinc-400">{user.email}</p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl bg-zinc-800 p-4">
              <p className="font-bold text-lime-400">Cloudová synchronizace je aktivní</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Tréninky, kalendář, výsledky a programy se ukládají do tvého účtu. Po přihlášení stejným e-mailem na telefonu a počítači uvidíš stejná data.
              </p>
            </div>

            {error && (
              <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm leading-5 text-red-300" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="mt-4 rounded-2xl border border-lime-400/25 bg-lime-400/10 p-3 text-sm leading-5 text-lime-200" role="status">
                {notice}
              </p>
            )}

            <button
              type="button"
              disabled={resetBusy}
              onClick={() => void requestPasswordReset(user.email)}
              className="mt-6 min-h-12 w-full rounded-2xl border border-zinc-700 px-5 py-3 font-bold text-zinc-200 disabled:opacity-50 active:bg-zinc-800"
            >
              {resetBusy ? "Odesílám…" : "Poslat odkaz pro změnu hesla"}
            </button>
            <button
              type="button"
              onClick={() => {
                signOutCloud();
                setUser(null);
                setNotice("");
                setError("");
              }}
              className="mt-3 min-h-12 w-full rounded-2xl border border-zinc-700 px-5 py-3 font-bold text-zinc-400 active:bg-zinc-800"
            >
              Odhlásit se
            </button>
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="grid grid-cols-2 rounded-2xl bg-zinc-800 p-1">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`min-h-11 rounded-xl px-3 py-3 font-bold ${
                  mode === "login" ? "bg-zinc-700 text-white" : "text-zinc-400"
                }`}
              >
                Přihlášení
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`min-h-11 rounded-xl px-3 py-3 font-bold ${
                  mode === "register" ? "bg-zinc-700 text-white" : "text-zinc-400"
                }`}
              >
                Nový účet
              </button>
            </div>

            <form onSubmit={submit} className="mt-6">
              <label className="block text-sm font-bold" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base outline-none focus:border-lime-400"
              />

              <label className="mt-5 block text-sm font-bold" htmlFor="password">
                Heslo
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base outline-none focus:border-lime-400"
              />

              {mode === "login" && (
                <button
                  type="button"
                  disabled={resetBusy}
                  onClick={() => void requestPasswordReset(email)}
                  className="mt-3 min-h-11 px-1 text-sm font-bold text-lime-300 disabled:opacity-50"
                >
                  {resetBusy ? "Odesílám odkaz…" : "Zapomenuté heslo"}
                </button>
              )}

              {error && (
                <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm leading-5 text-red-300" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="mt-4 rounded-2xl border border-lime-400/25 bg-lime-400/10 p-3 text-sm leading-5 text-lime-200" role="status">
                  {notice}
                </p>
              )}

              <button
                disabled={busy}
                className="mt-6 min-h-12 w-full rounded-2xl bg-lime-400 px-5 py-3 text-lg font-black text-zinc-950 disabled:opacity-50 active:bg-lime-300"
              >
                {busy ? "Pracuji…" : mode === "login" ? "Přihlásit se" : "Vytvořit účet"}
              </button>
            </form>

            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Při prvním přihlášení se současná data z tohoto zařízení nahrají do cloudu, pokud je účet ještě prázdný.
            </p>
          </section>
        )}

        <HelpCenter
          key={user?.uid ?? "guest"}
          defaultContactEmail={user?.email}
        />
      </div>
    </main>
  );
}
