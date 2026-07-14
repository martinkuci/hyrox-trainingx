export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-md">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-lime-400">
            HYROX Training
          </p>
          <h1 className="mt-2 text-4xl font-bold">Dnešní trénink</h1>
          <p className="mt-2 text-zinc-400">Úterý · přibližně 45 minut</p>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-lime-400">HYROX 02</p>
              <h2 className="mt-1 text-2xl font-bold">Běh + stanoviště</h2>
            </div>

            <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
              45 min
            </span>
          </div>

          <div className="mt-6 space-y-3">
            <WorkoutPart time="8 min" name="Warm-up" />
            <WorkoutPart time="28 min" name="3 kola For Time" />
            <WorkoutPart time="6 min" name="EMOM" />
            <WorkoutPart time="3 min" name="Cooldown" />
          </div>

          <button className="mt-8 w-full rounded-2xl bg-lime-400 px-5 py-4 text-lg font-bold text-zinc-950">
            Spustit trénink
          </button>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4">
          <button className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left">
            <span className="text-2xl">📅</span>
            <span className="mt-3 block font-semibold">Kalendář</span>
          </button>

          <button className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left">
            <span className="text-2xl">📊</span>
            <span className="mt-3 block font-semibold">Historie</span>
          </button>
        </section>
      </div>
    </main>
  );
}

function WorkoutPart({ time, name }: { time: string; name: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-zinc-800/70 px-4 py-3">
      <span className="font-medium">{name}</span>
      <span className="text-sm text-zinc-400">{time}</span>
    </div>
  );
}