"use client";

import { type ChangeEvent, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useHyroxData } from "@/hooks/useHyroxData";
import {
  assertBackupFileSize,
  backupFileName,
  parseHyroxBackupText,
  serializeHyroxBackup,
  type BackupSummary,
  type ParsedHyroxBackup,
} from "@/lib/data-backup";
import { saveHyroxData } from "@/lib/storage";
import { loadWorkoutCheckpoint } from "@/lib/workout-checkpoint";

const summaryLabels: Array<{ key: keyof BackupSummary; label: string }> = [
  { key: "templates", label: "tréninků" },
  { key: "scheduledWorkouts", label: "v kalendáři" },
  { key: "results", label: "výsledků" },
  { key: "weeklyPlans", label: "týdenních plánů" },
  { key: "trainingPrograms", label: "programů" },
];

function downloadBackup(contents: string, fileName: string) {
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function DataBackupCard() {
  const { data, ready } = useHyroxData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedHyroxBackup | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);

  function exportData() {
    if (!ready) return;
    downloadBackup(serializeHyroxBackup(data), backupFileName());
    setMessage({
      tone: "success",
      text: "Záloha byla vytvořena. Najdeš ji mezi staženými soubory.",
    });
  }

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setPreview(null);
    setSelectedFileName("");
    setMessage(null);
    if (!file) return;

    try {
      assertBackupFileSize(file.size);
      const parsed = parseHyroxBackupText(await file.text());
      setPreview(parsed);
      setSelectedFileName(file.name);
    } catch (reason) {
      setMessage({
        tone: "danger",
        text:
          reason instanceof Error
            ? reason.message
            : "Zálohu se nepodařilo bezpečně načíst.",
      });
    }
  }

  function requestRestore() {
    if (!preview) return;
    if (loadWorkoutCheckpoint()) {
      setMessage({
        tone: "danger",
        text: "Nejdřív dokonči nebo ukonči rozpracovaný trénink. Potom můžeš data obnovit.",
      });
      return;
    }
    setConfirmOpen(true);
  }

  function restoreData() {
    setConfirmOpen(false);
    if (!preview) return;
    const restored = saveHyroxData(preview.backup.data);
    if (!restored) {
      setMessage({
        tone: "danger",
        text: "Data se nepodařilo uložit. Aktuální obsah aplikace zůstal beze změny.",
      });
      return;
    }
    setPreview(null);
    setSelectedFileName("");
    setMessage({
      tone: "success",
      text: "Záloha byla obnovena. Tréninky, plán i výsledky jsou znovu načtené.",
    });
  }

  const formattedDate =
    preview && !preview.legacy
      ? new Intl.DateTimeFormat("cs-CZ", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(preview.backup.exportedAt))
      : null;

  return (
    <>
      <section className="ui-card mt-6 p-5 sm:p-6" aria-labelledby="data-backup-title">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Data v zařízení</p>
            <h2 id="data-backup-title" className="mt-1 text-xl font-black">Záloha a obnova</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Stáhni všechny tréninky, plán a výsledky do jednoho JSON souboru. Přihlášení ani obrázky se neexportují.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={exportData}
          disabled={!ready}
          className="ui-button ui-button-primary mt-5 w-full"
        >
          {ready ? "Stáhnout zálohu" : "Načítám data…"}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-zinc-600" aria-hidden="true">
          <span className="h-px flex-1 bg-[var(--line)]" />
          Obnova
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          onChange={selectBackup}
          className="sr-only"
          aria-label="Vybrat soubor se zálohou"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="ui-button ui-button-outline w-full"
        >
          Vybrat soubor se zálohou
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
          Nejvýše 5 MB. Výběr souboru aktuální data ještě nezmění.
        </p>

        {preview && (
          <div className="ui-inset mt-5 p-4">
            <p className="break-words text-sm font-black text-zinc-100">{selectedFileName}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {formattedDate ? `Vytvořeno ${formattedDate}` : "Starší podporovaný formát bez data vytvoření"}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              {summaryLabels.map(({ key, label }) => (
                <div key={key} className="rounded-xl bg-black/15 px-3 py-2 last:col-span-2">
                  <dt className="text-[11px] leading-4 text-zinc-500">{label}</dt>
                  <dd className="mt-0.5 text-lg font-black text-white">{preview.summary[key]}</dd>
                </div>
              ))}
            </dl>
            <div className="ui-feedback ui-feedback-warning mt-4">
              <p className="text-sm font-black">Obnova nahradí současná data</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">Pokud je chceš zachovat, nejdřív si nahoře stáhni jejich zálohu.</p>
            </div>
            <button
              type="button"
              onClick={requestRestore}
              className="ui-button ui-button-danger mt-4 w-full"
            >
              Obnovit tuto zálohu
            </button>
          </div>
        )}

        {message && (
          <div
            className={`ui-feedback mt-5 ${message.tone === "success" ? "ui-feedback-success" : "ui-feedback-danger"}`}
            role={message.tone === "danger" ? "alert" : "status"}
            aria-live="polite"
          >
            <p className="text-sm font-bold leading-6">{message.text}</p>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Nahradit všechna data?"
        description="Současné tréninky, kalendář, programy a výsledky budou nahrazeny obsahem vybrané zálohy. Tuto akci nelze vrátit bez vlastní zálohy."
        confirmLabel="Ano, obnovit"
        destructive
        onConfirm={restoreData}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
