import type { Rank } from "../../app/lib/types.js";
import { RANK_VALUES } from "../../app/lib/constants.js";

export type BSAction = "hit" | "stand" | "double" | "split";

/** Returns numeric dealer upcard value (Ace = 11). */
function dealerValue(upcard: Rank): number {
  if (upcard === "A") return 11;
  const v = RANK_VALUES[upcard][0];
  return Math.min(v, 10);
}

/**
 * Returns the correct basic strategy action for a multi-deck S17 game.
 *
 * canDouble: whether the game rules allow doubling right now (2 cards, not stood).
 * canSplitNow: whether the game rules allow splitting right now.
 *
 * When BS recommends "double" but canDouble is false, falls back to "hit".
 * When BS recommends "split" but canSplitNow is false, falls back to hard-total advice.
 */
export function getCorrectAction(
  handValue: number,
  isSoft: boolean,
  isPair: boolean,
  pairRank: Rank | null,
  upcard: Rank,
  canDouble: boolean,
  canSplitNow: boolean
): BSAction {
  const d = dealerValue(upcard);

  // ── Pairs ────────────────────────────────────────────────────────────────────
  if (isPair && pairRank && canSplitNow) {
    const pv = RANK_VALUES[pairRank][0]; // 1 for Ace, else face value (capped at 10)
    const split = shouldSplitPair(pairRank, pv, d);
    if (split) return "split";
    // Fall through to hard/soft logic using the hand total
  }

  // ── Soft totals ──────────────────────────────────────────────────────────────
  if (isSoft) {
    return softStrategy(handValue, d, canDouble);
  }

  // ── Hard totals ──────────────────────────────────────────────────────────────
  return hardStrategy(handValue, d, canDouble);
}

function shouldSplitPair(rank: Rank, pv: number, d: number): boolean {
  if (rank === "A") return true;   // Always split aces
  if (pv === 10) return false;     // Never split 10-value cards
  if (pv === 8) return true;       // Always split 8s
  if (pv === 9) return d !== 7 && d <= 9; // Split 9s vs 2-9 except 7
  if (pv === 7) return d <= 7;     // Split 7s vs 2-7
  if (pv === 6) return d >= 2 && d <= 6; // Split 6s vs 2-6
  if (pv === 5) return false;      // Never split 5s (treat as 10)
  if (pv === 4) return d === 5 || d === 6; // Split 4s vs 5-6
  if (pv === 3 || pv === 2) return d >= 2 && d <= 7; // Split 2s/3s vs 2-7
  return false;
}

function softStrategy(total: number, d: number, canDouble: boolean): BSAction {
  // total includes the ace counted as 11
  if (total >= 20) return "stand";

  if (total === 19) {
    // Soft 19 (A8): double vs 6, else stand
    if (d === 6 && canDouble) return "double";
    return "stand";
  }

  if (total === 18) {
    // Soft 18 (A7): double vs 3-6, stand vs 2/7/8, hit vs 9/10/A
    if ((d >= 3 && d <= 6) && canDouble) return "double";
    if (d === 2 || d === 7 || d === 8) return "stand";
    return "hit";
  }

  if (total === 17) {
    // Soft 17 (A6): double vs 3-6, else hit
    if ((d >= 3 && d <= 6) && canDouble) return "double";
    return "hit";
  }

  if (total === 16) {
    // Soft 16 (A5): double vs 4-6, else hit
    if ((d >= 4 && d <= 6) && canDouble) return "double";
    return "hit";
  }

  if (total === 15) {
    // Soft 15 (A4): double vs 4-6, else hit
    if ((d >= 4 && d <= 6) && canDouble) return "double";
    return "hit";
  }

  // Soft 13-14: double vs 5-6, else hit
  if ((d === 5 || d === 6) && canDouble) return "double";
  return "hit";
}

function hardStrategy(total: number, d: number, canDouble: boolean): BSAction {
  if (total >= 17) return "stand";

  if (total >= 13 && total <= 16) {
    // Stand vs dealer 2-6, hit vs 7+
    return d <= 6 ? "stand" : "hit";
  }

  if (total === 12) {
    // Stand vs dealer 4-6, hit else
    return (d >= 4 && d <= 6) ? "stand" : "hit";
  }

  if (total === 11) {
    // Double vs 2-10, hit vs A
    if (d <= 10 && canDouble) return "double";
    return "hit";
  }

  if (total === 10) {
    // Double vs 2-9, hit vs 10/A
    if (d <= 9 && canDouble) return "double";
    return "hit";
  }

  if (total === 9) {
    // Double vs 3-6, hit else
    if ((d >= 3 && d <= 6) && canDouble) return "double";
    return "hit";
  }

  // Hard 8 or less: always hit
  return "hit";
}

/**
 * Returns true if the given action was a mistake vs basic strategy.
 * "double" recommended but player hit → NOT a mistake (chip constraints are valid).
 * "split" recommended but player didn't split → IS a mistake for A-A and 8-8 only.
 */
export function isMistake(
  taken: BSAction,
  correct: BSAction
): boolean {
  if (taken === correct) return false;
  // Hitting when double is correct is acceptable (may not have chips)
  if (correct === "double" && taken === "hit") return false;
  // Standing when double is correct IS a mistake
  return true;
}
