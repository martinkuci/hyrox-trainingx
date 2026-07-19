"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, useMemo, useState } from "react";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { getValidCloudUser } from "@/lib/firebase-rest";
import { extractResultFromOcr } from "@/lib/screenshot-ocr";
import { useHyroxData } from "@/hooks/useHyroxData";

type ExtractedResult = {
  workoutTitle: string;
  completedAt: string | null;
  durationSeconds: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  distanceKm: number | null;
  rpe: number | null;
  weights: string;
  notes: string;
  confidence: number;
  warnings: string[];
};

const MAX_FILE_SIZE = 6 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Soubor se nepodařilo načíst."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Obrázek se nepodařilo otevřít."));
    image.src = source;
  });
}

async function compressScreenshot(file: File) {
  const source = await readFile(file);
  const image = await loadImage(source);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, 1_800 / longestSide);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Obrázek se nepodařilo připravit.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let dataUrl = canvas.toDataURL("image/jpeg", 0.84);
  if (dataUrl.length > 3_800_000) dataUrl = canvas.toDataURL("image/jpeg", 0.66);
  if (dataUrl.length > 3_800_000) {
    throw new Error("Screenshot je i po zmenšení příliš velký. Zkus jej oříznout.");
  }
  return dataUrl;
}

function toDateTimeLocal(value: string | null) {
  const date = value ? new Date(value) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const offset = safe.getTimezoneOffset() * 60_000;
  return new Date(safe.getTime() - offset).toISOString().slice(0, 16);
}

function formatDurationInput(seconds: number | null) {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((value) => String(value).padStart(2, "0")).join(":");
}

function parseDuration(value: string) {
  const parts = value.trim().split(":").map(Number);
  if (
    (parts.length !== 2 && parts.length !== 3) ||
    parts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    return null;
  }
  const [hours, minutes, seconds] =
    parts.length === 3 ? parts : [0, parts[0], parts[1]];
  if (minutes > 59 || seconds > 59) return null;
  const total = hours * 3_600 + minutes * 60 + seconds;
  return total > 0 && total <= 86_400 ? total : null;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("cs-CZ").replace(/\s+/g, " ").trim();
}

