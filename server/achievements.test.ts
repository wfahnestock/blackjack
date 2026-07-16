import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENT_MAP,
  HIGH_ROLLER_MIN_BET,
  defaultProgress,
  type AchievementContext,
} from "./achievements/definitions.js";
import type { Hand, Player, RoundResult } from "../app/lib/types.js";

const check = ACHIEVEMENT_MAP.get("high_roller_win")!.check;

function hand(bet: number): Hand {
  return {
    handId: "h",
    cards: [],
    bet,
    doubled: false,
    stood: false,
    busted: false,
    fiveCardCharlie: false,
    result: null,
    insuranceBet: 0,
    splitFromHandId: null,
    actionHistory: [],
  };
}

function rr(result: RoundResult["result"]): RoundResult {
  return { playerId: "p", handId: "h", result, payout: 0 };
}

const player: Player = {
  playerId: "p",
  displayName: "p",
  seatIndex: 0,
  chips: 100000,
  hands: [],
  status: "connected",
  isHost: false,
  avatarColor: "#ffffff",
  nameEffect: null,
  cardSkin: null,
};

function ctx(over: Partial<AchievementContext>): AchievementContext {
  return {
    player,
    hand: hand(0),
    result: rr("win"),
    playerResults: [],
    dealerUpcard: "2",
    dealerBusted: false,
    chipsAtRoundStart: 100000,
    tableMaxBet: 0,
    progress: defaultProgress(),
    stats: { handsPlayed: 0, handsWon: 0, blackjacks: 0, netWinnings: 0, biggestBet: 0 },
    ...over,
  };
}

describe("High Roller achievement", () => {
  test("unlocks on a win betting the full table max on a >= 25k table", () => {
    assert.equal(check(ctx({ result: rr("win"), hand: hand(25000), tableMaxBet: 25000 })), true);
    assert.equal(check(ctx({ result: rr("win"), hand: hand(50000), tableMaxBet: 50000 })), true);
    assert.equal(check(ctx({ result: rr("blackjack"), hand: hand(30000), tableMaxBet: 30000 })), true);
  });

  test("does not unlock below the 25,000 floor, even at the table max", () => {
    assert.equal(check(ctx({ result: rr("win"), hand: hand(10000), tableMaxBet: 10000 })), false);
  });

  test("does not unlock unless the player bet the full table max", () => {
    assert.equal(check(ctx({ result: rr("win"), hand: hand(25000), tableMaxBet: 50000 })), false);
  });

  test("does not unlock on a loss or a push", () => {
    assert.equal(check(ctx({ result: rr("lose"), hand: hand(50000), tableMaxBet: 50000 })), false);
    assert.equal(check(ctx({ result: rr("push"), hand: hand(50000), tableMaxBet: 50000 })), false);
  });

  test("ignores the player's personal biggest bet (the old bug)", () => {
    // Small table max and bet, but a large career biggestBet must NOT trigger it.
    assert.equal(
      check(
        ctx({
          result: rr("win"),
          hand: hand(500),
          tableMaxBet: 500,
          stats: { handsPlayed: 10, handsWon: 5, blackjacks: 0, netWinnings: 0, biggestBet: 500 },
        })
      ),
      false
    );
  });

  test("floor constant is 25,000", () => {
    assert.equal(HIGH_ROLLER_MIN_BET, 25000);
  });
});
