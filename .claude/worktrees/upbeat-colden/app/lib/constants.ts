import type { Rank, Suit, GameSettings } from "./types.js";

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

export const RANKS: Rank[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];

export const RANK_VALUES: Record<Rank, number[]> = {
  A: [1, 11],
  "2": [2],
  "3": [3],
  "4": [4],
  "5": [5],
  "6": [6],
  "7": [7],
  "8": [8],
  "9": [9],
  "10": [10],
  J: [10],
  Q: [10],
  K: [10],
};

// Hi-Lo counting values: +1 for 2-6, 0 for 7-9, -1 for 10/face/A
export const HILO_VALUES: Record<Rank, number> = {
  A: -1,
  "2": 1,
  "3": 1,
  "4": 1,
  "5": 1,
  "6": 1,
  "7": 0,
  "8": 0,
  "9": 0,
  "10": -1,
  J: -1,
  Q: -1,
  K: -1,
};

export const CHIP_DENOMINATIONS = [5, 10, 25, 50, 100, 500] as const;
export type ChipDenomination = (typeof CHIP_DENOMINATIONS)[number];

// Chip colors by denomination
export const CHIP_COLORS: Record<ChipDenomination, string> = {
  5: "#E53E3E",    // red
  10: "#3182CE",   // blue
  25: "#38A169",   // green
  50: "#D69E2E",   // orange/gold
  100: "#805AD5",  // purple
  500: "#2D3748",  // dark/black
};

export const SHOE_SIZE = 312;              // 6 decks × 52 cards
export const CUT_CARD_PENETRATION = 0.75; // shuffle when 75% dealt

export const DEFAULT_SETTINGS: GameSettings = {
  startingChips: 1000,
  dailyChips: 1000,
  bettingTimerSeconds: 30,
  turnTimerSeconds: 45,
  allowCountingHint: false,
  minBet: 10,
  maxBet: 500,
};

export const MAX_SPLITS = 3;
export const MAX_PLAYERS = 6;
export const ROOM_CODE_LENGTH = 6;
export const DEALER_STAND_VALUE = 17;
export const BLACKJACK_PAYOUT = 1.5;   // 3:2
export const INSURANCE_PAYOUT = 2;     // 2:1
