"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const hiddenRoutes = new Set(["/", "/login"]);

export function RouteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const showChrome = !hiddenRoutes.has(pathname);

  if (!showChrome) return <>{children}</>;

  return (
    <div