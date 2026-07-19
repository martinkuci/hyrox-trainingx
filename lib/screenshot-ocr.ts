export type LocalOcrResult = {
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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs-CZ")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function validInteger(value: string | undefined, min: number, max: number) {
  if (!value) return null;
  const parsed = Number(value.replace(/\s/g, ""));
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function numberAfterLabel(
  text: string,
  label: RegExp,
  value: RegExp,
  min: number,
  max: number,
) {
  const match = label.exec(text);
  if (!match || match.index === undefined) return null;
  const nearby = text.slice(match.index, match.index + 180);
  const valueMatch = value.exec(nearby);
  return validInteger(valueMatch?.[1], min, max);
}

function repeatedBpm(text: string) {
  const counts = new Map<number, number>();
  for (const match of text.matchAll(/\b(\d{2,3})\s*bpm\b/g)) {
    const value = validInteger(match[1], 20, 260);
    if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  for (const [value, count] of counts) {
    if (count >= 2) return value;
  }
  return null;
}

function readDuration(text: string) {
  for (const match of text.matchAll(/\b(\d{1,2})[:.](\d{2})[:.](\d{2})\b/g)) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (hours <= 24 && minutes <= 59 && seconds <= 59) {
      const total = hours * 3_600 + minutes * 60 + seconds;
      if (total > 0 && total <= 86_400) return total;
    }
  }
  return null;
}

function readTimeRange(text: string) {
  const match = /\b([01]?\d|2[0-3])[:.](\d{2})\s*-\s*([01]?\d|2[0-3])[:.](\d{2})\b/.exec(text);
  if (!match) return null;
  const endHour = Number(match[3]);
  const endMinute = Number(match[4]);
  if (endMinute > 59) return null;
  return { endHour, endMinute };
}

function readDate(text: string) {
  for (const match of text.matchAll(/(?:^|\s)(\d{1,2})\s*[./]\s*(\d{1,2})\s*[.]?(?=\s|$)/g)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { day, month };
    }
  }
  return null;
}

function completedAtFromText(text: string, now: Date) {
  const date = readDate(text);
  const range = readTimeRange(text);
  if (!date || !range) return null;

  let year = now.getFullYear();
  let completedAt = new Date(
    year,
    date.month - 1,
    date.day,
    range.endHour,
    range.endMinute,
  );
  const futureLimit = new Date(now);
  futureLimit.setDate(futureLimit.getDate() + 7);
  if (completedAt > futureLimit) {
    year -= 1;
    completedAt = new Date(
      year,
      date.month - 1,
      date.day,
      range.endHour,
      range.endMinute,
    );
  }

  return Number.isNaN(completedAt.getTime()) ? null : completedAt.toISOString();
}

function readWorkoutTitle(rawText: string, normalizedText: string) {
  if (/funk\w{2,8}\s+silov\w*\s+trenink/i.test(normalizedText)) {
    return "Funkční silový trénink";
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const rangeIndex = lines.findIndex((line) =>
    /\b(?:[01]?\d|2[0-3])[:.]\d{2}\s*[-–—−]\s*(?:[01]?\d|2[0-3])[:.]\d{2}\b/.test(line),
  );

  if (rangeIndex > 0) {
    for (let index = rangeIndex - 1; index >= Math.max(0, rangeIndex - 3); index -= 1) {
      const line = lines[index];
      const cleaned = line.replace(/[^\p{L}\p{N}\s-]/gu, "").trim();
      if (
        cleaned.length >= 4 &&
        cleaned.length <= 80 &&
        /\p{L}/u.test(cleaned) &&
        !/^\s*(?:po|ut|st|ct|pa|so|ne)?\s*\d{1,2}\s*[./]\s*\d{1,2}/i.test(normalize(cleaned))
      ) {
        return cleaned;
      }
    }
  }

  return "Trénink ze screenshotu";
}

export function extractResultFromOcr(rawText: string, now = new Date()): LocalOcrResult {
  const text = normalize(rawText);
  const durationSeconds = readDuration(text);
  const activeCalories = numberAfterLabel(
    text,
    /aktivni\s+(?:kilo)?kalor\w*/,
    /(\d{1,5})\s*kcal/,
    0,
    20_000,
  );
  const totalCalories = numberAfterLabel(
    text,
    /(?:kilo)?kalor\w*\s+celkem/,
    /(\d{1,5})\s*kcal/,
    0,
    20_000,
  );
  const averageHeartRate =
    numberAfterLabel(
      text,
      /prumer\w*\s+tepov\w*\s+frekven\w*/,
      /(\d{2,3})\s*bpm/,
      20,
      260,
    ) ?? repeatedBpm(text);
  const maxHeartRate = numberAfterLabel(
    text,
    /maximaln\w*\s+tepov\w*\s+frekven\w*/,
    /(\d{2,3})\s*bpm/,
    20,
    260,
  );
  const completedAt = completedAtFromText(text, now);
  const workoutTitle = readWorkoutTitle(rawText, text);
  const calories = activeCalories ?? totalCalories;
  const warnings: string[] = [];
  const notes: string[] = [];

  if (completedAt) {
    warnings.push("Rok na screenshotu není uvedený; zkontroluj doplněný rok.");
  }
  if (activeCalories !== null && totalCalories !== null && activeCalories !== totalCalories) {
    notes.push(`Celkové kalorie: ${totalCalories} kcal.`);
    warnings.push("Do pole Kalorie byly vloženy aktivní kalorie; celkové kalorie jsou v poznámce.");
  }
  if (durationSeconds === null) warnings.push("OCR nenašlo celkový čas.");
  if (averageHeartRate === null) warnings.push("OCR nenašlo průměrný tep.");
  if (calories === null) warnings.push("OCR nenašlo kalorie.");
  if (workoutTitle === "Trénink ze screenshotu") {
    warnings.push("OCR nerozpoznalo název tréninku.");
  }

  const recognized = [
    durationSeconds !== null,
    averageHeartRate !== null,
    calories !== null,
    completedAt !== null,
    workoutTitle !== "Trénink ze screenshotu",
  ].filter(Boolean).length;

  return {
    workoutTitle,
    completedAt,
    durationSeconds,
    averageHeartRate,
    maxHeartRate,
    calories,
    distanceKm: null,
    rpe: null,
    weights: "",
    notes: notes.join("\n"),
    confidence: Math.min(0.95, 0.35 + recognized * 0.12),
    warnings,
  };
}
