"use client";

import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Potvrdit",
  cancelLabel = "Zrušit",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    initialFocusRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        aria-describedby="confirm-dialog-description"
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-[1.75rem] border border-white/10 bg-[#15181b] p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.5)]"
        role="dialog"
      >
        <div className={`mb-5 grid size-11 place-items-center rounded-2xl ${destructive ? "bg-red-400/10 text-red-300" : "bg-accent-soft text-accent"}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 8v5M12 17h.01" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h2 id="confirm-dialog-title" className="text-2xl font-black tracking-tight">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mt-3 leading-6 text-zinc-400">
          {description}
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            ref={initialFocusRef}
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-2xl border border-white/12 px-4 py-3.5 font-bold text-zinc-200 hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-12 rounded-2xl px-4 py-3.5 font-black ${
              destructive
                ? "bg-red-500 text-white hover:bg-red-400"
                : "bg-lime-400 text-zinc-950 hover:bg-lime-300"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

