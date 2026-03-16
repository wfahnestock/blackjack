import { randomUUID } from "crypto";
import type { Player, RoundResult, AchievementInfo } from "../../app/lib/types.js";
import type { BroadcastFn } from "../GameStateMachine.js";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  defaultProgress,
  handHadMistake,
  type AchievementContext,
  type AchievementProgress,
} from "./definitions.js";
import * as achievementRepo from "../db/AchievementRepository.js";
import * as statsRepo from "../db/StatsRepository.js";

/**
 * Runs after every round. For each player:
 *  1. Load their progress + already-unlocked set (batched).
 *  2. Update cross-round streak state based on this round's results.
 *  3. Evaluate all achievement conditions.
 *  4. Persist new unlocks + updated progress.
 *  5. Broadcast unlocks as system chat messages.
 */
export async function processRound(
  players: Player[],
  results: RoundResult[],
  broadcast: BroadcastFn,
  dealerBustedOverride?: boolean
): Promise<void> {
  const activePlayers = players.filter((p) => p.hands.length > 0);
  if (activePlayers.length === 0) return;

  const playerIds = activePlayers.map((p) => p.playerId);

  const [progressMap, unlockedMap, statsMap] = await Promise.all([
    achievementRepo.getProgressBatch(playerIds),
    achievementRepo.getUnlockedIdsBatch(playerIds),
    loadStats(playerIds),
  ]);

  // Group results by player
  const resultsByPlayer = new Map<string, RoundResult[]>();
  for (const r of results) {
    const list = resultsByPlayer.get(r.playerId) ?? [];
    list.push(r);
    resultsByPlayer.set(r.playerId, list);
  }

  // Dealer info is the same for every player — derive from the first available hand
  const dealerUpcard = getDealerUpcard(players, results);
  const dealerBusted = dealerBustedOverride ?? false;

  await Promise.all(
    activePlayers.map(async (player) => {
      const playerResults = resultsByPlayer.get(player.playerId) ?? [];
      if (playerResults.length === 0) return;

      const progress = progressMap.get(player.playerId) ?? defaultProgress();
      const alreadyUnlocked = unlockedMap.get(player.playerId) ?? new Set<string>();
      const stats = statsMap.get(player.playerId) ?? emptyStats();

      // Derive chips at round start: chips_now - total_payouts + total_bets
      const totalPayout = playerResults.reduce((s, r) => s + r.payout, 0);
      const totalBets = playerResults.reduce((s, r) => {
        const h = player.hands.find((hh) => hh.handId === r.handId);
        return s + (h?.bet ?? 0);
      }, 0);
      const chipsAtRoundStart = player.chips - totalPayout + totalBets;

      // Update cross-round progress for each hand result in sequence
      updateProgress(progress, player, playerResults);

      // Collect newly unlocked achievements
      const newlyUnlocked: string[] = [];

      for (const result of playerResults) {
        const hand = player.hands.find((h) => h.handId === result.handId);
        if (!hand) continue;

        const ctx: AchievementContext = {
          player,
          hand,
          result,
          playerResults,
          dealerUpcard,
          dealerBusted,
          chipsAtRoundStart,
          progress,
          stats,
        };

        for (const def of ACHIEVEMENTS) {
          if (alreadyUnlocked.has(def.id)) continue;
          if (newlyUnlocked.includes(def.id)) continue; // already triggered this round
          try {
            if (def.check(ctx)) {
              newlyUnlocked.push(def.id);
              alreadyUnlocked.add(def.id); // prevent double-trigger within same round
            }
          } catch (err) {
            console.error(`[AchievementEngine] check error for ${def.id}:`, err);
          }
        }
      }

      // Persist
      await Promise.all([
        achievementRepo.unlockMany(player.playerId, newlyUnlocked),
        achievementRepo.saveProgress(player.playerId, progress),
      ]);

      // Broadcast each unlock as a system chat message and a typed event
      for (const id of newlyUnlocked) {
        const def = ACHIEVEMENT_MAP.get(id);
        if (!def) continue;

        const achievement: AchievementInfo = {
          id: def.id,
          name: def.name,
          description: def.description,
          icon: def.icon,
          category: def.category,
          unlockedAt: Date.now(),
        };

        // Typed event for the client to show a toast
        broadcast("achievement:unlocked", { playerId: player.playerId, achievement });

        // System chat message visible to everyone at the table
        broadcast("chat:message", {
          messageId: randomUUID(),
          playerId: "system",
          displayName: "System",
          avatarColor: "#6366f1",
          message: `🏆 ${player.displayName} achieved "${def.name}" — ${def.description}`,
          censored: false,
          timestamp: Date.now(),
          roles: [],
          isSystem: true,
        });
      }
    })
  );
}

