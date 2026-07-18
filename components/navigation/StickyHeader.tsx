"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type StickyHeaderProps = {
  title?: string;
  fallbackHref?: string;
};

export function StickyHeader({ title, fallbackHref = "/" }: StickyHeaderProps) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 px-4 pb-3 pt-4 backdrop-blur-xl sm:px-6