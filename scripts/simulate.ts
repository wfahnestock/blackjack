#!/usr/bin/env node
/**
 * Blackjack Simulation Script
 *
 * Exercises the REAL game rules with a synchronous game loop driven by basic
 * strategy. Mirrors GameStateMachine as closely as a headless sim can:
 *   - Uses the actual DealerBehaviorEngine (probabilistic dealer) by default,
 *     so the measured player edge reflects what players really experience.
 *   - No-peek: players always act before the dealer's hole card is revealed,
 *     so doubles/splits into a dealer blackjack lose the full extra wager
 *     (matching resolveHandResult in the server).
 *   - Five-Card Charlie auto-win (on by default, matching DEFAULT_SETTINGS).
 *   - 6 decks, 90% penetration, 3:2 blackjacks (all matching constants.ts).
 *
 * Insurance is intentionally never taken: correct basic strategy always
 * declines it, so an insured basic-strategy player would only lower their EV.
 *
 * Usage:
 *   npx tsx scripts/simulate.ts [options]
 *
 * Options:
 *   --hands         <n>   Rounds to simulate            (default: 100000)
 *   --players       <n>   Players per table (1-6)        (default: 3)
 *   --chips         <n>   Starting chips per player      (default: 1000)
 *   --penetration   <f>   Shuffle penetration 0-1        (default: 0.90)
 *   --bjPayout      <f>   Blackjack payout ratio         (default: 1.5)
 *   --bet           <n>   Flat bet amount per hand       (default: 25)
 *   --perfect-dealer      Use the deterministic dealer (hit <17 / soft 17) instead
 *                         of the DealerBehaviorEngine — useful for A/B comparison
 *   --no-charlie          Disable the Five-Card Charlie rule
 */

import { randomUUID } from "crypto";
import {
  getBestValue,
  isBlackjack,
  isBust,
  isSoft,
  canSplit,
  canDouble,
  dealerShouldHit,
} from "../server/HandEvaluator.js";
import { DealerBehaviorEngine } from "../server/DealerBehavior.js";
import type { Card, Hand, HandResult, RoundResult } from "../app/lib/types.js";
import {
  SUITS,
  RANKS,
  RANK_VALUES,
  BLACKJACK_PAYOUT,
  CUT_CARD_PENETRATION,
  DEFAULT_SETTINGS,
} from "../app/lib/constants.js";

// ─── CLI Argument Parsing ─────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, def: number) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] !== undefined ? parseFloat(args[i + 1]) : def;
  };
  const has = (flag: string) => args.includes(flag);
  return {
    hands:         Math.max(1, Math.round(get("--hands",       100_000))),
    players:       Math.max(1, Math.min(6, Math.round(get("--players",   3)))),
    startingChips: Math.max(1, get("--chips",        1_000)),
    penetration:   Math.min(0.99, Math.max(0.1, get("--penetration", CUT_CARD_PENETRATION))),
    bjPayout:      get("--bjPayout",     BLACKJACK_PAYOUT),
    bet:           Math.max(1, get("--bet",          25)),
    perfectDealer: has("--perfect-dealer"),
    fiveCardCharlie: has("--no-charlie") ? false : DEFAULT_SETTINGS.fiveCardCharlie,
  };
}

type Cfg = ReturnType<typeof parseArgs>;

// ─── Sim Deck (configurable penetration) ─────────────────────────────────────

const SHOE_CARDS = SUITS.length * RANKS.length * 6; // 312

class SimDeck {
  private cards: Card[] = [];
  private dealtCount = 0;

  constructor(private readonly cutPenetration: number) {
    this.build();
    this.shuffle();
  }

  private build() {
    this.cards = [];
    for (let d = 0; d < 6; d++)
      for (const suit of SUITS)
        for (const rank of RANKS)
          this.cards.push({ suit, rank, faceDown: false });
    this.dealtCount = 0;
  }

  private shuffle() {
    const a = this.cards;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  deal(faceDown = false): Card {
    if (this.cards.length === 0) { this.build(); this.shuffle(); }
    const card = { ...this.cards.pop()!, faceDown };
    this.dealtCount++;
    return card;
  }

  get needsShuffle() { return this.dealtCount / SHOE_CARDS >= this.cutPenetration; }
  reshuffle() { this.build(); this.shuffle(); }
}

// ─── Hand Factory ─────────────────────────────────────────────────────────────

function makeHand(bet = 0, splitFrom: string | null = null): Hand {
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
    splitFromHandId: splitFrom,
    actionHistory: [],
  };
}

// ─── Result Resolution (faithful to GameStateMachine.resolveHandResult) ────────

