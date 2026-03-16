import { randomUUID } from "crypto";
import type {
  GameState,
  GamePhase,
  Player,
  Hand,
  Card,
  ShoeState,
  RoundResult,
  HandResult,
  GameSettings,
  ActionRecord,
} from "../app/lib/types.js";
import {
  DEFAULT_SETTINGS,
  HILO_VALUES,
  BLACKJACK_PAYOUT,
  INSURANCE_PAYOUT,
  RANK_VALUES,
} from "../app/lib/constants.js";
import { Deck } from "./Deck.js";
import {
  getBestValue,
  isBlackjack,
  isBust,
  isSoft,
  canSplit,
  canDouble,
  dealerShouldHit,
} from "./HandEvaluator.js";
function makeHand(bet = 0): Hand {
  return {
    handId: randomUUID(),
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

/** Builds an ActionRecord snapshot at the moment a player decision is made. */
function recordAction(
  action: ActionRecord["action"],
  hand: Hand,
  dealerUpcard: Card
): void {
  const cards = hand.cards;
  const handValueBefore = getBestValue(cards);
  const isSoftBefore = isSoft(cards);

  // Detect pair: exactly 2 cards with equal point value
  let isPairBefore = false;
  let pairRank: ActionRecord["pairRank"] = null;
  if (cards.length === 2) {
    const v0 = RANK_VALUES[cards[0].rank][0];
    const v1 = RANK_VALUES[cards[1].rank][0];
    if (v0 === v1) {
      isPairBefore = true;
      pairRank = cards[0].rank;
    }
  }

  hand.actionHistory.push({
    action,
    handValueBefore,
    isSoftBefore,
    isPairBefore,
    pairRank,
    dealerUpcard: dealerUpcard.rank,
    cardCountBefore: cards.length,
  });
}

type HandResolution = { result: HandResult; payoutMultiplier: number };

/**
 * Determines the outcome and payout multiplier for a single hand.
 * Multiplier is applied to hand.bet; the caller adds it to chips.
 * Insurance is handled separately before calling this.
 */
function resolveHandResult(
  hand: Hand,
  playerBJ: boolean,
  dealerBJ: boolean,
  dealerValue: number
): HandResolution {
  const playerValue = getBestValue(hand.cards);

  // Each entry is [condition, result, payoutMultiplier].
  // The first matching row wins (order matters).
  const table: [boolean, HandResult, number][] = [
    [hand.busted,                                    "bust",             0],                  // player busted → lost bet
    [playerBJ && dealerBJ,                           "push",             1],                  // both naturals → push
    [dealerBJ,                                       "lose",             0],                  // dealer natural beats all else (including 5CC)
    [hand.fiveCardCharlie,                           "five-card-charlie", 2],                 // 5-card charlie wins (already past dealer BJ check)
    [playerBJ,                                       "blackjack",        1 + BLACKJACK_PAYOUT], // player natural → 3:2
    [playerValue > dealerValue || dealerValue > 21,  "win",              2],                  // player wins
    [playerValue === dealerValue,                    "push",             1],                  // tie → refund
    [true,                                           "lose",             0],                  // fallthrough → player loses
  ];

  // The final [true, ...] row guarantees a match always exists.
  const [, result, payoutMultiplier] = table.find(([cond]) => cond)!;
  return { result, payoutMultiplier };
}

export type BroadcastFn = (event: string, data: unknown) => void;
export type EmitToFn = (socketId: string, event: string, data: unknown) => void;

export class GameStateMachine {
  private deck = new Deck();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private hiLoCount = 0;

  state: GameState;
  onRoundEnd?: (players: Player[], results: RoundResult[]) => void;
  onEvictDisconnected?: (evicted: Player[]) => void;

  constructor(
    roomCode: string,
    settings: GameSettings,
    private broadcast: BroadcastFn
  ) {
    this.state = {
      roomCode,
      phase: "lobby",
      players: [],
      dealerHand: makeHand(),
      shoe: this.getShoeState(),
      activePlayerId: null,
      activeHandId: null,
      phaseEndsAt: null,
      roundNumber: 0,
      settings,
      hiLoCount: null,
    };
  }

  private getShoeState(): ShoeState {
    return {
      totalCards: 312,
      cardsRemaining: this.deck.cardsRemaining,
      penetration: this.deck.penetration,
      shufflePending: this.deck.needsShuffle,
    };
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private sync(): void {
    const state: GameState = {
      ...this.state,
      shoe: this.getShoeState(),
      hiLoCount: this.state.settings.allowCountingHint ? this.hiLoCount : null,
    };
    this.broadcast("state:sync", state);
  }

  private phaseChange(
    phase: GamePhase,
    phaseEndsAt: number | null,
    activePlayerId: string | null,
    activeHandId: string | null
  ): void {
    this.state.phase = phase;
    this.state.phaseEndsAt = phaseEndsAt;
    this.state.activePlayerId = activePlayerId;
    this.state.activeHandId = activeHandId;
    this.broadcast("state:phase-changed", { phase });
  }

  // ─── Player Management ──────────────────────────────────────────────────────

  addPlayer(player: Player): void {
    this.state.players.push(player);
  }

  removePlayer(playerId: string): void {
    this.state.players = this.state.players.filter((p) => p.playerId !== playerId);
  }

  getPlayer(playerId: string): Player | undefined {
    return this.state.players.find((p) => p.playerId === playerId);
  }

  updatePlayer(playerId: string, updates: Partial<Player>): Player | null {
    const idx = this.state.players.findIndex((p) => p.playerId === playerId);
    if (idx === -1) return null;
    this.state.players[idx] = { ...this.state.players[idx], ...updates };
    return this.state.players[idx];
  }

  // ─── Phase: Betting ─────────────────────────────────────────────────────────

  startBetting(): void {
    this.clearTimer();

    // Evict players who were still disconnected when the new round begins.
    // They had until now to reconnect; if they didn't, remove them from the table.
    const evicted = this.state.players.filter((p) => p.status === "disconnected");
    if (evicted.length > 0) {
      this.state.players = this.state.players.filter((p) => p.status !== "disconnected");
      this.onEvictDisconnected?.(evicted);
    }

    // Reset hands for all connected players.
    for (const player of this.state.players) {

      player.hands = [makeHand(0)];
      player.status = "betting";

      // Bankruptcy protection: restore a minimum stake so the player can keep playing.
      if (player.chips === 0 && this.state.settings.bankruptcyProtection) {
        player.chips = 100;
        this.broadcast("game:bankruptcy-relief", { playerId: player.playerId });
      }
    }
    this.state.dealerHand = makeHand();
    this.state.roundNumber++;

    const endsAt = Date.now() + this.state.settings.bettingTimerSeconds * 1000;
    // Set all state fields before syncing so the single state:sync the client receives is
    // already fully consistent: evicted players gone, statuses reset, phase correct.
    // phaseChange() then broadcasts state:phase-changed for sound cues / phase-specific effects.
    this.state.phase = "betting";
    this.state.phaseEndsAt = endsAt;
    this.state.activePlayerId = null;
    this.state.activeHandId = null;
    this.sync();
    this.broadcast("state:phase-changed", { phase: "betting" });

    this.timer = setTimeout(() => {
      this.startDealing();
    }, this.state.settings.bettingTimerSeconds * 1000);
  }

  placeBet(playerId: string, amount: number): void {
    if (this.state.phase !== "betting") return;
    const player = this.getPlayer(playerId);
    if (!player || player.hands.length === 0) return;

    const { minBet, maxBet } = this.state.settings;
    const clamped = Math.max(minBet, Math.min(maxBet, amount));
    if (clamped > player.chips) return;

    player.hands[0].bet = clamped;
    this.broadcast("state:player-updated", player);

    // Once every seated player has bet, shorten the remaining timer to 3 seconds
    const seatedPlayers = this.state.players.filter((p) => p.hands.length > 0);
    const allBet = seatedPlayers.length > 0 && seatedPlayers.every((p) => p.hands[0].bet > 0);
    if (allBet) {
      const shortDelay = 3000;
      const endsAt = Date.now() + shortDelay;
      // Only shorten if there's more than 3 seconds left on the clock
      if (!this.state.phaseEndsAt || this.state.phaseEndsAt > endsAt) {
        this.clearTimer();
        this.state.phaseEndsAt = endsAt;
        this.sync();
        this.timer = setTimeout(() => this.startDealing(), shortDelay);
      }
    }
  }

  // ─── Phase: Dealing ─────────────────────────────────────────────────────────

  startDealing(): void {
    this.clearTimer();
    this.phaseChange("dealing", null, null, null);
    this.sync(); // Broadcast the "dealing" phase immediately so clients can react (e.g. sound)

    // Settle players who didn't bet (or joined after betting started).
    // Disconnected players are left untouched — they hold their seat for reconnection.
    for (const player of this.state.players) {
      if (player.status === "disconnected") continue;

      if (!player.hands.length || player.hands[0].bet === 0) {
        player.status = "sitting-out";
        player.hands = [];
      } else {
        // Deduct bet from chips now
        player.chips -= player.hands[0].bet;
      }
    }

    // Check for shuffle
    if (this.deck.needsShuffle) {
      this.deck.reshuffle();
      this.hiLoCount = 0;
      this.broadcast("game:shuffle", {});
    }

    // Deal: p1, p2, ..., dealer(up), p1, p2, ..., dealer(hole)
    const activePlayers = this.state.players.filter((p) => p.hands.length > 0);
    let delay = 0;
    const DEAL_DELAY = 500;

    const dealCard = (
      target: "dealer" | "player",
      playerId?: string,
      handId?: string,
      faceDown = false
    ) => {
      const card = this.deck.deal(faceDown);
      if (!faceDown) {
        this.hiLoCount += HILO_VALUES[card.rank];
      }

      this.broadcast("game:card-dealt", {
        target,
        playerId,
        handId,
        card,
        delay,
      });

      // Add card to state
      if (target === "dealer") {
        this.state.dealerHand.cards.push(card);
      } else if (playerId && handId) {
        const player = this.getPlayer(playerId);
        if (player) {
          const hand = player.hands.find((h) => h.handId === handId);
          if (hand) hand.cards.push(card);
        }
      }

      delay += DEAL_DELAY;
    };

    // First card to each player
    for (const player of activePlayers) {
      dealCard("player", player.playerId, player.hands[0].handId);
    }
    // Dealer face-up
    dealCard("dealer");

    // Second card to each player
    for (const player of activePlayers) {
      dealCard("player", player.playerId, player.hands[0].handId);
    }
    // Dealer hole card
    dealCard("dealer", undefined, undefined, true);

    // After dealing animation, move to player-turn
    setTimeout(() => {
      this.sync();
      this.startPlayerTurn();
    }, delay + 200);
  }

  // ─── Phase: Player Turn ─────────────────────────────────────────────────────

  startPlayerTurn(): void {
    this.clearTimer();
    const { player, handIdx } = this.findNextActiveHand();

    if (!player) {
      this.startDealerTurn();
      return;
    }

    const hand = player.hands[handIdx];

    // Auto-stand if this hand is already 21 (natural blackjack or 21 after split/initial deal)
    if (getBestValue(hand.cards) === 21) {
      hand.stood = true;
      player.status = "waiting";
      this.broadcast("state:hand-updated", { playerId: player.playerId, hand });
      this.startPlayerTurn(); // recurse to next hand
      return;
    }

    player.status = "acting";

    const endsAt = Date.now() + this.state.settings.turnTimerSeconds * 1000;
    this.phaseChange("player-turn", endsAt, player.playerId, hand.handId);
    this.sync();

    this.timer = setTimeout(() => {
      this.handleStand(player.playerId, hand.handId);
    }, this.state.settings.turnTimerSeconds * 1000);
  }

  private findNextActiveHand(): { player: Player; handIdx: number } | { player: null; handIdx: -1 } {
    for (const player of this.state.players) {
      if (player.status === "disconnected") continue; // never give a disconnected player a turn
      if (player.hands.length === 0) continue;
      for (let i = 0; i < player.hands.length; i++) {
        const hand = player.hands[i];
        if (!hand.stood && !hand.busted) {
          return { player, handIdx: i };
        }
      }
    }
    return { player: null, handIdx: -1 };
  }

  /** Called when a player disconnects while it is their turn. Immediately stands their
   *  active hand and advances rather than waiting for the turn timer to expire. */
  skipDisconnectedTurn(playerId: string): void {
    if (this.state.phase !== "player-turn") return;
    if (this.state.activePlayerId !== playerId) return;

    this.clearTimer();
    const player = this.getPlayer(playerId);
    if (!player) return;
    const hand = player.hands.find((h) => h.handId === this.state.activeHandId);
    if (hand && !hand.stood && !hand.busted) {
      hand.stood = true;
      this.broadcast("state:hand-updated", { playerId, hand });
    }
    this.advanceTurn();
  }

  private advanceTurn(): void {
    this.clearTimer();
    // Mark active player as waiting if all hands done — but never overwrite "disconnected".
    if (this.state.activePlayerId) {
      const player = this.getPlayer(this.state.activePlayerId);
      if (player && player.status !== "disconnected" && player.hands.every((h) => h.stood || h.busted)) {
        player.status = "waiting";
      }
    }
    this.startPlayerTurn();
  }

  private getDealerUpcard(): Card {
    return (
      this.state.dealerHand.cards.find((c) => !c.faceDown) ??
      this.state.dealerHand.cards[0] ??
      ({ rank: "2", suit: "spades", faceDown: false } as Card)
    );
  }

  handleHit(playerId: string, handId: string): void {
    if (this.state.phase !== "player-turn") return;
    if (this.state.activePlayerId !== playerId || this.state.activeHandId !== handId) return;

    const player = this.getPlayer(playerId);
    if (!player) return;
    const hand = player.hands.find((h) => h.handId === handId);
    if (!hand || hand.stood || hand.busted) return;

    recordAction("hit", hand, this.getDealerUpcard());

    const card = this.deck.deal();
    this.hiLoCount += HILO_VALUES[card.rank];
    hand.cards.push(card);

    // No game:card-dealt here — state:hand-updated is the authoritative update.
    // Sending both caused a client-side double-deal due to the setTimeout(0) in onCardDealt
    // firing after state:hand-updated had already added the card.

    if (isBust(hand)) {
      hand.busted = true;
      this.broadcast("state:hand-updated", { playerId, hand });
      this.advanceTurn();
    } else if (getBestValue(hand.cards) === 21) {
      // Auto-stand on 21
      hand.stood = true;
      this.broadcast("state:hand-updated", { playerId, hand });
      this.advanceTurn();
    } else if (this.state.settings.fiveCardCharlie && hand.cards.length >= 5) {
      // 5-card charlie: 5 cards without busting → automatic win
      hand.fiveCardCharlie = true;
      hand.stood = true;
      this.broadcast("state:hand-updated", { playerId, hand });
      this.advanceTurn();
    } else {
      this.broadcast("state:hand-updated", { playerId, hand });
      // Reset timer
      this.clearTimer();
      const endsAt = Date.now() + this.state.settings.turnTimerSeconds * 1000;
      this.state.phaseEndsAt = endsAt;
      this.timer = setTimeout(() => {
        this.handleStand(playerId, handId);
      }, this.state.settings.turnTimerSeconds * 1000);
    }
  }

  handleStand(playerId: string, handId: string): void {
    if (this.state.phase !== "player-turn") return;
    if (this.state.activePlayerId !== playerId || this.state.activeHandId !== handId) return;

    const player = this.getPlayer(playerId);
    if (!player) return;
    const hand = player.hands.find((h) => h.handId === handId);
    if (!hand || hand.busted) return;

    recordAction("stand", hand, this.getDealerUpcard());
    hand.stood = true;
    this.broadcast("state:hand-updated", { playerId, hand });
    this.advanceTurn();
  }

  handleDouble(playerId: string, handId: string): void {
    if (this.state.phase !== "player-turn") return;
    if (this.state.activePlayerId !== playerId || this.state.activeHandId !== handId) return;

    const player = this.getPlayer(playerId);
    if (!player) return;
    const hand = player.hands.find((h) => h.handId === handId);
    if (!hand || !canDouble(hand)) return;
    if (player.chips < hand.bet) return; // not enough chips

    recordAction("double", hand, this.getDealerUpcard());

    // Deduct additional bet
    player.chips -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;

    const card = this.deck.deal();
    this.hiLoCount += HILO_VALUES[card.rank];
    hand.cards.push(card);

    // No game:card-dealt — same double-deal reason as handleHit; state updates come via
    // state:player-updated and state:hand-updated below.

    hand.busted = isBust(hand);
    hand.stood = true; // only one card on double

    this.broadcast("state:player-updated", player);
    this.broadcast("state:hand-updated", { playerId, hand });
    this.advanceTurn();
  }

  handleSplit(playerId: string, handId: string): void {
    if (this.state.phase !== "player-turn") return;
    if (this.state.activePlayerId !== playerId || this.state.activeHandId !== handId) return;

    const player = this.getPlayer(playerId);
    if (!player) return;
    const handIdx = player.hands.findIndex((h) => h.handId === handId);
    if (handIdx === -1) return;

    const hand = player.hands[handIdx];
    const splitCount = player.hands.filter((h) => h.splitFromHandId !== null).length;

    if (!canSplit(hand, splitCount)) return;
    if (player.chips < hand.bet) return;

    recordAction("split", hand, this.getDealerUpcard());

    // Deduct chips for the new hand
    player.chips -= hand.bet;

    // Move second card to a new hand
    const splitCard = hand.cards.pop()!;
    const newHand = makeHand(hand.bet);
    newHand.splitFromHandId = hand.handId;
    newHand.cards.push(splitCard);

    // Deal one card to each hand
    const card1 = this.deck.deal();
    this.hiLoCount += HILO_VALUES[card1.rank];
    hand.cards.push(card1);

    const card2 = this.deck.deal();
    this.hiLoCount += HILO_VALUES[card2.rank];
    newHand.cards.push(card2);

    // Insert new hand after current
    player.hands.splice(handIdx + 1, 0, newHand);

    this.broadcast("state:player-updated", player);

    // Continue with the current hand
    this.clearTimer();
    const endsAt = Date.now() + this.state.settings.turnTimerSeconds * 1000;
    this.state.phaseEndsAt = endsAt;
    this.state.activeHandId = hand.handId;
    this.sync();

    this.timer = setTimeout(() => {
      this.handleStand(player.playerId, hand.handId);
    }, this.state.settings.turnTimerSeconds * 1000);
  }

  // ─── Phase: Dealer Turn ──────────────────────────────────────────────────────

  startDealerTurn(): void {
    this.clearTimer();
    this.phaseChange("dealer-turn", null, null, null);

    // Reveal hole card
    const holeCard = this.state.dealerHand.cards.find((c) => c.faceDown);
    if (holeCard) {
      holeCard.faceDown = false;
      this.hiLoCount += HILO_VALUES[holeCard.rank];
    }

    this.broadcast("state:dealer-updated", this.state.dealerHand);

    // If dealer has blackjack, skip drawing entirely and go straight to payout.
    // Player blackjacks push; all other non-bust hands lose.
    if (isBlackjack(this.state.dealerHand)) {
      setTimeout(() => this.startPayout(), 400);
      return;
    }

    // Check if any player has a hand that needs dealer action
    // (not busted, and not a blackjack — BJs auto-win against a non-BJ dealer)
    const anyActive = this.state.players.some((p) =>
      p.hands.some((h) => !h.busted && !isBlackjack(h))
    );

    if (!anyActive) {
      this.startPayout();
      return;
    }

    // Dealer draws
    let delay = 300;
    const drawDealer = () => {
      if (dealerShouldHit(this.state.dealerHand.cards)) {
        const card = this.deck.deal();
        this.hiLoCount += HILO_VALUES[card.rank];
        this.state.dealerHand.cards.push(card);
        this.broadcast("game:card-dealt", { target: "dealer", card, delay: 0 });
        delay += 600;
        setTimeout(drawDealer, 600);
      } else {
        setTimeout(() => this.startPayout(), 400);
      }
    };

    setTimeout(drawDealer, delay);
  }

  // ─── Phase: Payout ────────────────────────────────────────────────────────────

  startPayout(): void {
    this.clearTimer();
    this.phaseChange("payout", null, null, null);

    const dealerValue = getBestValue(this.state.dealerHand.cards);
    const dealerBJ = isBlackjack(this.state.dealerHand);
    const results: RoundResult[] = [];

    for (const player of this.state.players) {
      for (const hand of player.hands) {
        let payout = 0;

        // Insurance resolution
        if (hand.insuranceBet > 0) {
          if (dealerBJ) {
            payout += hand.insuranceBet * INSURANCE_PAYOUT;
          }
          // Insurance bet already deducted; no refund if dealer doesn't have BJ
        }

        const playerBJ = isBlackjack(hand);
        const { result, payoutMultiplier } = resolveHandResult(hand, playerBJ, dealerBJ, dealerValue);
        payout += Math.floor(hand.bet * payoutMultiplier);

        hand.result = result;
        player.chips += payout;

        results.push({ playerId: player.playerId, handId: hand.handId, result, payout });
      }
      // Don't overwrite the status of players who left mid-round.
      if (player.status !== "disconnected") {
        player.status = "waiting";
      }
      this.broadcast("state:player-updated", player);
    }

    this.broadcast("state:dealer-updated", this.state.dealerHand);
    this.broadcast("game:round-result", results);
    this.sync();

    // Persist chips and stats asynchronously
    this.onRoundEnd?.(this.state.players, results);

    // Auto-advance to cleanup after 5 seconds
    this.timer = setTimeout(() => this.startCleanup(), 5000);
  }

  // ─── Phase: Cleanup ──────────────────────────────────────────────────────────

  startCleanup(): void {
    this.clearTimer();
    this.phaseChange("cleanup", null, null, null);

    // Check shuffle
    if (this.deck.needsShuffle) {
      this.deck.reshuffle();
      this.hiLoCount = 0;
      this.broadcast("game:shuffle", {});
    }

    this.sync();

    // Go back to betting after 1.5s
    this.timer = setTimeout(() => this.startBetting(), 1500);
  }

  destroy(): void {
    this.clearTimer();
  }
}
