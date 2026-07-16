/**
 * Shared fixtures for the engine test suite. Not a test file itself (no *.test.ts
 * suffix), so the runner won't execute it directly.
 */
import { randomUUID } from "crypto";
import type { Card, Hand, Rank, Suit } from "../app/lib/types.js";

/** Build a single card. Suit is cosmetic for value tests, so it defaults to spades. */
export function card(rank: Rank, suit: Suit = "spades", faceDown = false): Card {
  return { rank, suit, faceDown };
}

/** Build a list of face-up cards from ranks, e.g. cards("A", "K"). */
export function cards(...ranks: Rank[]): Card[] {
  return ranks.map((r) => card(r));
}

/** Build a Hand around a card list, with sensible defaults and optional overrides. */
export function makeHand(cardList: Card[], overrides: Partial<Hand> = {}): Hand {
  return {
    handId: randomUUID(),
    cards: cardList,
    bet: 100,
    doubled: false,
    stood: false,
    busted: false,
    fiveCardCharlie: false,
    result: null,
    insuranceBet: 0,
    splitFromHandId: null,
    actionHistory: [],
    ...overrides,
  };
}

/** Run `fn` with Math.random pinned to `value`, restoring the original afterward. */
export function withRandom<T>(value: number, fn: () => T): T {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
