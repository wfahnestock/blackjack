import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getHandValues,
  getBestValue,
  isBlackjack,
  isBust,
  isSoft,
  canSplit,
  canDouble,
  dealerShouldHit,
} from "./HandEvaluator.js";
import { card, cards, makeHand } from "./testHelpers.js";

describe("getHandValues / getBestValue", () => {
  test("hard totals sum straightforwardly", () => {
    assert.equal(getBestValue(cards("10", "7")), 17);
    assert.equal(getBestValue(cards("9", "8")), 17);
    assert.equal(getBestValue(cards("K", "Q")), 20);
  });

  test("a single ace counts as 11 when it doesn't bust (soft)", () => {
    assert.deepEqual(getHandValues(cards("A", "7")), [8, 18]);
    assert.equal(getBestValue(cards("A", "7")), 18);
  });

  test("an ace drops to 1 when counting it as 11 would bust", () => {
    assert.deepEqual(getHandValues(cards("A", "6", "10")), [17]); // 11 would make 27
    assert.equal(getBestValue(cards("A", "6", "10")), 17);
  });

  test("two aces total 12 (one as 11, one as 1)", () => {
    assert.equal(getBestValue(cards("A", "A")), 12);
  });

  test("blackjack totals 21", () => {
    assert.equal(getBestValue(cards("A", "K")), 21);
  });

  test("a bust returns the lowest busted total", () => {
    assert.equal(getBestValue(cards("K", "Q", "5")), 25);
  });

  test("face-down cards are ignored", () => {
    assert.equal(getBestValue([card("10"), card("K", "spades", true)]), 10);
  });
});

describe("isBlackjack", () => {
  test("a two-card 21 is a blackjack", () => {
    assert.equal(isBlackjack(makeHand(cards("A", "K"))), true);
  });

  test("21 across three cards is not a blackjack", () => {
    assert.equal(isBlackjack(makeHand(cards("A", "5", "5"))), false);
  });

  test("a split hand can never be a blackjack", () => {
    assert.equal(isBlackjack(makeHand(cards("A", "K"), { splitFromHandId: "h1" })), false);
  });

  test("a non-21 hand is not a blackjack", () => {
    assert.equal(isBlackjack(makeHand(cards("10", "9"))), false);
  });
});

describe("isBust", () => {
  test("over 21 is a bust", () => {
    assert.equal(isBust(makeHand(cards("K", "Q", "5"))), true);
  });

  test("21 or under is not a bust", () => {
    assert.equal(isBust(makeHand(cards("K", "Q"))), false);
    assert.equal(isBust(makeHand(cards("A", "6", "10"))), false); // hard 17
  });
});

describe("isSoft", () => {
  test("a two-card ace hand that can use 11 is soft", () => {
    assert.equal(isSoft(cards("A", "6")), true); // soft 17
    assert.equal(isSoft(cards("A", "8")), true); // soft 19
    assert.equal(isSoft(cards("A", "A")), true); // soft 12
    assert.equal(isSoft(cards("A", "10")), true); // soft 21
  });

  test("a hand with no ace is hard", () => {
    assert.equal(isSoft(cards("10", "7")), false);
    assert.equal(isSoft(cards("9", "8")), false);
  });

  test("a multi-card hand is soft only if an ace can still count as 11", () => {
    assert.equal(isSoft(cards("A", "2", "4")), true); // soft 17 (ace = 11)
    assert.equal(isSoft(cards("A", "6", "10")), false); // hard 17 (ace forced to 1)
    assert.equal(isSoft(cards("A", "K", "5")), false); // hard 16
  });
});

describe("canSplit", () => {
  test("a matching pair can split under the cap", () => {
    assert.equal(canSplit(makeHand(cards("8", "8")), 0), true);
  });

  test("ten-valued cards of different ranks can split", () => {
    assert.equal(canSplit(makeHand(cards("10", "K")), 0), true);
    assert.equal(canSplit(makeHand(cards("Q", "J")), 0), true);
  });

  test("non-pairs cannot split", () => {
    assert.equal(canSplit(makeHand(cards("8", "9")), 0), false);
  });

  test("cannot split at or beyond the split cap (MAX_SPLITS = 3)", () => {
    assert.equal(canSplit(makeHand(cards("8", "8")), 3), false);
  });

  test("cannot split a hand that isn't exactly two cards", () => {
    assert.equal(canSplit(makeHand(cards("8", "8", "2")), 0), false);
  });
});

describe("canDouble", () => {
  test("a fresh two-card hand can double", () => {
    assert.equal(canDouble(makeHand(cards("5", "6"))), true);
  });

  test("cannot double after standing or with more than two cards", () => {
    assert.equal(canDouble(makeHand(cards("5", "6"), { stood: true })), false);
    assert.equal(canDouble(makeHand(cards("5", "6", "2"))), false);
  });
});

describe("dealerShouldHit (base rules: stand on all 17s)", () => {
  test("hits a hard 16 or less", () => {
    assert.equal(dealerShouldHit(cards("10", "6")), true); // 16
    assert.equal(dealerShouldHit(cards("10", "4")), true); // 14
  });

  test("stands on 17 and up, including soft 17 (base rule)", () => {
    assert.equal(dealerShouldHit(cards("10", "7")), false); // hard 17
    assert.equal(dealerShouldHit(cards("A", "6")), false); // soft 17
    assert.equal(dealerShouldHit(cards("K", "8")), false); // 18
  });
});
