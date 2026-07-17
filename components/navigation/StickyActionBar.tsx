import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function StickyActionBar({ children, className = "" }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-zinc-950 p-4">
      <div className={"mx-auto flex max-w-2xl gap-3 " + className}>
        {children}
      </div>
    </div>
  );
}
