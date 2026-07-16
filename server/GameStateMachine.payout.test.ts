import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveHandResult } from "./GameStateMachine.js";
import { BLACKJACK_PAYOUT, INSURANCE_PAYOUT } from "../app/lib/constants.js";
import { cards, makeHand } from "./testHelpers.js";

// Payout multipliers are the TOTAL return applied to the bet (stake + winnings),
// added to chips by the caller after the stake was already removed at bet time.
// So: loss/bust = 0, push = 1 (stake back), win = 2, blackjack = 2.5, Charlie = 2.
describe("resolveHandResult — payout decision table", () => {
  test("a busted hand loses its bet", () => {
    const r = resolveHandResult(makeHand(cards("K", "Q", "5"), { busted: true }), false, false, 20);
    assert.deepEqual(r, { result: "bust", payoutMultiplier: 0 });
  });

  test("both blackjacks push", () => {
    const r = resolveHandResult(makeHand(cards("A", "K")), true, true, 21);
    assert.deepEqual(r, { result: "push", payoutMultiplier: 1 });
  });

  test("a dealer blackjack beats a non-blackjack player", () => {
    const r = resolveHandResult(makeHand(cards("10", "9")), false, true, 21);
    assert.deepEqual(r, { result: "lose", payoutMultiplier: 0 });
  });

  test("a dealer blackjack even beats a five-card Charlie (row order matters)", () => {
    const hand = makeHand(cards("2", "3", "2", "4", "3"), { fiveCardCharlie: true });
    const r = resolveHandResult(hand, false, true, 21);
    assert.deepEqual(r, { result: "lose", payoutMultiplier: 0 });
  });

  test("a five-card Charlie wins 2x when the dealer has no blackjack", () => {
    const hand = makeHand(cards("2", "3", "2", "4", "3"), { fiveCardCharlie: true }); // 14 over 5 cards
    const r = resolveHandResult(hand, false, false, 20);
    assert.deepEqual(r, { result: "five-card-charlie", payoutMultiplier: 2 });
  });

  test("a player blackjack pays 3:2 (2.5x total return)", () => {
    const r = resolveHandResult(makeHand(cards("A", "K")), true, false, 20);
    assert.equal(r.result, "blackjack");
    assert.equal(r.payoutMultiplier, 1 + BLACKJACK_PAYOUT);
    assert.equal(r.payoutMultiplier, 2.5);
  });

  test("a higher player total wins 2x", () => {
    const r = resolveHandResult(makeHand(cards("10", "9")), false, false, 18);
    assert.deepEqual(r, { result: "win", payoutMultiplier: 2 });
  });

  test("a dealer bust wins for a standing player", () => {
    const r = resolveHandResult(makeHand(cards("10", "7")), false, false, 23);
    assert.deepEqual(r, { result: "win", payoutMultiplier: 2 });
  });

  test("an equal total pushes", () => {
    const r = resolveHandResult(makeHand(cards("10", "9")), false, false, 19);
    assert.deepEqual(r, { result: "push", payoutMultiplier: 1 });
  });

  test("a lower player total loses", () => {
    const r = resolveHandResult(makeHand(cards("10", "7")), false, false, 20);
    assert.deepEqual(r, { result: "lose", payoutMultiplier: 0 });
  });
});

describe("payout rates", () => {
  test("blackjack pays 3:2 and insurance pays 2:1", () => {
    assert.equal(BLACKJACK_PAYOUT, 1.5);
    assert.equal(INSURANCE_PAYOUT, 2);
  });

  test("a winning insurance bet returns 3x the stake", () => {
    // startPayout convention: payout += insuranceBet + insuranceBet * INSURANCE_PAYOUT
    const insuranceBet = 50;
    const returned = insuranceBet + insuranceBet * INSURANCE_PAYOUT;
    assert.equal(returned, 150); // 50 stake back + 100 winnings
  });
});
