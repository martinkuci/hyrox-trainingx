"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

const headerClass = [
  "fixed",
  "inset-x-0",
  "top-0",
  "z-50",
  "border-b",
  "border-zinc-800",
  "bg-zinc-950/95",
  "px-4",
  "pb-3",
  "pt-3",
  "backdrop-blur-xl",
  "sm:px-6",
].join(" ");

type StickyHeaderProps = {
  title?: string;
  fallbackHref?: string;
  onBack?: () =>