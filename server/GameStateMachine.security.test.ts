import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GameStateMachine, redactHand } from "./GameStateMachine.js";
import { DEFAULT_SETTINGS } from "../app/lib/constants.js";
import type { Card, Player } from "../app/lib/types.js";

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

/** Captures everything the machine broadcasts so we can inspect the wire. */
function recordingMachine() {
  const sent: { event: string; data: any }[] = [];
  const g = new GameStateMachine("TEST", DEFAULT_SETTINGS, (event, data) =>
    sent.push({ event, data })
  );
  return { g, sent };
}

/** Any card that still carries a real identity while marked face-down. */
function leaksHoleCard(cards: Card[] | undefined): boolean {
  if (!cards) return false;
  // The redacted placeholder is always the 2 of spades; a face-down card that
  // is anything else means the real card went out.
  return cards.some((c) => c.faceDown && !(c.rank === "2" && c.suit === "spades"));
}

describe("dealer hole card is never sent to clients", () => {
  test("redactHand strips the identity of face-down cards only", () => {
    const hand = {
      handId: "h",
      cards: [
        { rank: "K", suit: "hearts", faceDown: false } as Card,
        { rank: "A", suit: "clubs", faceDown: true } as Card,
      ],
      bet: 0,
      doubled: false,
      stood: false,
      busted: false,
      fiveCardCharlie: false,
      result: null,
      insuranceBet: 0,
      splitFromHandId: null,
      actionHistory: [],
    };

    const safe = redactHand(hand);
    assert.equal(safe.cards[0].rank, "K", "face-up card is untouched");
    assert.equal(safe.cards[0].suit, "hearts");
    assert.equal(safe.cards[1].faceDown, true, "still marked face-down for rendering");
    assert.notEqual(safe.cards[1].rank + safe.cards[1].suit, "Aclubs", "identity is gone");

    // The original must not be mutated — the server still needs the real card.
    assert.equal(hand.cards[1].rank, "A");
    assert.equal(hand.cards[1].suit, "clubs");
  });

  test("no broadcast during dealing carries the real hole card", () => {
    withStubbedTimers(() => {
      const { g, sent } = recordingMachine();
      g.addPlayer(makePlayer("alice"));
      g.startBetting();
      g.placeBet("alice", 100);
      g.startDealing();

      // The server's own state must still know the real card.
      const holeCard = g.state.dealerHand.cards.find((c) => c.faceDown);
      assert.ok(holeCard, "dealer has a face-down card in server state");

      for (const { event, data } of sent) {
        if (event === "game:card-dealt" && data.card?.faceDown) {
          assert.equal(
            leaksHoleCard([data.card]),
            false,
            "game:card-dealt leaked the hole card"
          );
        }
        if (event === "state:sync") {
          assert.equal(
            leaksHoleCard(data.dealerHand?.cards),
            false,
            "state:sync leaked the hole card"
          );
        }
        if (event === "state:dealer-updated") {
          assert.equal(leaksHoleCard(data?.cards), false, "dealer-updated leaked the hole card");
        }
      }
    });
  });

  test("publicState redacts while state stays authoritative", () => {
    withStubbedTimers(() => {
      const { g } = recordingMachine();
      g.addPlayer(makePlayer("alice"));
      g.startBetting();
      g.placeBet("alice", 100);
      g.startDealing();

      assert.equal(leaksHoleCard(g.publicState().dealerHand.cards), false);
      assert.equal(
        g.state.dealerHand.cards.some((c) => c.faceDown),
        true,
        "server keeps the real face-down card"
      );
    });
  });
});

describe("placeBet input validation", () => {
  function seated() {
    const { g } = recordingMachine();
    g.addPlayer(makePlayer("alice", { chips: 1000 }));
    g.startBetting();
    return g;
  }

  test("NaN is rejected instead of poisoning the balance", () => {
    withStubbedTimers(() => {
      const g = seated();
      g.placeBet("alice", NaN);
      assert.equal(g.getPlayer("alice")!.hands[0].bet, 0);

      g.startDealing();
      assert.equal(Number.isNaN(g.getPlayer("alice")!.chips), false, "chips must not be NaN");
      assert.equal(g.getPlayer("alice")!.chips, 1000, "no bet was taken");
    });
  });

  test("Infinity and fractional amounts are rejected", () => {
    withStubbedTimers(() => {
      const g = seated();
      for (const bad of [Infinity, -Infinity, 10.5, -50]) {
        g.placeBet("alice", bad);
        assert.equal(g.getPlayer("alice")!.hands[0].bet, 0, `${bad} should be rejected`);
      }
    });
  });

  test("0 clears the bet rather than being forced up to minBet", () => {
    withStubbedTimers(() => {
      const g = seated();
      g.placeBet("alice", 100);
      assert.equal(g.getPlayer("alice")!.hands[0].bet, 100);

      g.placeBet("alice", 0);
      assert.equal(g.getPlayer("alice")!.hands[0].bet, 0, "player can sit the round out");
    });
  });

  test("valid bets still clamp to the table limits", () => {
    withStubbedTimers(() => {
      const g = seated();
      g.placeBet("alice", 1); // below minBet (5)
      assert.equal(g.getPlayer("alice")!.hands[0].bet, DEFAULT_SETTINGS.minBet);

      g.placeBet("alice", 500);
      assert.equal(g.getPlayer("alice")!.hands[0].bet, 500);
    });
  });

  test("a bet larger than the player's chips is refused", () => {
    withStubbedTimers(() => {
      const g = seated();
      g.placeBet("alice", 5000);
      assert.equal(g.getPlayer("alice")!.hands[0].bet, 0);
    });
  });
});

describe("timer cleanup", () => {
  test("destroy() cancels pending work so nothing fires on a dead machine", async () => {
    const { g, sent } = recordingMachine();
    g.addPlayer(makePlayer("alice"));
    g.startBetting(); // schedules the betting timer
    g.placeBet("alice", 100);
    g.startDealing(); // schedules the deal-completion callback

    g.destroy();
    const countAtDestroy = sent.length;

    // Wait past every delay the deal path would have used.
    await new Promise((r) => setTimeout(r, 250));

    assert.equal(
      sent.length,
      countAtDestroy,
      "a destroyed machine must not broadcast from pending timers"
    );
  });
});
