import type { BlockFeedbackRating } from "./types";

export const BLOCK_FEEDBACK_OPTIONS: ReadonlyArray<{
  rating: BlockFeedbackRating;
  title: string;
  description: string;
}> = [
  { rating: 1, title: "Příště ubrat", description: "Bylo to skoro nezvládnutelné." },
  { rating: 2, title: "Hodně náročné", description: "Zvládl jsem to, ale na hraně." },
  { rating: 3, title: "Akorát", description: "Ideální poměr zátěže a výkonu." },
  { rating: 4, title: "Spíš lehké", description: "Příště můžu trochu přidat." },
  { rating: 5, title: "Brnkačka", description: "Příště výrazně přidat." },
] as const;

export function blockFeedbackLabel(rating: BlockFeedbackRating) {
  return BLOCK_FEEDBACK_OPTIONS.find((option) => option.rating === rating)?.title ?? "Bez hodnocení";
}

export function blockFeedbackToRpe(rating: BlockFeedbackRating) {
  return ({ 1: 10, 2: 8, 3: 6, 4: 4, 5: 2 } as const)[rating];
}
