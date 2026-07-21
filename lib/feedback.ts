export const FEEDBACK_CATEGORIES = {
  idea: "Nápad na zlepšení",
  bug: "Nahlášení chyby",
  question: "Dotaz k používání",
  other: "Jiná připomínka",
} as const;

export const FEEDBACK_SUBJECTS = {
  idea: "Nápad",
  bug: "Chyba",
  question: "Dotaz",
  other: "Připomínka",
} as const;

export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORIES;

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && value in FEEDBACK_CATEGORIES;
}
