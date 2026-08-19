import { EnginnWordmark } from "@/components/EnginnBrand";

type Props = {
  onClick: () => void;
};

export default function RunnerBrandButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-11 min-w-24 place-items-center rounded-xl px-3 transition active:bg-accent-soft"
      aria-label="Minimalizovat trénink"
      title="Minimalizovat trénink"
    >
      <EnginnWordmark className="h-[1.05rem] w-auto" />
    </button>
  );
}
