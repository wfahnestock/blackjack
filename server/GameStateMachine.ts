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
  INSURANCE_TIMER_SECONDS,
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
import { DealerBehaviorEngine } from "./DealerBehavior.js";
import { log } from "./logger.js";
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

/**
 * Placeholder identity for a face-down card.
 *
 * `faceDown` is only a rendering hint — the client draws a card back and its
 * hand-value helpers skip face-down cards entirely. Sending the real rank and
 * suit therefore adds nothing visually while letting anyone with devtools open
 * read the dealer's hole card before they act, which makes insurance a free
 * decision and basic strategy meaningless. The server keeps the real card in
 * its own state; only the outbound copy is stripped.
 */
const HIDDEN_CARD: Card = { rank: "2", suit: "spades", faceDown: true };

/**
 * Returns a copy of the hand safe to send to clients.
 *
 * Always copies, even when nothing is face-down. Returning the live array when
 * there was nothing to hide meant the emitted object aliased `this.state`, so a
 * card pushed a moment later showed up inside an already-"sent" payload. The
 * transport happens to serialize immediately, but nothing should depend on that.
 */
export function redactHand(hand: Hand): Hand {
  return {
    ...hand,
    cards: hand.cards.map((c) => (c.faceDown ? { ...HIDDEN_CARD } : { ...c })),
  };
}

type HandResolution = { result: HandResult; payoutMultiplier: number };

/**
 * Determines the outcome and payout multiplier for a single hand.
 * Multiplier is applied to hand.bet; the caller adds it to chips.
 * Insurance is handled separately before calling this.
 */