/**
 * Mirrors the server's resolveHandResult table exactly, including precedence:
 * a dealer natural beats everything (even a Five-Card Charlie), and the
 * blackjack multiplier honors the configured payout.
 */
function resolveHandResult(
  hand: Hand,
  playerBJ: boolean,
  dealerBJ: boolean,
  dealerValue: number,
  bjPayout: number,
): { result: NonNullable<HandResult>; mult: number } {
  const playerValue = getBestValue(hand.cards);
  const table: [boolean, NonNullable<HandResult>, number][] = [
    [hand.busted,                                   "bust",              0],
    [playerBJ && dealerBJ,                          "push",              1],
    [dealerBJ,                                      "lose",              0],
    [hand.fiveCardCharlie,                          "five-card-charlie", 2],
    [playerBJ,                                      "blackjack",         1 + bjPayout],
    [playerValue > dealerValue || dealerValue > 21, "win",               2],
    [playerValue === dealerValue,                   "push",              1],
    [true,                                          "lose",              0],
  ];
  const [, result, mult] = table.find(([cond]) => cond)!;
  return { result, mult };
}

// ─── Basic Strategy ───────────────────────────────────────────────────────────

/** Returns the dealer's visible up-card value (Ace = 11, face cards = 10). */
function upCardValue(dealerHand: Hand): number {
  const up = dealerHand.cards[0];
  return up ? Math.max(...RANK_VALUES[up.rank]) : 0;
}

function basicStrategy(
  hand: Hand,
  dealerUp: number,
  splitCount: number,
  canAffordSplit: boolean,
  canAffordDouble: boolean,
): "hit" | "stand" | "double" | "split" {
  const { cards } = hand;
  const total = getBestValue(cards);
  const soft  = isSoft(cards);

  // ── Pairs ────────────────────────────────────────────────────────────────
  if (canAffordSplit && canSplit(hand, splitCount)) {
    const pv = RANK_VALUES[cards[0].rank][0];
    if (pv === 1)                                     return "split"; // Always split Aces
    if (pv === 8)                                     return "split"; // Always split 8s
    if (pv === 9 && dealerUp !== 7 && dealerUp < 10)  return "split";
    if (pv === 7 && dealerUp <= 7)                    return "split";
    if (pv === 6 && dealerUp <= 6)                    return "split";
    if (pv === 3 && dealerUp <= 7)                    return "split";
    if (pv === 2 && dealerUp <= 7)                    return "split";
  }

  // ── Doubles ───────────────────────────────────────────────────────────────
  if (canAffordDouble && canDouble(hand)) {
    if (!soft) {
      if (total === 11)                               return "double";
      if (total === 10 && dealerUp <= 9)              return "double";
      if (total === 9  && dealerUp >= 3 && dealerUp <= 6) return "double";
    } else {
      // Soft doubles (A+x)
      if (total === 18 && dealerUp >= 3 && dealerUp <= 6) return "double";
      if (total === 17 && dealerUp >= 3 && dealerUp <= 6) return "double";
      if (total === 16 && dealerUp >= 4 && dealerUp <= 6) return "double";
      if (total === 15 && dealerUp >= 4 && dealerUp <= 6) return "double";
      if (total === 14 && dealerUp >= 5 && dealerUp <= 6) return "double";
      if (total === 13 && dealerUp >= 5 && dealerUp <= 6) return "double";
    }
  }

  // ── Soft hands ────────────────────────────────────────────────────────────
  if (soft) {
    if (total >= 19)  return "stand";
    if (total === 18) return dealerUp >= 9 ? "hit" : "stand";
    return "hit";
  }

  // ── Hard hands ────────────────────────────────────────────────────────────
  if (total >= 17)                                  return "stand";
  if (total >= 13 && dealerUp <= 6)                 return "stand";
  if (total === 12 && dealerUp >= 4 && dealerUp <= 6) return "stand";
  return "hit";
}

// ─── Main Simulation ──────────────────────────────────────────────────────────

