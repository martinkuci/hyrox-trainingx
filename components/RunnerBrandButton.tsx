type Props = {
  onClick: () => void;
};

export default function RunnerBrandButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-11 min-w-20 place-items-center rounded-xl px-3 text-xs font-black tracking-[0.2em] text-accent transition active:bg-accent-soft"
      aria-label="Minimalizovat trénink"
      title="Minimalizovat trénink"
    >
      HYROX
    </button>
  );
}