export function resolveHandResult(
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
  /**
   * Every pending timeout, not just the current phase timer.
   *
   * A single handle used to be tracked, which meant the deal-completion
   * callback, the dealer-draw recursion and the payout delays were all
   * invisible to clearTimers()/destroy(). Destroying a room mid-deal left those
   * firing against a dead machine, mutating state and broadcasting into a
   * closed room — and every `clearTimer()` call site read as "all pending work
   * cancelled" when it wasn't.
   */
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private destroyed = false;
  private hiLoCount = 0;
  private behavior = new DealerBehaviorEngine();
  // Insurance offer tracking (only populated during the "insurance" phase).
  private insuranceEligible = new Set<string>();
  private insuranceResponses = new Set<string>();

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
      dealerCardSkin: null,
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

  /**
   * Schedules work on this machine. All timeouts must go through here so they
   * can be cancelled wholesale. The callback is skipped entirely if the machine
   * was destroyed while it was pending.
   */
  private schedule(fn: () => void, ms: number): void {
    const handle = setTimeout(() => {
      this.timers.delete(handle);
      if (this.destroyed) return;
      fn();
    }, ms);
    this.timers.add(handle);
  }

  /**
   * Cancels every pending timeout. Called on each phase transition, so stale
   * callbacks from the previous phase (a half-finished dealer draw, say) can't
   * fire into the new one.
   */
  private clearTimer(): void {
    for (const handle of this.timers) {
      clearTimeout(handle);
    }
    this.timers.clear();
  }

  /**
   * The state as clients are allowed to see it: face-down cards have their
   * identity stripped, and the shoe/count are recomputed.
   *
   * Every outbound state broadcast must go through this. `this.state` is
   * server-authoritative and still holds the real hole card.
   */
  publicState(): GameState {
    return {
      ...this.state,
      dealerHand: redactHand(this.state.dealerHand),
      shoe: this.getShoeState(),
      hiLoCount: this.state.settings.allowCountingHint ? this.hiLoCount : null,
    };
  }

  private sync(): void {
    this.broadcast("state:sync", this.publicState());
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

    this.schedule(() => {
      this.startDealing();
    }, this.state.settings.bettingTimerSeconds * 1000);
  }

  placeBet(playerId: string, amount: number): void {
    if (this.state.phase !== "betting") return;
    const player = this.getPlayer(playerId);
    if (!player || player.hands.length === 0) return;

    // Validate before clamping. Math.min/max propagate NaN silently, so an
    // amount of NaN survived the `> chips` guard (NaN comparisons are false)
    // and poisoned hand.bet — from there chips went NaN at deduction and stayed
    // NaN through payout and persistence. Fractional amounts had the same shape.
    const { minBet, maxBet } = this.state.settings;
    if (!Number.isInteger(amount) || amount < 0) return;

    // 0 clears the bet so the player can sit the round out. Clamping it up to
    // minBet would force them into a wager they explicitly cancelled.
    let next: number;
    if (amount === 0) {
      next = 0;
    } else {
      next = Math.max(minBet, Math.min(maxBet, amount));
      if (next > player.chips) return;
    }

    player.hands[0].bet = next;
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
        this.schedule(() => this.startDealing(), shortDelay);
      }
    }
  }

  // ─── Phase: Dealing ─────────────────────────────────────────────────────────

  startDealing(): void {
    this.clearTimer();
    this.phaseChange("dealing", null, null, null);
    this.sync(); // Broadcast the "dealing" phase immediately so clients can react (e.g. sound)

    // Settle players who didn't bet (or joined after betting started).
    for (const player of this.state.players) {
      // A player who disconnected during betting keeps their seat for a possible
      // reconnection, but must NOT be dealt in this round. Clear their hand so
      // they're excluded from the deal below; their pending bet hasn't been
      // deducted yet, so voiding the hand costs them nothing. Their status stays
      // "disconnected" so the client keeps showing them until they're evicted at
      // the next startBetting.
      if (player.status === "disconnected") {
        player.hands = [];
        continue;
      }

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
      log.info("game", `${this.state.roomCode} shoe reshuffled`);
    }

    // Deal: p1, p2, ..., dealer(up), p1, p2, ..., dealer(hole)
    const activePlayers = this.state.players.filter(
      (p) => p.hands.length > 0 && p.status !== "disconnected"
    );
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
        // Never put the hole card on the wire; the client only draws a back.
        // It arrives for real via state:dealer-updated when startDealerTurn
        // flips it.
        card: faceDown ? { ...HIDDEN_CARD } : card,
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

    // After dealing animation, offer insurance if the dealer shows an Ace,
    // otherwise move straight to the player turns.
    this.schedule(() => {
      this.sync();
      this.maybeOfferInsurance();
    }, delay + 200);
  }

  // ─── Phase: Insurance ────────────────────────────────────────────────────────

  /**
   * If the dealer's upcard is an Ace and at least one player can afford it,
   * open an insurance window. Otherwise proceed directly to the player turns.
   * This is a no-peek implementation: the dealer's hole card is still revealed
   * at dealer-turn, and insurance is settled in startPayout (which already
   * pays 2:1 on insuranceBet when the dealer has blackjack).
   */
  private maybeOfferInsurance(): void {
    this.insuranceEligible = new Set();
    this.insuranceResponses = new Set();

    if (this.getDealerUpcard().rank !== "A") {
      this.startPlayerTurn();
      return;
    }

    for (const player of this.state.players) {
      if (player.status === "disconnected") continue;
      const hand = player.hands[0];
      if (!hand || hand.bet <= 0) continue;
      const cost = Math.floor(hand.bet / 2);
      if (cost > 0 && player.chips >= cost) {
        this.insuranceEligible.add(player.playerId);
      }
    }

    if (this.insuranceEligible.size === 0) {
      this.startPlayerTurn();
      return;
    }

    this.startInsurance();
  }

  private startInsurance(): void {
    this.clearTimer();
    const endsAt = Date.now() + INSURANCE_TIMER_SECONDS * 1000;
    this.phaseChange("insurance", endsAt, null, null);
    this.sync();

    this.schedule(() => this.finishInsurance(), INSURANCE_TIMER_SECONDS * 1000);
  }

  handleInsurance(playerId: string, take: boolean): void {
    if (this.state.phase !== "insurance") return;
    if (!this.insuranceEligible.has(playerId)) return;
    if (this.insuranceResponses.has(playerId)) return;

    const player = this.getPlayer(playerId);
    if (!player) return;
    const hand = player.hands[0];
    if (!hand) return;

    if (take) {
      const cost = Math.floor(hand.bet / 2);
      if (cost > 0 && player.chips >= cost) {
        player.chips -= cost;
        hand.insuranceBet = cost;
        this.broadcast("state:player-updated", player);
      }
    }

    this.insuranceResponses.add(playerId);

    // Advance as soon as every eligible player has answered.
    const allResponded = [...this.insuranceEligible].every((id) =>
      this.insuranceResponses.has(id)
    );
    if (allResponded) this.finishInsurance();
  }

  private finishInsurance(): void {
    this.clearTimer();
    this.insuranceEligible = new Set();
    this.insuranceResponses = new Set();
    this.startPlayerTurn();
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

    this.schedule(() => {
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

  /**
   * Called after a player is removed from the table outright; a staff kick, or
   * a voluntary leave mid-round.
   *
   * Without this the round hangs: activePlayerId still points at someone who is
   * no longer in state, so the turn timer eventually fires handleStand() for a
   * player getPlayer() can't find, that returns early, and the turn never
   * advances. Everyone else is stuck staring at a dead table.
   */
  handlePlayerRemoved(playerId: string): void {
    if (this.state.phase !== "player-turn") return;
    if (this.state.activePlayerId !== playerId) return;

    this.clearTimer();
    // Clear first so advanceTurn() doesn't try to update the departed player.
    this.state.activePlayerId = null;
    this.state.activeHandId = null;
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
      this.schedule(() => {
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

    // Hand control back to startPlayerTurn instead of re-arming the turn timer
    // here. It owns the auto-stand-on-21 rule, so splitting into a made 21
    // (aces against a ten, most often) now stands that hand and moves to the
    // next one. Re-arming inline skipped that check and let the player draw to
    // a hand that was already 21.
    //
    // findNextActiveHand() lands back on this same hand when it's still live,
    // because every earlier hand has already stood or busted.
    this.startPlayerTurn();
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

    this.broadcast("state:dealer-updated", redactHand(this.state.dealerHand));

    // If dealer has blackjack, skip drawing entirely and go straight to payout.
    // Player blackjacks push; all other non-bust hands lose.
    if (isBlackjack(this.state.dealerHand)) {
      this.schedule(() => this.startPayout(), 400);
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
    const bestPlayerValue = this.getBestActivePlayerValue();
    let delay = 300;
    const drawDealer = () => {
      if (this.behavior.shouldHit(this.state.dealerHand.cards, bestPlayerValue)) {
        const card = this.deck.deal();
        this.hiLoCount += HILO_VALUES[card.rank];
        this.state.dealerHand.cards.push(card);
        this.broadcast("game:card-dealt", { target: "dealer", card, delay: 0 });
        delay += 600;
        this.schedule(drawDealer, 600);
      } else {
        this.schedule(() => this.startPayout(), 400);
      }
    };

    this.schedule(drawDealer, delay);
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

        // Insurance resolution. Payouts here use the total-return convention
        // (stake is returned alongside winnings, since the stake was pre-deducted).
        // A 2:1 insurance win therefore returns the stake plus INSURANCE_PAYOUT×stake,
        // which exactly offsets losing the main bet to a dealer blackjack.
        if (hand.insuranceBet > 0) {
          if (dealerBJ) {
            payout += hand.insuranceBet + hand.insuranceBet * INSURANCE_PAYOUT;
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

    this.broadcast("state:dealer-updated", redactHand(this.state.dealerHand));
    this.broadcast("game:round-result", results);
    this.sync();

    // Update streak/outcome tracking before persisting so data is current.
    this.behavior.recordOutcome(results, getBestValue(this.state.dealerHand.cards));

    // Persist chips and stats asynchronously
    this.onRoundEnd?.(this.state.players, results);

    // Auto-advance to cleanup after 5 seconds
    this.schedule(() => this.startCleanup(), 5000);
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
    this.schedule(() => this.startBetting(), 1500);
  }

  /** Returns the highest non-busted player hand value currently at the table. */
  private getBestActivePlayerValue(): number {
    let best = 0;
    for (const player of this.state.players) {
      for (const hand of player.hands) {
        if (!hand.busted) {
          const v = getBestValue(hand.cards);
          if (v > best) best = v;
        }
      }
    }
    return best;
  }

  destroy(): void {
    // Set first: anything already inside a timer callback that re-schedules
    // will be stopped by the guard in schedule() rather than re-arming.
    this.destroyed = true;
    this.clearTimer();
  }
}
