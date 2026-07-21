import type { ReactNode } from "react";
import { StickyBottomNavigation } from "@/components/navigation/StickyBottomNavigation";
import { StickyHeader } from "@/components/navigation/StickyHeader";

export default function HistoryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StickyHeader title="Historie" fallbackHref="/" />
      <div className="route-layout-safe">{children}</div>
      <StickyBottomNavigation />
    </>
  );
}
