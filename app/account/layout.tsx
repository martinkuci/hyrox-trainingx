import type { ReactNode } from "react";
import { StickyBottomNavigation } from "@/components/navigation/StickyBottomNavigation";
import { StickyHeader } from "@/components/navigation/StickyHeader";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StickyHeader title="Účet" fallbackHref="/" />
      <div className="pb-24 pt-20">{children}</div>
      <StickyBottomNavigation />
    </>
  );
}
