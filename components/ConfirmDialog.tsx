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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    initialFocusRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/75 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        aria-describedby="confirm-dialog-description"
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="ui-card my-auto w-full max-w-sm p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.5)] sm:p-6"
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
            className="ui-button ui-button-outline"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`ui-button ${destructive ? "ui-button-danger-solid" : "ui-button-primary"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

