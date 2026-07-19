"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
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
    <main className="min-h-dvh bg-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-400">Cloud</p>
        <h1 className="mt-2 text-4xl font-black">Účet a synchronizace</h1>

        {user ? (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-full bg-lime-400 font-black text-zinc-950">✓</div>
              <div>
                <p className="font-bold">Přihlášeno</p>
                <p className="text-sm text-zinc-400">{user.email}</p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl bg-zinc-800 p-4">
              <p className="font-bold text-lime-400">Cloudová synchronizace je aktivní</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Tréninky, kalendář, výsledky a týdenní plány se ukládají do tvého účtu. Po přihlášení stejným e-mailem na telefonu a počítači uvidíš stejná data.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { signOutCloud(); setUser(null); }}
              className="mt-6 w-full rounded-2xl border border-zinc-700 px-5 py-4 font-bold text-zinc-200"
            >
              Odhlásit se
            </button>
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="grid grid-cols-2 rounded-2xl bg-zinc-800 p-1">
              <button type="button" onClick={() => setMode("login")} className={`rounded-xl px-3 py-3 font-bold ${mode === "login" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>Přihlášení</button>
              <button type="button" onClick={() => setMode("register")} className={`rounded-xl px-3 py-3 font-bold ${mode === "register" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>Nový účet</button>
            </div>

            <form onSubmit={submit} className="mt-6">
              <label className="block text-sm font-bold" htmlFor="email">E-mail</label>
              <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-4 outline-none focus:border-lime-400" />

              <label className="mt-5 block text-sm font-bold" htmlFor="password">Heslo</label>
              <input id="password" type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-4 outline-none focus:border-lime-400" />

              {error && <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

              <button disabled={busy} className="mt-6 w-full rounded-2xl bg-lime-400 px-5 py-4 text-lg font-black text-zinc-950 disabled:opacity-50">
                {busy ? "Pracuji…" : mode === "login" ? "Přihlásit se" : "Vytvořit účet"}
              </button>
            </form>

            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Při prvním přihlášení se současná data z tohoto zařízení nahrají do cloudu, pokud je účet ještě prázdný.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
