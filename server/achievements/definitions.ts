import type { Hand, Player, RoundResult, AchievementCategory } from "../../app/lib/types.js";
import { RANK_VALUES } from "../../app/lib/constants.js";
import { getBestValue, isSoft, isBlackjack } from "../HandEvaluator.js";
import { getCorrectAction, isMistake } from "./basicStrategy.js";

// ─── Progress State ───────────────────────────────────────────────────────────

export interface AchievementProgress {
  currentWinStreak: number;
  currentLossStreak: number;
  lastWinWasDouble: boolean;
  consecutiveDoubleWins: number;
  // Back from the Dead: "idle" = accumulating losses toward 5,
  // "building-wins" = had 5 consecutive losses, now accumulating wins
  backFromDeadPhase: "idle" | "building-wins";
  backFromDeadLossCount: number;
  backFromDeadWinCount: number;
  // Perfect Play: wins in a row with no BS mistake
  perfectPlayStreak: number;
  // This Table Is Cursed: consecutive busted hands
  currentBustStreak: number;
}

export function defaultProgress(): AchievementProgress {
  return {
    currentWinStreak: 0,
    currentLossStreak: 0,
    lastWinWasDouble: false,
    consecutiveDoubleWins: 0,
    backFromDeadPhase: "idle",
    backFromDeadLossCount: 0,
    backFromDeadWinCount: 0,
    perfectPlayStreak: 0,
    currentBustStreak: 0,
  };
}

// ─── Context passed to every achievement check ────────────────────────────────

export interface AchievementContext {
  player: Player;
  hand: Hand;
  result: RoundResult;
  /** All round results for this player (used by cross-hand achievement checks). */
  playerResults: RoundResult[];
  dealerUpcard: string;
  dealerBusted: boolean;
  /** Chips the player had at the start of this round (before any bets were placed). */
  chipsAtRoundStart: number;
  progress: AchievementProgress;
  stats: {
    handsPlayed: number;
    handsWon: number;
    blackjacks: number;
    netWinnings: number;
    biggestBet: number;
  };
}

// ─── Achievement definition ───────────────────────────────────────────────────

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  check: (ctx: AchievementContext) => boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isWin(result: RoundResult["result"]) {
  return result === "win" || result === "blackjack" || result === "five-card-charlie";
}

function dealerUpcardValue(rank: string): number {
  if (rank === "A") return 11;
  const v = RANK_VALUES[rank as keyof typeof RANK_VALUES]?.[0] ?? 0;
  return Math.min(v, 10);
}

/** Check whether any action in actionHistory was a basic strategy mistake. */
export function handHadMistake(hand: Hand): boolean {
  for (const rec of hand.actionHistory) {
    const canDoubleNow = rec.cardCountBefore === 2;
    const correct = getCorrectAction(
      rec.handValueBefore,
      rec.isSoftBefore,
      rec.isPairBefore,
      rec.pairRank,
      rec.dealerUpcard,
      canDoubleNow,
      rec.action === "split"
    );
    if (isMistake(rec.action, correct)) return true;
  }
  return false;
}

// ─── Category metadata (for display order + labels) ──────────────────────────

export const CATEGORY_META: Record<AchievementCategory, { label: string; icon: string }> = {
  skill:    { label: "Skill",    icon: "fa-graduation-cap" },
  streak:   { label: "Streak",   icon: "fa-fire" },
  gambler:  { label: "Gambler",  icon: "fa-dice" },
  rare:     { label: "Rare",     icon: "fa-diamond" },
  comeback: { label: "Comeback", icon: "fa-heart-pulse" },
  meta:     { label: "Meta",     icon: "fa-chart-line" },
  funny:    { label: "Funny",    icon: "fa-face-laugh" },
};

export const CATEGORY_ORDER: AchievementCategory[] = [
  "skill", "streak", "gambler", "rare", "comeback", "meta", "funny",
];

