import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function StickyActionBar({ children, className = "" }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 border-t border-white/8 bg-[#0a0b0d]/94 p-4 shadow-[0_-12px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className={"mx-auto flex max-w-2xl gap-3 " + className}>
        {children}
      </div>
    </div>
  );
}
