import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Deck } from "./Deck.js";
import { SHOE_SIZE, CUT_CARD_PENETRATION } from "../app/lib/constants.js";

describe("Deck", () => {
  test("a fresh shoe holds a full 6-deck shoe (312 cards)", () => {
    const deck = new Deck();
    assert.equal(deck.cardsRemaining, SHOE_SIZE);
    assert.equal(deck.cardsRemaining, 312);
  });

  test("dealing removes one card and honors faceDown", () => {
    const deck = new Deck();
    const up = deck.deal();
    assert.equal(up.faceDown, false);
    assert.equal(deck.cardsRemaining, 311);

    const down = deck.deal(true);
    assert.equal(down.faceDown, true);
    assert.equal(deck.cardsRemaining, 310);
  });

  test("penetration tracks the fraction dealt", () => {
    const deck = new Deck();
    for (let i = 0; i < 156; i++) deck.deal(); // half the shoe
    assert.ok(Math.abs(deck.penetration - 0.5) < 1e-9);
  });

  test("needsShuffle flips once penetration reaches the cut card (90%)", () => {
    const deck = new Deck();
    // 312 * 0.10 = 31.2, so the cut is crossed once only 31 cards remain (281 dealt).
    for (let i = 0; i < 280; i++) deck.deal();
    assert.equal(deck.needsShuffle, false);

    deck.deal(); // 281 dealt, 31 remain
    assert.ok(deck.penetration >= CUT_CARD_PENETRATION);
    assert.equal(deck.needsShuffle, true);
  });

  test("reshuffle refills the shoe and resets penetration", () => {
    const deck = new Deck();
    for (let i = 0; i < 100; i++) deck.deal();
    deck.reshuffle();
    assert.equal(deck.cardsRemaining, 312);
    assert.equal(deck.penetration, 0);
    assert.equal(deck.needsShuffle, false);
  });

  test("dealing past the end auto-rebuilds the shoe", () => {
    const deck = new Deck();
    for (let i = 0; i < 312; i++) deck.deal();
    assert.equal(deck.cardsRemaining, 0);

    const next = deck.deal(); // triggers rebuild + shuffle
    assert.ok(next);
    assert.equal(deck.cardsRemaining, 311);
  });

  test("a fresh shoe has the correct card composition", () => {
    const deck = new Deck();
    const rankCounts: Record<string, number> = {};
    const suitCounts: Record<string, number> = {};
    for (let i = 0; i < 312; i++) {
      const c = deck.deal();
      rankCounts[c.rank] = (rankCounts[c.rank] ?? 0) + 1;
      suitCounts[c.suit] = (suitCounts[c.suit] ?? 0) + 1;
    }
    assert.equal(rankCounts["A"], 24); // 6 decks * 4 aces
    assert.equal(rankCounts["K"], 24);
    assert.equal(rankCounts["10"], 24);
    assert.equal(suitCounts["spades"], 78); // 6 decks * 13 ranks
    assert.equal(Object.values(rankCounts).reduce((a, b) => a + b, 0), 312);
  });
});