// ─── Achievement Definitions ──────────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDef[] = [

  // ── Skill ─────────────────────────────────────────────────────────────────

  {
    id: "perfect_play",
    name: "Perfect Play",
    description: "Win 10 hands in a row without making a basic strategy mistake.",
    icon: "fa-brain",
    category: "skill",
    check: ({ progress }) => progress.perfectPlayStreak >= 10,
  },

  {
    id: "stand_your_ground",
    name: "Stand Your Ground",
    description: "Stand on 12 or 13 vs a dealer 10 and win.",
    icon: "fa-shield-halved",
    category: "skill",
    check: ({ hand, result }) => {
      if (!isWin(result.result)) return false;
      return hand.actionHistory.some(
        (a) =>
          a.action === "stand" &&
          (a.handValueBefore === 12 || a.handValueBefore === 13) &&
          dealerUpcardValue(a.dealerUpcard) === 10
      );
    },
  },

  {
    id: "ace_whisperer",
    name: "Ace Whisperer",
    description: "Improve a soft hand to a winning total of 20 or 21.",
    icon: "fa-wand-magic",
    category: "skill",
    check: ({ hand, result }) =>
      isWin(result.result) &&
      !isBlackjack(hand) &&
      (getBestValue(hand.cards) === 20 || getBestValue(hand.cards) === 21) &&
      // At some point in the hand the player had a soft total below 20 and acted on it
      hand.actionHistory.some((a) => a.isSoftBefore && a.handValueBefore < 20),
  },

  {
    id: "smart_split",
    name: "Smart Splitter",
    description: "Split Aces or 8s and win at least one of the resulting hands.",
    icon: "fa-code-branch",
    category: "skill",
    check: ({ player, result }) => {
      if (!isWin(result.result)) return false;
      const thisHand = player.hands.find((h) => h.handId === result.handId);
      if (!thisHand?.splitFromHandId) return false;
      // Find the original hand that was split
      const parentHandId = thisHand.splitFromHandId;
      const parentHand = player.hands.find((h) => h.handId === parentHandId);
      if (!parentHand) return false;
      // Verify the split was Aces or 8s
      const splitAction = parentHand.actionHistory.find((a) => a.action === "split");
      if (!splitAction?.isPairBefore || !splitAction.pairRank) return false;
      const pv = RANK_VALUES[splitAction.pairRank][0];
      return pv === 1 || pv === 8; // Ace (value 1) or 8s
    },
  },

  // ── Streak ────────────────────────────────────────────────────────────────

  {
    id: "win_streak_3",
    name: "On a Roll",
    description: "Win 3 hands in a row.",
    icon: "fa-arrow-trend-up",
    category: "streak",
    check: ({ progress }) => progress.currentWinStreak >= 3,
  },

  {
    id: "win_streak_5",
    name: "On Fire",
    description: "Win 5 hands in a row.",
    icon: "fa-fire-flame-curved",
    category: "streak",
    check: ({ progress }) => progress.currentWinStreak >= 5,
  },

  {
    id: "win_streak_10",
    name: "Unstoppable",
    description: "Win 10 hands in a row.",
    icon: "fa-trophy",
    category: "streak",
    check: ({ progress }) => progress.currentWinStreak >= 10,
  },

  {
    id: "double_trouble",
    name: "Double Trouble",
    description: "Win two doubled hands in a row.",
    icon: "fa-2",
    category: "streak",
    check: ({ progress }) => progress.consecutiveDoubleWins >= 2,
  },

  // ── Gambler ───────────────────────────────────────────────────────────────

  {
    id: "miracle_draw",
    name: "Miracle Draw",
    description: "Hit exactly to 21 using five cards.",
    icon: "fa-wand-sparkles",
    category: "gambler",
    check: ({ hand, result }) =>
      isWin(result.result) &&
      hand.cards.length === 5 &&
      getBestValue(hand.cards) === 21,
  },

  {
    id: "split_personality",
    name: "Split Personality",
    description: "Split a hand and win with every resulting hand.",
    icon: "fa-people-arrows",
    category: "gambler",
    check: ({ player, playerResults }) => {
      const hasSplit = player.hands.some((h) => h.splitFromHandId !== null);
      if (!hasSplit || player.hands.length < 2) return false;
      // Every hand this player played must have been a win
      return player.hands.every((h) => {
        const r = playerResults.find((pr) => pr.handId === h.handId);
        return r !== undefined && isWin(r.result);
      });
    },
  },

  {
    id: "high_roller_win",
    name: "High Roller",
    description: "Bet the table maximum and win.",
    icon: "fa-gem",
    category: "gambler",
    check: ({ hand, result, stats }) =>
      isWin(result.result) && stats.biggestBet > 0 && hand.bet >= stats.biggestBet,
  },

  {
    id: "whale",
    name: "Whale",
    description: "Win a hand with a bet of 1,000 chips or more.",
    icon: "fa-water",
    category: "gambler",
    check: ({ hand, result }) =>
      isWin(result.result) && hand.bet >= 1000,
  },

  {
    id: "risky_double",
    name: "Risky Business",
    description: "Win after doubling down on 9 or less.",
    icon: "fa-circle-half-stroke",
    category: "gambler",
    check: ({ hand, result }) =>
      hand.doubled &&
      isWin(result.result) &&
      hand.actionHistory.some(
        (a) => a.action === "double" && a.handValueBefore <= 9
      ),
  },

  {
    id: "bold_move",
    name: "Bold Move",
    description: "Win after doubling down against a dealer showing 9 or higher.",
    icon: "fa-bolt",
    category: "gambler",
    check: ({ hand, result }) =>
      hand.doubled &&
      isWin(result.result) &&
      hand.actionHistory.some(
        (a) =>
          a.action === "double" &&
          dealerUpcardValue(a.dealerUpcard) >= 9
      ),
  },

  // ── Rare ──────────────────────────────────────────────────────────────────

  {
    id: "lucky_seven",
    name: "Lucky Seven",
    description: "Win a hand with 21 made from exactly three 7s.",
    icon: "fa-7",
    category: "rare",
    check: ({ hand, result }) =>
      isWin(result.result) &&
      hand.cards.length === 3 &&
      hand.cards.every((c) => c.rank === "7") &&
      getBestValue(hand.cards) === 21,
  },

  {
    id: "twin_blackjacks",
    name: "Twin Blackjacks",
    description: "Split Aces and get 21 on both resulting hands.",
    icon: "fa-clone",
    category: "rare",
    // Check from the child-hand perspective so it only evaluates once per split.
    check: ({ player, hand, result, playerResults }) => {
      if (!isWin(result.result)) return false;
      // This hand must be a split-child with exactly 2 cards totalling 21
      if (!hand.splitFromHandId) return false;
      if (getBestValue(hand.cards) !== 21 || hand.cards.length !== 2) return false;
      // Parent must have been the ace that was split
      const parent = player.hands.find((h) => h.handId === hand.splitFromHandId);
      if (!parent) return false;
      const wasSplitFromAces = parent.actionHistory.some(
        (a) => a.action === "split" && a.pairRank === "A"
      );
      if (!wasSplitFromAces) return false;
      // Parent must also have exactly 2 cards totalling 21 and have won
      if (getBestValue(parent.cards) !== 21 || parent.cards.length !== 2) return false;
      const parentResult = playerResults.find((r) => r.handId === parent.handId);
      return parentResult !== undefined && isWin(parentResult.result);
    },
  },

  {
    id: "five_card_charlie",
    name: "Five Card Charlie",
    description: "Win with five cards without busting.",
    icon: "fa-layer-group",
    category: "rare",
    check: ({ result }) => result.result === "five-card-charlie",
  },

  {
    id: "max_splits",
    name: "Splitting Hairs",
    description: "Split three times in a single round.",
    icon: "fa-scissors",
    category: "rare",
    check: ({ player }) =>
      player.hands.filter((h) => h.splitFromHandId !== null).length >= 3,
  },

  {
    id: "blackjack_origami",
    name: "Blackjack Origami",
    description: "Create four hands from splitting in a single round.",
    icon: "fa-object-ungroup",
    category: "rare",
    // 3 split-child hands = 4 total hands in play
    check: ({ player }) =>
      player.hands.filter((h) => h.splitFromHandId !== null).length >= 3,
  },

  // ── Comeback ──────────────────────────────────────────────────────────────

  {
    id: "back_from_the_dead",
    name: "Back from the Dead",
    description: "Lose 5 hands in a row, then win the next 5 in a row.",
    icon: "fa-skull",
    category: "comeback",
    check: ({ progress }) =>
      progress.backFromDeadPhase === "building-wins" &&
      progress.backFromDeadWinCount >= 5,
  },

  {
    id: "down_to_the_wire",
    name: "Down to the Wire",
    description: "Win a hand when you started the round with 300 chips or fewer.",
    icon: "fa-heart-crack",
    category: "comeback",
    check: ({ result, chipsAtRoundStart }) =>
      isWin(result.result) && chipsAtRoundStart <= 300,
  },

  {
    id: "dealer_buster",
    name: "Dealer Buster",
    description: "Win a hand because the dealer busted.",
    icon: "fa-burst",
    category: "comeback",
    check: ({ result, dealerBusted }) =>
      dealerBusted && result.result === "win",
  },

  // ── Meta ──────────────────────────────────────────────────────────────────

  {
    id: "first_blackjack",
    name: "Natural",
    description: "Get your first blackjack.",
    icon: "fa-star",
    category: "meta",
    check: ({ result }) => result.result === "blackjack",
  },

  {
    id: "hat_trick",
    name: "Hat Trick",
    description: "Get 3 blackjacks in your career.",
    icon: "fa-hat-wizard",
    category: "meta",
    check: ({ stats }) => stats.blackjacks >= 3,
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "Play 100 hands.",
    icon: "fa-helmet-battle",
    category: "meta",
    check: ({ stats }) => stats.handsPlayed >= 100,
  },

  {
    id: "veteran",
    name: "Veteran",
    description: "Play 500 hands.",
    icon: "fa-medal",
    category: "meta",
    check: ({ stats }) => stats.handsPlayed >= 500,
  },

  {
    id: "fortune",
    name: "Fortune",
    description: "Accumulate 10,000 in net winnings over your career.",
    icon: "fa-coins",
    category: "meta",
    check: ({ stats }) => stats.netWinnings >= 10000,
  },

  // ── Funny ─────────────────────────────────────────────────────────────────

  {
    id: "house_sends_regards",
    name: "The House Sends Its Regards",
    description: "Get a blackjack but push because the dealer also has blackjack.",
    icon: "fa-handshake",
    category: "funny",
    check: ({ hand, result }) =>
      result.result === "push" && isBlackjack(hand),
  },

  {
    id: "hit_on_20",
    name: "I'll Take Another",
    description: "Hit on a hard or soft 20.",
    icon: "fa-hand-point-right",
    category: "funny",
    check: ({ hand }) =>
      hand.actionHistory.some(
        (a) => a.action === "hit" && a.handValueBefore === 20
      ),
  },

  {
    id: "living_dangerously",
    name: "Living Dangerously",
    description: "Hit on 18 and win the hand.",
    icon: "fa-fire",
    category: "funny",
    check: ({ hand, result }) =>
      isWin(result.result) &&
      hand.actionHistory.some(
        (a) => a.action === "hit" && a.handValueBefore === 18
      ),
  },

  {
    id: "against_all_odds",
    name: "Against All Odds",
    description: "Take 3 or more hits in a single hand and win.",
    icon: "fa-wand-magic-sparkles",
    category: "funny",
    check: ({ hand, result }) =>
      isWin(result.result) &&
      hand.actionHistory.filter((a) => a.action === "hit").length >= 3,
  },

  {
    id: "chaos_merchant",
    name: "Chaos Merchant",
    description: "Bust after taking 3 or more hits.",
    icon: "fa-explosion",
    category: "funny",
    check: ({ hand }) =>
      hand.busted &&
      hand.actionHistory.filter((a) => a.action === "hit").length >= 3,
  },

  {
    id: "table_cursed",
    name: "This Table Is Cursed",
    description: "Bust three hands in a row.",
    icon: "fa-skull-crossbones",
    category: "funny",
    check: ({ progress }) => (progress.currentBustStreak ?? 0) >= 3,
  },

  {
    id: "what",
    name: "What are you doing?",
    description: "Reach a hand total of 30 or higher.",
    icon: "fa-question",
    category: "funny",
    check: ({ hand }) => getBestValue(hand.cards) >= 30,
  },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
