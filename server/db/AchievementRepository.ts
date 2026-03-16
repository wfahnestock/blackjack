import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./client.js";
import { playerAchievements, playerStats } from "./schema.js";
import type { AchievementProgress } from "../achievements/definitions.js";
import { defaultProgress } from "../achievements/definitions.js";

/** Returns the set of achievement IDs already unlocked by a player. */
export async function getUnlockedIds(playerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ achievementId: playerAchievements.achievementId })
    .from(playerAchievements)
    .where(eq(playerAchievements.playerId, playerId));
  return new Set(rows.map((r) => r.achievementId));
}

/** Returns all unlocked achievements for a player with their unlock timestamps. */
export async function getUnlocked(
  playerId: string
): Promise<Array<{ achievementId: string; unlockedAt: Date }>> {
  return db
    .select({
      achievementId: playerAchievements.achievementId,
      unlockedAt: playerAchievements.unlockedAt,
    })
    .from(playerAchievements)
    .where(eq(playerAchievements.playerId, playerId));
}

/** Inserts a new achievement unlock, ignoring duplicates. */
export async function unlockAchievement(
  playerId: string,
  achievementId: string
): Promise<void> {
  await db
    .insert(playerAchievements)
    .values({ playerId, achievementId })
    .onConflictDoNothing();
}

/** Bulk-unlocks multiple achievements for the same player. */
export async function unlockMany(
  playerId: string,
  achievementIds: string[]
): Promise<void> {
  if (achievementIds.length === 0) return;
  await db
    .insert(playerAchievements)
    .values(achievementIds.map((achievementId) => ({ playerId, achievementId })))
    .onConflictDoNothing();
}

/** Reads the achievement progress blob for a player. Returns defaults if missing. */
export async function getProgress(playerId: string): Promise<AchievementProgress> {
  const rows = await db
    .select({ achievementProgress: playerStats.achievementProgress })
    .from(playerStats)
    .where(eq(playerStats.playerId, playerId));

  const raw = rows[0]?.achievementProgress;
  if (!raw || typeof raw !== "object") return defaultProgress();
  return { ...defaultProgress(), ...(raw as Partial<AchievementProgress>) };
}

/** Persists the updated achievement progress blob for a player. */
export async function saveProgress(
  playerId: string,
  progress: AchievementProgress
): Promise<void> {
  await db
    .update(playerStats)
    .set({ achievementProgress: progress as any })
    .where(eq(playerStats.playerId, playerId));
}

/** Reads progress for multiple players in one query. */
export async function getProgressBatch(
  playerIds: string[]
): Promise<Map<string, AchievementProgress>> {
  if (playerIds.length === 0) return new Map();
  const rows = await db
    .select({
      playerId: playerStats.playerId,
      achievementProgress: playerStats.achievementProgress,
    })
    .from(playerStats)
    .where(inArray(playerStats.playerId, playerIds));

  const map = new Map<string, AchievementProgress>();
  for (const row of rows) {
    const raw = row.achievementProgress;
    map.set(row.playerId, {
      ...defaultProgress(),
      ...(typeof raw === "object" && raw ? (raw as Partial<AchievementProgress>) : {}),
    });
  }
  return map;
}

/** Reads unlocked achievement IDs for multiple players in one query. */
export async function getUnlockedIdsBatch(
  playerIds: string[]
): Promise<Map<string, Set<string>>> {
  if (playerIds.length === 0) return new Map();
  const rows = await db
    .select({
      playerId: playerAchievements.playerId,
      achievementId: playerAchievements.achievementId,
    })
    .from(playerAchievements)
    .where(inArray(playerAchievements.playerId, playerIds));

  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!map.has(row.playerId)) map.set(row.playerId, new Set());
    map.get(row.playerId)!.add(row.achievementId);
  }
  return map;
}
