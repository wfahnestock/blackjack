import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GameStateMachine } from "./GameStateMachine.js";
import { DEFAULT_SETTINGS } from "../app/lib/constants.js";
import type { Player } from "../app/lib/types.js";

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    playerId: id,
    displayName: id,
    seatIndex: 0,
    chips: 1000,
    hands: [],
    status: "connected",
    isHost: false,
    avatarColor: "#ffffff",
    nameEffect: null,
    cardSkin: null,
    ...overrides,
  };
}

/**
 * Runs `fn` with the global timers stubbed out. startBetting/placeBet/startDealing
 * schedule follow-up phase transitions via setTimeout; we only assert the
 * synchronous deal outcome, so we neutralize the timers to keep them from firing
 * (or dangling and keeping the process alive).
 */
function withStubbedTimers<T>(fn: () => T): T {
  const realSet = global.setTimeout;
  const realClear = global.clearTimeout;
  // @ts-expect-error minimal stub for tests
  global.setTimeout = () => 0;
  // @ts-expect-error minimal stub for tests
  global.clearTimeout = () => {};
  try {
    return fn();
  } finally {
    global.setTimeout = realSet;
    global.clearTimeout = realClear;
  }
}

describe("startDealing — disconnected players are not dealt in", () => {
  test("a disconnected player who had placed a bet gets no cards and keeps their chips", () => {
    withStubbedTimers(() => {
      const g = new GameStateMachine("TEST", DEFAULT_SETTINGS, () => {});
      g.addPlayer(makePlayer("alice", { chips: 1000 }));
      g.addPlayer(makePlayer("bob", { chips: 1000 }));

      g.startBetting();          // both get a fresh empty hand, status "betting"
      g.placeBet("alice", 100);
      g.placeBet("bob", 100);
      // Bob disconnects during betting, after placing his bet.
      g.getPlayer("bob")!.status = "disconnected";

      g.startDealing();

      const alice = g.getPlayer("alice")!;
      const bob = g.getPlayer("bob")!;

      // Alice (connected) is dealt two cards and her bet is deducted.
      assert.equal(alice.hands.length, 1);
      assert.equal(alice.hands[0].cards.length, 2);
      assert.equal(alice.chips, 900);

      // Bob (disconnected) is NOT dealt and NOT charged.
      assert.equal(bob.hands.length, 0);
      assert.equal(bob.chips, 1000);

      // Bob still holds his seat (for reconnection) and stays flagged disconnected.
      assert.equal(bob.status, "disconnected");
      assert.ok(g.getPlayer("bob"));

      // The dealer only got the standard two cards for the single active player.
      assert.equal(g.state.dealerHand.cards.length, 2);
    });
  });

  test("a player who disconnects without betting is also skipped", () => {
    withStubbedTimers(() => {
      const g = new GameStateMachine("TEST", DEFAULT_SETTINGS, () => {});
      g.addPlayer(makePlayer("alice", { chips: 500 }));
      g.addPlayer(makePlayer("ghost", { chips: 500 }));

      g.startBetting();
      g.placeBet("alice", 50);
      g.getPlayer("ghost")!.status = "disconnected"; // never bet, then dropped

      g.startDealing();

      assert.equal(g.getPlayer("alice")!.hands[0].cards.length, 2);
      assert.equal(g.getPlayer("ghost")!.hands.length, 0);
      assert.equal(g.getPlayer("ghost")!.chips, 500);
    });
  });
});