export default function ScreenshotResultImportPage() {
  const router = useRouter();
  const { data, ready, addResult } = useHyroxData();
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [readingLocally, setReadingLocally] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [reviewReady, setReviewReady] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [workoutTitle, setWorkoutTitle] = useState("");
  const [completedAt, setCompletedAt] = useState(toDateTimeLocal(null));
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState("7");
  const [averageHeartRate, setAverageHeartRate] = useState("");
  const [maxHeartRate, setMaxHeartRate] = useState("");
  const [calories, setCalories] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [weights, setWeights] = useState("");
  const [notes, setNotes] = useState("");

  const templates = useMemo(
    () => [...data.templates].sort((a, b) => a.title.localeCompare(b.title, "cs")),
    [data.templates],
  );

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setReviewReady(false);
    setWarnings([]);
    setConfidence(null);
    setOcrProgress(0);

    if (!ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
      setImageDataUrl("");
      setFileName("");
      setError("Použij screenshot PNG, JPEG nebo WebP do 6 MB.");
      return;
    }

    setPreparing(true);
    try {
      setImageDataUrl(await compressScreenshot(file));
      setFileName(file.name);
    } catch (reason) {
      setImageDataUrl("");
      setFileName("");
      setError(reason instanceof Error ? reason.message : "Screenshot se nepodařilo připravit.");
    } finally {
      setPreparing(false);
    }
  }

  function applyResult(result: ExtractedResult) {
    const normalizedTitle = normalizeText(result.workoutTitle);
    const matched = templates.find((template) => {
      const title = normalizeText(template.title);
      return normalizedTitle && (title.includes(normalizedTitle) || normalizedTitle.includes(title));
    });

    setTemplateId(matched?.id ?? "");
    setWorkoutTitle(matched?.title || result.workoutTitle || "Trénink ze screenshotu");
    setCompletedAt(toDateTimeLocal(result.completedAt));
    setDuration(formatDurationInput(result.durationSeconds));
    setRpe(String(result.rpe ?? 7));
    setAverageHeartRate(result.averageHeartRate === null ? "" : String(result.averageHeartRate));
    setMaxHeartRate(result.maxHeartRate === null ? "" : String(result.maxHeartRate));
    setCalories(result.calories === null ? "" : String(result.calories));
    setDistanceKm(result.distanceKm === null ? "" : String(result.distanceKm));
    setWeights(result.weights);
    setNotes(result.notes);
    setWarnings(result.warnings);
    setConfidence(result.confidence);
    setReviewReady(true);
  }

  async function readWithLocalOcr() {
    if (!imageDataUrl) return;
    setReadingLocally(true);
    setOcrProgress(0);
    setError("");

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", undefined, {
        logger(message) {
          if (message.status === "recognizing text") {
            setOcrProgress(Math.round(message.progress * 100));
          }
        },
      });

      try {
        const recognition = await worker.recognize(imageDataUrl);
        if (!recognition.data.text.trim()) {
          throw new Error("OCR ve screenshotu nenašlo čitelný text.");
        }

        const result = extractResultFromOcr(recognition.data.text);
        const foundUsefulValue =
          result.durationSeconds !== null ||
          result.averageHeartRate !== null ||
          result.calories !== null;
        if (!foundUsefulValue) {
          throw new Error("OCR nenašlo čas, tep ani kalorie. Zkus ruční vyplnění.");
        }

        setOcrProgress(100);
        applyResult(result);
      } finally {
        await worker.terminate();
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Lokální OCR se nepodařilo spustit. Zkus ruční vyplnění.",
      );
    } finally {
      setReadingLocally(false);
    }
  }

  async function analyzeScreenshot() {
    if (!imageDataUrl) return;
    setAnalyzing(true);
    setError("");

    try {
      const user = await getValidCloudUser();
      if (!user) {
        setError("Pro AI načtení se nejdřív přihlas ke cloudovému účtu.");
        return;
      }

      const response = await fetch("/api/results/import-screenshot", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + user.idToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageDataUrl }),
      });
      const body = (await response.json()) as { result?: ExtractedResult; error?: string };
      if (!response.ok || !body.result) {
        throw new Error(body.error || "Screenshot se nepodařilo rozpoznat.");
      }
      applyResult(body.result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Screenshot se nepodařilo rozpoznat.");
    } finally {
      setAnalyzing(false);
    }
  }

  function startManualReview() {
    setTemplateId("");
    setWorkoutTitle("Trénink ze screenshotu");
    setCompletedAt(toDateTimeLocal(null));
    setDuration("");
    setRpe("7");
    setAverageHeartRate("");
    setMaxHeartRate("");
    setCalories("");
    setDistanceKm("");
    setWeights("");
    setNotes("");
    setWarnings([]);
    setConfidence(null);
    setError("");
    setReviewReady(true);
  }

  function selectTemplate(value: string) {
    setTemplateId(value);
    const template = templates.find((item) => item.id === value);
    if (template) setWorkoutTitle(template.title);
  }

  function saveResult() {
    const durationSeconds = parseDuration(duration);
    const parsedRpe = Number(rpe);
    const date = new Date(completedAt);
    if (!workoutTitle.trim()) {
      setError("Doplň název tréninku.");
      return;
    }
    if (!durationSeconds) {
      setError("Doplň čas ve formátu HH:MM:SS, například 00:42:18.");
      return;
    }
    if (!Number.isInteger(parsedRpe) || parsedRpe < 1 || parsedRpe > 10) {
      setError("RPE musí být celé číslo od 1 do 10.");
      return;
    }
    if (!completedAt || Number.isNaN(date.getTime())) {
      setError("Doplň platné datum a čas tréninku.");
      return;
    }

    const template = templates.find((item) => item.id === templateId);
    addResult({
      templateId: template?.id ?? "screenshot-import",
      workoutTitle: template?.title ?? workoutTitle.trim(),
      workoutCode: template?.metadata?.workoutCode,
      templateVersion: template?.metadata?.templateVersion,
      metadataSnapshot: template?.metadata ? structuredClone(template.metadata) : undefined,
      completedAt: date.toISOString(),
      durationSeconds,
      rpe: parsedRpe,
      weights: weights.trim(),
      notes: notes.trim(),
      splits: [],
      source: "screenshot",
      sourceImageName: fileName,
      metrics: {
        averageHeartRate: optionalNumber(averageHeartRate),
        maxHeartRate: optionalNumber(maxHeartRate),
        calories: optionalNumber(calories),
        distanceKm: optionalNumber(distanceKm),
      },
    });
    router.push("/history");
  }

  return (
    <PlanningShell
      eyebrow="Výsledky"
      title="Načíst screenshot"
      description="Nahraj souhrn z hodinek nebo fitness aplikace. Rozpoznané hodnoty vždy nejdřív zkontroluješ."
      backHref="/history"
    >
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-xl font-black">1. Vyber screenshot</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          PNG, JPEG nebo WebP do 6 MB. Obrázek se zmenší v tomto zařízení a aplikace jej neuloží.
        </p>
        <label className="mt-5 block cursor-pointer rounded-2xl border border-dashed border-lime-400/50 bg-lime-400/5 px-5 py-6 text-center font-black text-lime-300">
          {preparing ? "Připravuji obrázek…" : imageDataUrl ? "Vybrat jiný screenshot" : "Vybrat screenshot"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={chooseFile}
            className="sr-only"
          />
        </label>

        {imageDataUrl && (
          <div className="mt-5">
            <div className="relative aspect-[9/16] max-h-[30rem] overflow-hidden rounded-2xl bg-zinc-950">
              <Image
                src={imageDataUrl}
                alt="Náhled vybraného screenshotu"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
            <p className="mt-3 truncate text-center text-xs text-zinc-500">{fileName}</p>
            {!reviewReady && (
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={readWithLocalOcr}
                  disabled={readingLocally || analyzing}
                  className="w-full rounded-2xl bg-lime-400 px-5 py-4 font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60"
                >
                  {readingLocally
                    ? ocrProgress > 0
                      ? `Čtu v zařízení… ${ocrProgress} %`
                      : "Připravuji lokální OCR…"
                    : "Načíst zdarma v zařízení"}
                </button>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={analyzeScreenshot}
                    disabled={readingLocally || analyzing}
                    className="rounded-2xl bg-zinc-800 px-5 py-4 font-bold text-zinc-200 disabled:cursor-wait disabled:opacity-60"
                  >
                    {analyzing ? "Čtu přes OpenAI…" : "Načíst přes OpenAI"}
                  </button>
                  <button
                    type="button"
                    onClick={startManualReview}
                    disabled={readingLocally || analyzing}
                    className="rounded-2xl border border-zinc-700 px-5 py-4 font-bold text-zinc-300 disabled:opacity-60"
                  >
                    Vyplnit ručně
                  </button>
                </div>
              </div>
            )}
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Bezplatné OCR zpracuje obrázek v tomto prohlížeči. Pouze volba OpenAI odešle obrázek k externí analýze. Uloží se až tebou potvrzené hodnoty.
            </p>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-300">
          {error}
        </p>
      )}

      {reviewReady && (
        <section className="mt-6 rounded-3xl border border-lime-400/30 bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">2. Kontrola</p>
              <h2 className="mt-2 text-2xl font-black">Potvrď rozpoznané údaje</h2>
            </div>
            {confidence !== null && (
              <span className="shrink-0 rounded-full bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300">
                Jistota {Math.round(confidence * 100)} %
              </span>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="mt-4 rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-200">
              <p className="font-black">Zkontroluj hlavně:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}

          <label className="mt-5 block text-sm font-bold text-zinc-300">
            Přiřadit k tréninku
            <select
              value={templateId}
              onChange={(event) => selectTemplate(event.target.value)}
              disabled={!ready}
              className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-base"
            >
              <option value="">Bez přiřazení</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.title}</option>
              ))}
            </select>
          </label>

          <TextField label="Název tréninku" value={workoutTitle} onChange={setWorkoutTitle} />
          <label className="mt-5 block text-sm font-bold text-zinc-300">
            Datum a čas
            <input
              type="datetime-local"
              value={completedAt}
              onChange={(event) => setCompletedAt(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-base"
            />
          </label>
          <TextField
            label="Celkový čas"
            value={duration}
            onChange={setDuration}
            placeholder="00:42:18"
            inputMode="numeric"
          />

          <div className="mt-5 grid grid-cols-2 gap-3">
            <NumberField label="RPE 1–10" value={rpe} onChange={setRpe} min="1" max="10" step="1" />
            <NumberField label="Průměrný tep" value={averageHeartRate} onChange={setAverageHeartRate} min="20" max="260" step="1" />
            <NumberField label="Maximální tep" value={maxHeartRate} onChange={setMaxHeartRate} min="20" max="260" step="1" />
            <NumberField label="Kalorie" value={calories} onChange={setCalories} min="0" step="1" />
            <NumberField label="Vzdálenost (km)" value={distanceKm} onChange={setDistanceKm} min="0" step="0.01" />
          </div>

          <TextField label="Použité váhy" value={weights} onChange={setWeights} placeholder="Např. wall ball 9 kg" />
          <label className="mt-5 block text-sm font-bold text-zinc-300">
            Poznámka
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="mt-2 w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-base outline-none focus:border-lime-400"
            />
          </label>

          <button
            type="button"
            onClick={saveResult}
            className="mt-7 w-full rounded-2xl bg-lime-400 px-5 py-4 text-lg font-black text-zinc-950"
          >
            Uložit zkontrolovaný výsledek
          </button>
        </section>
      )}
    </PlanningShell>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric";
}) {
  return (
    <label className="mt-5 block text-sm font-bold text-zinc-300">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-base outline-none focus:border-lime-400"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: string;
  max?: string;
  step: string;
}) {
  return (
    <label className="block text-xs font-bold text-zinc-400">
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-3 py-3.5 text-base text-white outline-none focus:border-lime-400"
      />
    </label>
  );
}
