/**
 * DealerBehavior.ts
 *
 * Encapsulates all dealer imperfection logic: probabilistic hit/stand decisions,
 * streak tracking, and outcome-based modifiers. The pure blackjack rules in
 * HandEvaluator remain unchanged and are used as the deterministic fallback
 * when this module is disabled.
 *
 * Design goals:
 *  - House edge stays positive long-term.
 *  - Imperfection is subtle and not mechanically detectable.
 *  - All behaviour is driven by DealerConfig — easy to tune or disable.
 */

import type { Card, RoundResult } from "../app/lib/types.js";
import { getBestValue, isSoft, dealerShouldHit } from "./HandEvaluator.js";

// ─── Centralized RNG ──────────────────────────────────────────────────────────

/** Single random-number source for this module. Replace with a seeded PRNG here if needed. */
export function rng(): number {
  return Math.random();
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface FuzzingConfig {
  enabled: boolean;
  /**
   * Maps dealer total (15–18) to probabilistic hit chances.
   * hard: probability of hitting when the hand is hard.
   * soft: probability of hitting when the hand is soft.
   * Values outside [15, 18] always use deterministic rules.
   */
  edgeRangeHitChances: Record<number, { hard: number; soft: number }>;
}

export interface StreakTrackingConfig {
  enabled: boolean;
  /** Number of recent rounds to consider for streak and rate calculations. */
  windowSize: number;
}

export interface StreakModifiersConfig {
  enabled: boolean;
  /** Consecutive dealer wins that trigger increased imperfection. */
  dealerWinStreakThreshold: number;
  /** Consecutive player losses that trigger increased bust pressure. */
  playerLossStreakThreshold: number;
  /** Added to hitChance when dealer win streak threshold is met. */
  dealerWinStreakBonus: number;
  /** Added to hitChance when player loss streak threshold is met. */
  playerLossStreakBonus: number;
  /** Subtracted from hitChance when dealer is already on a losing run. */
  dealerLosingReduction: number;
  /** Maximum absolute value of the combined streak modifier. */
  maxTotalModifier: number;
}

export interface BustBiasConfig {
  enabled: boolean;
  /** Only apply when the best non-busted player hand meets this threshold. */
  playerTotalThreshold: number;
  /** Dealer totals where the extra hit push is applied. */
  dealerTotalsAffected: number[];
  /** Extra hit probability added when conditions are met. */
  extraHitChance: number;
}

export interface PerfectDampeningConfig {
  enabled: boolean;
  /**
   * If the fraction of recent rounds where the dealer finishes on 20 or 21
   * exceeds this value, dampening kicks in.
   */
  threshold: number;
  /** Extra hit probability added when dampening is active. */
  dampFactor: number;
}

export interface DealerConfig {
  /** Master switch — set false to restore purely deterministic dealer behaviour. */
  enabled: boolean;
  fuzzing: FuzzingConfig;
  streakTracking: StreakTrackingConfig;
  streakModifiers: StreakModifiersConfig;
  bustBias: BustBiasConfig;
  perfectDampening: PerfectDampeningConfig;
}

export const DEFAULT_DEALER_CONFIG: DealerConfig = {
  enabled: true,

  fuzzing: {
    enabled: true,
    edgeRangeHitChances: {
      // Below 15 → always hit (no entry needed).
      // Above 18 → always stand (no entry needed).
      15: { hard: 0.90, soft: 0.90 }, // 10% chance of an early stand
      16: { hard: 0.85, soft: 0.85 }, // 15% chance of an early stand
      17: { hard: 0.05, soft: 0.70 }, // hard 17: rarely hits; soft 17: usually hits
      18: { hard: 0.10, soft: 0.10 }, // 10% chance of taking a risky extra card
    },
  },

  streakTracking: {
    enabled: true,
    windowSize: 10,
  },

  streakModifiers: {
    enabled: true,
    dealerWinStreakThreshold:  3,
    playerLossStreakThreshold: 3,
    dealerWinStreakBonus:       0.07,  // dealer hot → dealer takes more risks
    playerLossStreakBonus:      0.05,  // player cold → gentle bust pressure
    dealerLosingReduction:     0.03,  // dealer already losing → slightly safer play
    maxTotalModifier:          0.15,  // hard cap prevents extreme swings
  },

  bustBias: {
    enabled: true,
    playerTotalThreshold:  18,
    dealerTotalsAffected:  [15, 16],
    extraHitChance:        0.08,
  },

  perfectDampening: {
    enabled:    true,
    threshold:  0.45, // >45% of recent rounds ending dealer on 20/21 triggers dampening
    dampFactor: 0.10,
  },
};

// ─── Internal types ───────────────────────────────────────────────────────────

interface RoundOutcome {
  dealerWon:        boolean;
  dealerBusted:     boolean;
  dealerFinalValue: number;
  playerLost:       boolean;
}

// ─── StreakTracker ────────────────────────────────────────────────────────────

class StreakTracker {
  private window: RoundOutcome[] = [];

  constructor(private cfg: StreakTrackingConfig) {}

  record(outcome: RoundOutcome): void {
    this.window.push(outcome);
    if (this.window.length > this.cfg.windowSize) {
      this.window.shift();
    }
  }

  /** Consecutive trailing rounds the dealer won. */
  get dealerWinStreak(): number {
    let streak = 0;
    for (let i = this.window.length - 1; i >= 0; i--) {
      if (this.window[i].dealerWon) streak++;
      else break;
    }
    return streak;
  }

  /** Consecutive trailing rounds the player lost. */
  get playerLossStreak(): number {
    let streak = 0;
    for (let i = this.window.length - 1; i >= 0; i--) {
      if (this.window[i].playerLost) streak++;
      else break;
    }
    return streak;
  }

  /**
   * Fraction of recent rounds where the dealer finished on 20 or 21 without busting.
   * Used for perfect-outcome dampening.
   */
  get recentPerfectRate(): number {
    if (this.window.length === 0) return 0;
    const perfects = this.window.filter(
      (o) => o.dealerFinalValue >= 20 && !o.dealerBusted
    ).length;
    return perfects / this.window.length;
  }

  /**
   * True if the dealer has been on a losing run in recent play.
   * Uses a short look-back (last 5 rounds, threshold 3 losses) so it reacts quickly.
   */
  get dealerIsLosing(): boolean {
    if (this.window.length < 3) return false;
    const recent = this.window.slice(-5);
    const losses = recent.filter((o) => !o.dealerWon).length;
    return losses >= 3;
  }
}

// ─── DealerBehaviorEngine ─────────────────────────────────────────────────────

export class DealerBehaviorEngine {
  private readonly cfg: DealerConfig;
  private readonly tracker: StreakTracker;

  constructor(config?: Partial<DealerConfig>) {
    // Deep merge: top-level keys only need replacing; nested objects are spread.
    this.cfg = config
      ? {
          ...DEFAULT_DEALER_CONFIG,
          ...config,
          fuzzing:           { ...DEFAULT_DEALER_CONFIG.fuzzing,           ...config.fuzzing },
          streakTracking:    { ...DEFAULT_DEALER_CONFIG.streakTracking,    ...config.streakTracking },
          streakModifiers:   { ...DEFAULT_DEALER_CONFIG.streakModifiers,   ...config.streakModifiers },
          bustBias:          { ...DEFAULT_DEALER_CONFIG.bustBias,          ...config.bustBias },
          perfectDampening:  { ...DEFAULT_DEALER_CONFIG.perfectDampening,  ...config.perfectDampening },
        }
      : DEFAULT_DEALER_CONFIG;

    this.tracker = new StreakTracker(this.cfg.streakTracking);
  }

  /**
   * Decides whether the dealer should draw another card.
   *
   * @param dealerCards     Current dealer hand.
   * @param bestPlayerValue Highest non-busted player hand value at the table.
   *                        Used to activate bust-bias when player is in a strong position.
   */
  shouldHit(dealerCards: Card[], bestPlayerValue: number): boolean {
    // Master switch — fall back to deterministic rules if disabled.
    if (!this.cfg.enabled || !this.cfg.fuzzing.enabled) {
      return dealerShouldHit(dealerCards);
    }

    const total = getBestValue(dealerCards);
    const soft  = isSoft(dealerCards);

    // Outside the fuzz range: use deterministic rules to keep house edge stable.
    if (total < 15) return true;
    if (total > 18) return false;

    const chances = this.cfg.fuzzing.edgeRangeHitChances[total];
    if (!chances) return dealerShouldHit(dealerCards);

    let hitChance = soft ? chances.soft : chances.hard;

    // 1. Streak modifier
    hitChance += this.streakModifier();

    // 2. Bust bias — extra push to hit on 15/16 when player holds a strong total
    if (
      this.cfg.bustBias.enabled &&
      this.cfg.bustBias.dealerTotalsAffected.includes(total) &&
      bestPlayerValue >= this.cfg.bustBias.playerTotalThreshold
    ) {
      hitChance += this.cfg.bustBias.extraHitChance;
    }

    // 3. Perfect-outcome dampening — take more risks if dealer has been too "lucky"
    if (
      this.cfg.perfectDampening.enabled &&
      this.tracker.recentPerfectRate > this.cfg.perfectDampening.threshold
    ) {
      hitChance += this.cfg.perfectDampening.dampFactor;
    }

    // Clamp to a valid probability.
    hitChance = Math.max(0, Math.min(1, hitChance));

    return rng() < hitChance;
  }

  /**
   * Records the outcome of a completed round so streak data stays current.
   * Call this just before (or just after) the onRoundEnd persistence callback.
   */
  recordOutcome(results: RoundResult[], dealerFinalValue: number): void {
    if (!this.cfg.streakTracking.enabled) return;

    const losses = results.filter(
      (r) => r.result === "lose" || r.result === "bust"
    ).length;
    const wins = results.filter(
      (r) =>
        r.result === "win" ||
        r.result === "blackjack" ||
        r.result === "five-card-charlie"
    ).length;

    const dealerWon  = losses > wins;
    const playerLost = dealerWon;
    const dealerBusted = dealerFinalValue > 21;

    this.tracker.record({ dealerWon, dealerBusted, dealerFinalValue, playerLost });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private streakModifier(): number {
    const smCfg = this.cfg.streakModifiers;
    if (!smCfg.enabled) return 0;

    let mod = 0;

    if (this.tracker.dealerWinStreak >= smCfg.dealerWinStreakThreshold) {
      mod += smCfg.dealerWinStreakBonus;
    }
    if (this.tracker.playerLossStreak >= smCfg.playerLossStreakThreshold) {
      mod += smCfg.playerLossStreakBonus;
    }
    if (this.tracker.dealerIsLosing) {
      mod -= smCfg.dealerLosingReduction;
    }

    // Cap to avoid visible swings.
    return Math.max(-smCfg.maxTotalModifier, Math.min(smCfg.maxTotalModifier, mod));
  }
}