function simulate() {
  const cfg = parseArgs();
  const deck = new SimDeck(cfg.penetration);

  // One dealer engine for the whole session so its streak/dampening state
  // evolves exactly as it would at a single live table. Null = perfect dealer.
  const dealerEngine = cfg.perfectDealer ? null : new DealerBehaviorEngine();
  const dealerShouldDraw = (cards: Card[], bestPlayerValue: number) =>
    dealerEngine ? dealerEngine.shouldHit(cards, bestPlayerValue) : dealerShouldHit(cards);

  const chips = Array.from({ length: cfg.players }, () => cfg.startingChips);
  const bankrupted = new Set<number>();

  let handsPlayed       = 0;
  let blackjacks        = 0;
  let fiveCardCharlies  = 0;
  let playerWins        = 0;
  let dealerWins        = 0;
  let pushes            = 0;
  let playerBusts       = 0;
  let dealerBusts       = 0;
  let totalBets         = 0;
  let bankruptcies      = 0;
  let netChips          = 0;
  let dealerBlackjacks  = 0;
  let rounds            = 0;

  for (let round = 0; round < cfg.hands; round++) {
    if (deck.needsShuffle) deck.reshuffle();

    // Active = players who can cover the bet
    const active = chips
      .map((c, i) => ({ i, c }))
      .filter(({ c }) => c >= cfg.bet);

    if (active.length === 0) break;

    // ── Betting ──────────────────────────────────────────────────────────────
    const playerHands: Hand[][] = chips.map(() => []);
    for (const { i } of active) {
      playerHands[i] = [makeHand(cfg.bet)];
      chips[i] -= cfg.bet;
    }

    // ── Dealing: p1, p2…, dealer-up, p1, p2…, dealer-hole ───────────────────
    const dealerHand = makeHand();
    for (const { i } of active) playerHands[i][0].cards.push(deck.deal());
    dealerHand.cards.push(deck.deal());
    for (const { i } of active) playerHands[i][0].cards.push(deck.deal());
    dealerHand.cards.push(deck.deal(true));

    // Reveal hole card for evaluation (no animation delay in sim)
    dealerHand.cards[1].faceDown = false;

    const dealerBJ = isBlackjack(dealerHand);
    if (dealerBJ) dealerBlackjacks++;

    // ── Player Turns (NO-PEEK: players always act, even into a dealer BJ) ─────
    for (const { i } of active) {
      let hi = 0;
      while (hi < playerHands[i].length) {
        const hand = playerHands[i][hi];

        // Auto-stand on 21 (naturals and post-split 21s)
        if (getBestValue(hand.cards) === 21) { hand.stood = true; hi++; continue; }

        const dealerUp = upCardValue(dealerHand);

        while (!hand.stood && !hand.busted) {
          const splitCount = playerHands[i].filter(h => h.splitFromHandId !== null).length;
          const action = basicStrategy(
            hand,
            dealerUp,
            splitCount,
            chips[i] >= hand.bet,
            chips[i] >= hand.bet,
          );

          if (action === "split") {
            chips[i] -= hand.bet;
            const splitCard = hand.cards.pop()!;
            const newHand   = makeHand(hand.bet, hand.handId);
            newHand.cards.push(splitCard);
            hand.cards.push(deck.deal());
            newHand.cards.push(deck.deal());
            playerHands[i].splice(hi + 1, 0, newHand);
            if (getBestValue(hand.cards) === 21) hand.stood = true;
          } else if (action === "double") {
            chips[i] -= hand.bet;
            hand.bet    *= 2;
            hand.doubled = true;
            hand.cards.push(deck.deal());
            hand.busted  = isBust(hand);
            hand.stood   = true;
          } else if (action === "hit") {
            hand.cards.push(deck.deal());
            if (isBust(hand)) {
              hand.busted = true;
            } else if (getBestValue(hand.cards) === 21) {
              hand.stood = true;
            } else if (cfg.fiveCardCharlie && hand.cards.length >= 5) {
              // Five cards without busting → automatic win (matches handleHit)
              hand.fiveCardCharlie = true;
              hand.stood = true;
            }
          } else {
            hand.stood = true;
          }
        }
        hi++;
      }
    }

    // ── Dealer Turn ───────────────────────────────────────────────────────────
    // A dealer natural stands on 21 (no draw). Otherwise the dealer draws only
    // if at least one player hand is still live (not busted, not a blackjack),
    // mirroring startDealerTurn. Bust-bias uses the best live player total.
    if (!dealerBJ) {
      const liveHands = active.flatMap(({ i }) =>
        playerHands[i].filter(h => !h.busted && !isBlackjack(h)));
      if (liveHands.length > 0) {
        const bestPlayerValue = liveHands.reduce(
          (best, h) => Math.max(best, getBestValue(h.cards)), 0);
        while (dealerShouldDraw(dealerHand.cards, bestPlayerValue)) {
          dealerHand.cards.push(deck.deal());
        }
      }
    }

    const dealerValue  = getBestValue(dealerHand.cards);
    const dealerBusted = dealerValue > 21;
    if (dealerBusted) dealerBusts++;

    // ── Payout (mirrors GameStateMachine.startPayout) ─────────────────────────
    const results: RoundResult[] = [];
    for (const { i } of active) {
      for (const hand of playerHands[i]) {
        handsPlayed++;
        totalBets += hand.bet;

        const playerBJ = isBlackjack(hand);
        const { result, mult } = resolveHandResult(hand, playerBJ, dealerBJ, dealerValue, cfg.bjPayout);
        const payout = Math.floor(hand.bet * mult);

        // Tally
        switch (result) {
          case "blackjack":          blackjacks++;       playerWins++; break;
          case "five-card-charlie":  fiveCardCharlies++; playerWins++; break;
          case "win":                playerWins++;                     break;
          case "push":               pushes++;                         break;
          case "bust":               playerBusts++;      dealerWins++; break;
          case "lose":               dealerWins++;                     break;
        }

        hand.result = result;
        chips[i] += payout;
        netChips  += payout - hand.bet;
        results.push({ playerId: String(i), handId: hand.handId, result, payout });
      }

      if (chips[i] < cfg.bet && !bankrupted.has(i)) {
        bankruptcies++;
        bankrupted.add(i);
      }
    }

    // Feed the round outcome back to the dealer engine so its streak tracking,
    // bust-bias and perfect-dampening evolve exactly as in the live game.
    dealerEngine?.recordOutcome(results, dealerValue);

    rounds++;
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const avgBet    = handsPlayed > 0 ? totalBets    / handsPlayed : 0;
  const evPerHand = totalBets   > 0 ? netChips     / totalBets   : 0;
  const bjFreq    = handsPlayed > 0 ? blackjacks   / handsPlayed : 0;
  const charFreq  = handsPlayed > 0 ? fiveCardCharlies / handsPlayed : 0;
  const dbjFreq   = rounds      > 0 ? dealerBlackjacks / rounds  : 0;
  const dbustFreq = rounds      > 0 ? dealerBusts  / rounds      : 0;
  const evPct     = evPerHand * 100;

  const pad = (s: string) => s.padEnd(26);

  console.log("\n─── Blackjack Simulation Results ────────────────────────────────────────");
  console.log(
    `Config  hands=${cfg.hands}  players=${cfg.players}  chips=${cfg.startingChips}` +
    `  penetration=${cfg.penetration}  bjPayout=${cfg.bjPayout}:1  bet=${cfg.bet}`
  );
  console.log(
    `Dealer  ${cfg.perfectDealer ? "PERFECT (deterministic: hit <17 / soft 17)"
                                 : "DealerBehaviorEngine (probabilistic)"}` +
    `   fiveCardCharlie=${cfg.fiveCardCharlie}`
  );
  console.log("─────────────────────────────────────────────────────────────────────────");
  console.log(`${pad("handsPlayed")}  ${handsPlayed.toLocaleString()}`);
  console.log(`${pad("blackjacks")}  ${blackjacks.toLocaleString()}`);
  console.log(`${pad("fiveCardCharlies")}  ${fiveCardCharlies.toLocaleString()}`);
  console.log(`${pad("playerWins")}  ${playerWins.toLocaleString()}`);
  console.log(`${pad("dealerWins")}  ${dealerWins.toLocaleString()}`);
  console.log(`${pad("pushes")}  ${pushes.toLocaleString()}`);
  console.log(`${pad("playerBusts")}  ${playerBusts.toLocaleString()}`);
  console.log(`${pad("dealerBusts")}  ${dealerBusts.toLocaleString()}  (${(dbustFreq * 100).toFixed(2)}% of rounds)`);
  console.log(`${pad("averageBet")}  ${avgBet.toFixed(2)}`);
  console.log(`${pad("bankruptcies")}  ${bankruptcies}`);
  console.log(`${pad("blackjackFrequency")}  ${(bjFreq * 100).toFixed(3)}%`);
  console.log(`${pad("fiveCardCharlieFrequency")}  ${(charFreq * 100).toFixed(3)}%`);
  console.log(`${pad("dealerBlackjackFrequency")}  ${(dbjFreq * 100).toFixed(3)}%`);
  console.log("─────────────────────────────────────────────────────────────────────────");
  console.log(`${pad("EV per hand (player)")}  ${evPerHand.toFixed(4)} chips/unit  (${evPct >= 0 ? "+" : ""}${evPct.toFixed(3)}%)`);
  console.log(
    evPct >= 0
      ? "  → Positive: basic-strategy players profit long-term (house is at a disadvantage)."
      : "  → Negative: the house retains an edge over basic-strategy players."
  );
  console.log("─────────────────────────────────────────────────────────────────────────\n");
}

simulate();