// ─── Progress updater ────────────────────────────────────────────────────────

/**
 * Mutates progress based on this round's hand results.
 * Processes hands in order so streaks update correctly within a split round.
 */
function updateProgress(
  progress: AchievementProgress,
  player: Player,
  results: RoundResult[]
): void {
  for (const result of results) {
    const hand = player.hands.find((h) => h.handId === result.handId);
    const won = result.result === "win" || result.result === "blackjack" || result.result === "five-card-charlie";
    const lost = result.result === "lose" || result.result === "bust";
    const push = result.result === "push";

    // Check for basic strategy mistakes on this hand
    const madeMistake = hand ? handHadMistake(hand) : false;

    if (won) {
      progress.currentWinStreak++;
      progress.currentLossStreak = 0;

      // Perfect play: win must be mistake-free
      if (!madeMistake) {
        progress.perfectPlayStreak++;
      } else {
        progress.perfectPlayStreak = 0;
      }

      // Double Trouble
      const wasDouble = hand?.doubled ?? false;
      if (wasDouble) {
        if (progress.lastWinWasDouble) {
          progress.consecutiveDoubleWins++;
        } else {
          progress.consecutiveDoubleWins = 1;
        }
        progress.lastWinWasDouble = true;
      } else {
        progress.consecutiveDoubleWins = 0;
        progress.lastWinWasDouble = false;
      }

      // Back from the Dead
      if (progress.backFromDeadPhase === "building-wins") {
        progress.backFromDeadWinCount++;
      } else if (progress.backFromDeadPhase === "idle" && progress.backFromDeadLossCount >= 5) {
        // Transition: had 5+ losses, now first win
        progress.backFromDeadPhase = "building-wins";
        progress.backFromDeadWinCount = 1;
      }
    } else if (lost) {
      progress.currentWinStreak = 0;
      progress.currentLossStreak++;
      progress.perfectPlayStreak = 0;
      progress.lastWinWasDouble = false;
      progress.consecutiveDoubleWins = 0;

      // Back from the Dead
      if (progress.backFromDeadPhase === "idle") {
        progress.backFromDeadLossCount++;
      } else if (progress.backFromDeadPhase === "building-wins") {
        // Loss resets the win run — go back to idle
        progress.backFromDeadPhase = "idle";
        progress.backFromDeadLossCount = 0;
        progress.backFromDeadWinCount = 0;
      }
    }
    // push: no streak changes

    // Bust streak — tracked separately from win/loss streak
    if (result.result === "bust") {
      progress.currentBustStreak = (progress.currentBustStreak ?? 0) + 1;
    } else {
      progress.currentBustStreak = 0;
    }
  }

  // After a completed "Back from the Dead" (5 wins), reset to prevent re-triggering
  if (
    progress.backFromDeadPhase === "building-wins" &&
    progress.backFromDeadWinCount >= 5
  ) {
    progress.backFromDeadPhase = "idle";
    progress.backFromDeadLossCount = 0;
    progress.backFromDeadWinCount = 0;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDealerUpcard(players: Player[], results: RoundResult[]): string {
  // The dealer upcard is stored in hand actionHistory entries
  for (const player of players) {
    for (const hand of player.hands) {
      const rec = hand.actionHistory[0];
      if (rec) return rec.dealerUpcard;
    }
  }
  return "2"; // fallback
}


function emptyStats() {
  return {
    handsPlayed: 0,
    handsWon: 0,
    blackjacks: 0,
    netWinnings: 0,
    biggestBet: 0,
  };
}

async function loadStats(playerIds: string[]): Promise<Map<string, ReturnType<typeof emptyStats>>> {
  // We read from StatsRepository using existing exported functions.
  // StatsRepository doesn't have a batch-read function, so we query directly.
  const { db } = await import("../db/client.js");
  const { playerStats } = await import("../db/schema.js");
  const { inArray } = await import("drizzle-orm");

  const rows = await db
    .select({
      playerId: playerStats.playerId,
      handsPlayed: playerStats.handsPlayed,
      handsWon: playerStats.handsWon,
      blackjacks: playerStats.blackjacks,
      netWinnings: playerStats.netWinnings,
      biggestBet: playerStats.biggestBet,
    })
    .from(playerStats)
    .where(inArray(playerStats.playerId, playerIds));

  const map = new Map<string, ReturnType<typeof emptyStats>>();
  for (const row of rows) {
    map.set(row.playerId, {
      handsPlayed: row.handsPlayed,
      handsWon: row.handsWon,
      blackjacks: row.blackjacks,
      netWinnings: row.netWinnings,
      biggestBet: row.biggestBet,
    });
  }
  return map;
}
