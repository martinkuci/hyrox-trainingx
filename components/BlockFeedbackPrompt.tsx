import RunnerBrandButton from "@/components/RunnerBrandButton";
import { BLOCK_FEEDBACK_OPTIONS } from "@/lib/block-feedback";
import type { BlockFeedbackRating } from "@/lib/types";

type Props = {
  blockTitle: string;
  finishesWorkout: boolean;
  totalTime: string;
  onMinimize: () => void;
  onRate: (rating: BlockFeedbackRating) => void;
  onSkip: () => void;
};

export default function BlockFeedbackPrompt({
  blockTitle,
  finishesWorkout,
  totalTime,
  onMinimize,
  onRate,
  onSkip,
}: Props) {
  return (
    <main className="runner-shell safe-screen min-h-dvh px-4 text-white">
      <section className="mx-auto w-full max-w-md">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center">
          <span />
          <RunnerBrandButton onClick={onMinimize} />
          <span className="justify-self-end font-mono text-sm text-zinc-400">{totalTime}</span>
        </header>
        <div className="mt-5 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Blok dokončen</p>
          <h1 className="mt-2 text-3xl font-black">{blockTitle}</h1>
          <p className="mt-2 text-sm text-zinc-400">Jak ti nastavení bloku sedlo?</p>
        </div>
        <div className="mt-5 grid gap-2">
          {BLOCK_FEEDBACK_OPTIONS.map((option) => (
            <button
              key={option.rating}
              type="button"
              onClick={() => onRate(option.rating)}
              className="ui-inset flex min-h-14 items-center gap-3 px-4 py-3 text-left transition active:border-accent/40 active:bg-accent-soft"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft font-black text-accent">{option.rating}</span>
              <span className="min-w-0"><span className="block font-black text-white">{option.title}</span><span className="mt-0.5 block text-xs text-zinc-500">{option.description}</span></span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onSkip} className="ui-button ui-button-ghost mt-3 w-full">
          {finishesWorkout ? "Přeskočit a zobrazit souhrn" : "Přeskočit hodnocení"}
        </button>
      </section>
    </main>
  );
}
