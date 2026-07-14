"use client";

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
        className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-white shadow-2xl"
        role="dialog"
      >
        <h2 id="confirm-dialog-title" className="text-2xl font-bold">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mt-3 leading-6 text-zinc-400">
          {description}
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-zinc-700 px-4 py-3.5 font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-2xl px-4 py-3.5 font-bold transition ${
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

