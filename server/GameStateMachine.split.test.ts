import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GameStateMachine } from "./GameStateMachine.js";
import { DEFAULT_SETTINGS } from "../app/lib/constants.js";
import { getBestValue, canSplit } from "./HandEvaluator.js";
import type { Card, Hand, Player } from "../app/lib/types.js";

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    playerId: id,
    displayName: id,
    seatIndex: 0,
    chips: 100000,
    hands: [],
    status: "connected",
    isHost: false,
    avatarColor: "#ffffff",
    nameEffect: null,
    cardSkin: null,
    ...overrides,
  };
}

function hand(cards: Card[], overrides: Partial<Hand> = {}): Hand {
  return {
    handId: Math.random().toString(36).slice(2),
    cards,
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

const card = (rank: Card["rank"]): Card => ({ rank, suit: "spades", faceDown: false });

function withStubbedTimers<T>(fn: () => T): T {
  const realSet = global.setTimeout;
  const realClear = global.clearTimeout;
  global.setTimeout = (() => 0) as unknown as typeof global.setTimeout;
  global.clearTimeout = (() => {}) as unknown as typeof global.clearTimeout;
  try {
    return fn();
  } finally {
    global.setTimeout = realSet;
    global.clearTimeout = realClear;
  }
}

/** A machine parked in player-turn with hands we control. */
function machineWithHands(hands: Hand[]) {
  const g = new GameStateMachine("TEST", DEFAULT_SETTINGS, () => {});
  const p = makePlayer("alice", { hands });
  g.addPlayer(p);
  g.state.phase = "player-turn";
  return { g, p };
}

describe("a hand of 21 is never actionable", () => {
  test("startPlayerTurn stands a 21 and moves to the next hand", () => {
    withStubbedTimers(() => {
      const madeTwentyOne = hand([card("A"), card("K")]); // 21
      const playable = hand([card("9"), card("7")]); // 16
      const { g } = machineWithHands([madeTwentyOne, playable]);

      g.startPlayerTurn();

      assert.equal(madeTwentyOne.stood, true, "the 21 hand auto-stands");
      assert.equal(
        g.state.activeHandId,
        playable.handId,
        "play moves to the next hand instead"
      );
    });
  });

  test("a soft 21 is treated the same as a hard 21", () => {
    withStubbedTimers(() => {
      const soft21 = hand([card("A"), card("6"), card("4")]); // A+6+4 = soft 21
      const playable = hand([card("9"), card("7")]);
      const { g } = machineWithHands([soft21, playable]);

      assert.equal(getBestValue(soft21.cards), 21, "sanity: this is a soft 21");
      g.startPlayerTurn();

      assert.equal(soft21.stood, true);
      assert.equal(g.state.activeHandId, playable.handId);
    });
  });

  test("three split hands where two are 21: only the live hand is actionable", () => {
    withStubbedTimers(() => {
      // Mirrors the reported bug: aces split twice, two hands made 21.
      const parent = hand([card("A"), card("K")]); // 21
      const split1 = hand([card("A"), card("Q")], { splitFromHandId: "parent" }); // 21
      const split2 = hand([card("A"), card("5")], { splitFromHandId: "parent" }); // 16, live
      const { g } = machineWithHands([parent, split1, split2]);

      g.startPlayerTurn();

      assert.equal(parent.stood, true, "first 21 stood");
      assert.equal(split1.stood, true, "second 21 stood");
      assert.equal(split2.stood, false, "the 16 is still live");
      assert.equal(g.state.activeHandId, split2.handId, "play lands on the only live hand");
    });
  });

  test("when every hand is 21 the round moves off player turns entirely", () => {
    withStubbedTimers(() => {
      const a = hand([card("A"), card("K")]);
      const b = hand([card("A"), card("Q")], { splitFromHandId: "x" });
      const { g } = machineWithHands([a, b]);

      g.startPlayerTurn();

      assert.equal(a.stood, true);
      assert.equal(b.stood, true);
      assert.notEqual(g.state.phase, "player-turn", "advanced past the player turns");
    });
  });

  test("hitting to 21 also auto-stands (unchanged behaviour)", () => {
    withStubbedTimers(() => {
      const g = new GameStateMachine("TEST", DEFAULT_SETTINGS, () => {});
      g.addPlayer(makePlayer("alice", { chips: 1000 }));
      g.startBetting();
      g.placeBet("alice", 100);
      g.startDealing();
      g.startPlayerTurn();

      // Hit until the hand resolves; it must never sit on a 21 awaiting input.
      for (let i = 0; i < 12; i++) {
        const active = g.state.activePlayerId;
        if (!active || g.state.phase !== "player-turn") break;
        const p = g.getPlayer(active)!;
        const h = p.hands.find((x) => x.handId === g.state.activeHandId)!;
        if (getBestValue(h.cards) === 21) {
          assert.fail("a 21 hand was left active and awaiting input");
        }
        g.handleHit(active, h.handId);
      }
    });
  });
});

describe("splitting never leaves a made 21 actionable", () => {
  test("across many random rounds, the active hand is never 21 after a split", () => {
    withStubbedTimers(() => {
      let splitsPerformed = 0;

      for (let round = 0; round < 400; round++) {
        const g = new GameStateMachine("TEST", DEFAULT_SETTINGS, () => {});
        g.addPlayer(makePlayer("alice", { chips: 100000 }));
        g.startBetting();
        g.placeBet("alice", 100);
        g.startDealing();
        g.startPlayerTurn();

        // Split whenever the rules allow, which is exactly the path that was broken.
        for (let step = 0; step < 8; step++) {
          if (g.state.phase !== "player-turn") break;
          const active = g.state.activePlayerId;
          if (!active) break;
          const p = g.getPlayer(active)!;
          const h = p.hands.find((x) => x.handId === g.state.activeHandId);
          if (!h) break;

          const splitCount = p.hands.filter((x) => x.splitFromHandId !== null).length;
          if (!canSplit(h, splitCount) || p.chips < h.bet) break;

          g.handleSplit(active, h.handId);
          splitsPerformed++;

          // The invariant: whatever hand is now active must not already be 21.
          if (g.state.phase === "player-turn" && g.state.activeHandId) {
            const nowActive = g
              .getPlayer(g.state.activePlayerId!)!
              .hands.find((x) => x.handId === g.state.activeHandId);
            if (nowActive) {
              assert.notEqual(
                getBestValue(nowActive.cards),
                21,
                "a 21 hand was left active after a split"
              );
            }
          }
        }
      }

      assert.ok(splitsPerformed > 0, `the test must actually split (did ${splitsPerformed})`);
    });
  });
});
