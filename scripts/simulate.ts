#!/usr/bin/env node
/**
 * Blackjack Simulation Script
 *
 * Exercises the real HandEvaluator and Deck logic with a synchronous game loop
 * driven by basic strategy. Useful for verifying payouts, EV, and hand frequency.
 *
 * Usage:
 *   npx tsx scripts/simulate.ts [options]
 *
 * Options:
 *   --hands        <n>   Rounds to simulate        (default: 10000)
 *   --players      <n>   Players per table          (default: 3)
 *   --chips        <n>   Starting chips per player  (default: 1000)
 *   --penetration  <f>   Shuffle penetration 0–1   (default: 0.75)
 *   --bjPayout     <f>   Blackjack payout ratio     (default: 1.5)
 *   --bet          <n>   Flat bet amount per hand   (default: 25)
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
import type { Card, Hand } from "../app/lib/types.js";
import { SUITS, RANKS, RANK_VALUES } from "../app/lib/constants.js";

// ─── CLI Argument Parsing ─────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, def: number) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] !== undefined ? parseFloat(args[i + 1]) : def;
  };
  return {
    hands:         Math.max(1, Math.round(get("--hands",        10_000))),
    players:       Math.max(1, Math.min(6, Math.round(get("--players",   3)))),
    startingChips: Math.max(1, get("--chips",        1_000)),
    penetration:   Math.min(0.99, Math.max(0.1, get("--penetration", 0.75))),
    bjPayout:      get("--bjPayout",     1.5),
    bet:           Math.max(1, get("--bet",          25)),
  };
}

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
  if (canDouble(hand)) {
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

  const chips = Array.from({ length: cfg.players }, () => cfg.startingChips);
  const bankrupted = new Set<number>();

  let handsPlayed              = 0;
  let blackjacks               = 0;
  let playerWins               = 0;
  let dealerWins               = 0;
  let pushes                   = 0;
  let playerBusts              = 0;
  let dealerBusts              = 0;
  let totalBets                = 0;
  let bankruptcies             = 0;
  let netChips                 = 0;
  let dealerBlackjacks         = 0;
  let rounds                   = 0;

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

    // ── Player Turns ─────────────────────────────────────────────────────────
    if (!dealerBJ) {
      for (const { i } of active) {
        let hi = 0;
        while (hi < playerHands[i].length) {
          const hand = playerHands[i][hi];

          // Auto-stand on 21
          if (getBestValue(hand.cards) === 21) { hand.stood = true; hi++; continue; }

          const splitCount = playerHands[i].filter(h => h.splitFromHandId !== null).length;
          const dealerUp   = upCardValue(dealerHand);

          while (!hand.stood && !hand.busted) {
            const action = basicStrategy(hand, dealerUp, splitCount, chips[i] >= hand.bet);

            if (action === "split") {
              chips[i] -= hand.bet;
              const splitCard = hand.cards.pop()!;
              const newHand   = makeHand(hand.bet, hand.handId);
              newHand.cards.push(splitCard);
              hand.cards.push(deck.deal());
              newHand.cards.push(deck.deal());
              playerHands[i].splice(hi + 1, 0, newHand);
              // Check auto-stand on current hand after receiving new card
              if (getBestValue(hand.cards) === 21) { hand.stood = true; }
            } else if (action === "double") {
              chips[i] -= hand.bet;
              hand.bet    *= 2;
              hand.doubled = true;
              hand.cards.push(deck.deal());
              hand.busted  = isBust(hand);
              hand.stood   = true;
            } else if (action === "hit") {
              hand.cards.push(deck.deal());
              if      (isBust(hand))                     hand.busted = true;
              else if (getBestValue(hand.cards) === 21)  hand.stood  = true;
            } else {
              hand.stood = true;
            }
          }
          hi++;
        }
      }
    }

    // ── Dealer Turn ───────────────────────────────────────────────────────────
    if (!dealerBJ) {
      const anyLive = active.some(({ i }) =>
        playerHands[i].some(h => !h.busted && !isBlackjack(h))
      );
      if (anyLive) {
        while (dealerShouldHit(dealerHand.cards)) {
          dealerHand.cards.push(deck.deal());
        }
      }
    }

    const dealerValue  = getBestValue(dealerHand.cards);
    const dealerBusted = dealerValue > 21;
    if (dealerBusted) dealerBusts++;

    // ── Payout (mirrors GameStateMachine.startPayout exactly) ─────────────────
    for (const { i } of active) {
      for (const hand of playerHands[i]) {
        handsPlayed++;
        totalBets += hand.bet;

        let payout = 0;

        if (hand.busted) {
          playerBusts++;
          dealerWins++;
        } else if (dealerBJ && isBlackjack(hand)) {
          // Both naturals → push
          pushes++;
          payout = hand.bet;
        } else if (dealerBJ) {
          dealerWins++;
        } else if (isBlackjack(hand)) {
          blackjacks++;
          playerWins++;
          payout += hand.bet * (1 + cfg.bjPayout);
        } else {
          const playerValue = getBestValue(hand.cards);
          if (playerValue > dealerValue || dealerBusted) {
            playerWins++;
            payout = hand.bet * 2;
          } else if (playerValue === dealerValue) {
            pushes++;
            payout = hand.bet; // refund
          } else {
            dealerWins++;
          }
        }

        chips[i] += payout;
        netChips  += payout - hand.bet;
      }

      // Track first bankruptcy
      if (chips[i] < cfg.bet && !bankrupted.has(i)) {
        bankruptcies++;
        bankrupted.add(i);
      }
    }

    rounds++;
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const avgBet    = handsPlayed > 0 ? totalBets    / handsPlayed : 0;
  const evPerHand = totalBets   > 0 ? netChips     / totalBets   : 0;
  const bjFreq    = handsPlayed > 0 ? blackjacks   / handsPlayed : 0;
  const dbjFreq   = rounds      > 0 ? dealerBlackjacks / rounds  : 0;
  const evPct     = evPerHand * 100;

  const pad = (s: string) => s.padEnd(25);

  console.log("\n─── Blackjack Simulation Results ────────────────────────────────────────");
  console.log(
    `Config  hands=${cfg.hands}  players=${cfg.players}  chips=${cfg.startingChips}` +
    `  penetration=${cfg.penetration}  bjPayout=${cfg.bjPayout}:1  bet=${cfg.bet}`
  );
  console.log("─────────────────────────────────────────────────────────────────────────");
  console.log(`${pad("handsPlayed")}  ${handsPlayed.toLocaleString()}`);
  console.log(`${pad("blackjacks")}  ${blackjacks.toLocaleString()}`);
  console.log(`${pad("playerWins")}  ${playerWins.toLocaleString()}`);
  console.log(`${pad("dealerWins")}  ${dealerWins.toLocaleString()}`);
  console.log(`${pad("pushes")}  ${pushes.toLocaleString()}`);
  console.log(`${pad("playerBusts")}  ${playerBusts.toLocaleString()}`);
  console.log(`${pad("dealerBusts")}  ${dealerBusts.toLocaleString()}`);
  console.log(`${pad("averageBet")}  ${avgBet.toFixed(2)}`);
  console.log(`${pad("bankruptcies")}  ${bankruptcies}`);
  console.log(`${pad("EV_per_hand")}  ${evPerHand.toFixed(4)} chips  (${evPct.toFixed(3)}%)`);
  console.log(`${pad("blackjackFrequency")}  ${(bjFreq * 100).toFixed(3)}%`);
  console.log(`${pad("dealerBlackjackFrequency")}  ${(dbjFreq * 100).toFixed(3)}%`);
  console.log("─────────────────────────────────────────────────────────────────────────\n");
}

simulate();
