import type { Card, Hand } from "../app/lib/types.js";
import { RANK_VALUES, MAX_SPLITS } from "../app/lib/constants.js";

export function getHandValues(cards: Card[]): number[] {
  // Returns all possible non-bust values (or lowest bust value)
  const visible = cards.filter((c) => !c.faceDown);
  let totals = [0];

  for (const card of visible) {
    const values = RANK_VALUES[card.rank];
    if (values.length === 1) {
      totals = totals.map((t) => t + values[0]);
    } else {
      // Ace: each existing total branches
      totals = totals.flatMap((t) => values.map((v) => t + v));
    }
  }

  // Deduplicate and sort
  const unique = [...new Set(totals)].sort((a, b) => a - b);

  // Prefer highest non-bust value
  const valid = unique.filter((v) => v <= 21);
  return valid.length > 0 ? valid : [unique[0]];
}

export function getBestValue(cards: Card[]): number {
  const values = getHandValues(cards);
  const valid = values.filter((v) => v <= 21);
  if (valid.length > 0) return Math.max(...valid);
  return Math.min(...values);
}

export function isBlackjack(hand: Hand): boolean {
  return (
    hand.cards.length === 2 &&
    hand.splitFromHandId === null &&
    getBestValue(hand.cards) === 21
  );
}

export function isBust(hand: Hand): boolean {
  return getBestValue(hand.cards) > 21;
}

export function isSoft(cards: Card[]): boolean {
  // A hand is "soft" if one ace is counted as 11
  const values = getHandValues(cards);
  const best = getBestValue(cards);
  return values.includes(best) && best <= 21 && cards.some((c) => c.rank === "A");
}

export function canSplit(hand: Hand, existingSplitCount: number): boolean {
  if (hand.cards.length !== 2) return false;
  if (existingSplitCount >= MAX_SPLITS) return false;
  // Cards must have equal point value (10/J/Q/K all = 10)
  const v0 = RANK_VALUES[hand.cards[0].rank][0];
  const v1 = RANK_VALUES[hand.cards[1].rank][0];
  return v0 === v1;
}

export function canDouble(hand: Hand): boolean {
  return hand.cards.filter((c) => !c.faceDown).length === 2 && !hand.stood && !hand.busted;
}

export function dealerShouldHit(dealerCards: Card[]): boolean {
  // Dealer hits on hard 16 or less, and soft 16
  // Dealer stands on hard 17+ and soft 17+
  const best = getBestValue(dealerCards);
  if (best < 17) return true;
  if (best > 17) return false;
  // best === 17: stand unless soft 17 (hit soft 16, stand soft 17 standard rules)
  // Standard rules: stand on all 17s
  return false;
}
