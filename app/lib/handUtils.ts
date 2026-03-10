import type { Card } from "./types.js";
import { RANK_VALUES } from "./constants.js";

export function getHandValues(cards: Card[]): number[] {
  const visible = cards.filter((c) => !c.faceDown);
  let totals = [0];

  for (const card of visible) {
    const values = RANK_VALUES[card.rank];
    if (values.length === 1) {
      totals = totals.map((t) => t + values[0]);
    } else {
      totals = totals.flatMap((t) => values.map((v) => t + v));
    }
  }

  const unique = [...new Set(totals)].sort((a, b) => a - b);
  const valid = unique.filter((v) => v <= 21);
  return valid.length > 0 ? valid : [unique[0]];
}

export function getBestValue(cards: Card[]): number {
  const values = getHandValues(cards);
  const valid = values.filter((v) => v <= 21);
  if (valid.length > 0) return Math.max(...valid);
  return Math.min(...values);
}

export function getScoreDisplay(cards: Card[]): string {
  const visible = cards.filter((c) => !c.faceDown);
  if (visible.length === 0) return "";

  const values = getHandValues(cards);
  const valid = values.filter((v) => v <= 21);

  if (valid.length === 0) return `${Math.min(...values)} (Bust)`;
  if (valid.length === 1) return `${valid[0]}`;

  // Show soft value: e.g. "A+6 → 7/17"
  return `${valid[0]}/${valid[valid.length - 1]}`;
}

export function formatChips(n: number): string {
  return n.toLocaleString();
}
