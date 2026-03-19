import { eq, desc, ne } from "drizzle-orm";
import { db } from "./client.js";
import { players, playerStats } from "./schema.js";
import type { Player, PlayerStats } from "./schema.js";

function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function createPlayer(
  username: string,
  passwordHash: string,
  displayName: string,
  avatarColor: string,
  startingChips: number
): Promise<Player> {
  const [player] = await db
    .insert(players)
    .values({ username, passwordHash, displayName, avatarColor, chips: startingChips })
    .returning();

  await db.insert(playerStats).values({ playerId: player.id });

  return player;
}

export async function findByUsername(username: string): Promise<Player | null> {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.username, username));
  return player ?? null;
}

export async function findById(id: string): Promise<Player | null> {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, id));
  return player ?? null;
}

export async function updateChips(playerId: string, chips: number): Promise<void> {
  await db
    .update(players)
    .set({ chips, updatedAt: new Date() })
    .where(eq(players.id, playerId));
}

export async function findProfileById(
  id: string
): Promise<{ player: Player; stats: PlayerStats | null } | null> {
  const [row] = await db
    .select()
    .from(players)
    .leftJoin(playerStats, eq(playerStats.playerId, players.id))
    .where(eq(players.id, id));

  if (!row) return null;
  return { player: row.players, stats: row.player_stats ?? null };
}

export async function updateProfile(
  playerId: string,
  displayName: string,
  avatarColor: string,
  passwordHash?: string
): Promise<Player> {
  const values: Partial<typeof players.$inferInsert> = {
    displayName,
    avatarColor,
    updatedAt: new Date(),
  };
  if (passwordHash !== undefined) {
    values.passwordHash = passwordHash;
  }
  const [updated] = await db
    .update(players)
    .set(values)
    .where(eq(players.id, playerId))
    .returning();
  return updated;
}


export type LeaderboardStat = "chips" | "netWinnings" | "handsPlayed";

export async function getLeaderboard(
  stat: LeaderboardStat,
  limit = 50
): Promise<{ playerId: string; displayName: string; avatarColor: string; nameEffect: string | null; value: number }[]> {
  if (stat === "chips") {
    return db
      .select({
        playerId: players.id,
        displayName: players.displayName,
        avatarColor: players.avatarColor,
        nameEffect: players.equippedNameEffect,
        value: players.chips,
      })
      .from(players)
      .where(ne(players.id, "f2da41de-31af-4149-820a-fdd8635d1251")) // exclude dev account
      .orderBy(desc(players.chips))
      .limit(limit);
  }

  const col = stat === "netWinnings" ? playerStats.netWinnings : playerStats.handsPlayed;
  return db
    .select({
      playerId: players.id,
      displayName: players.displayName,
      avatarColor: players.avatarColor,
      nameEffect: players.equippedNameEffect,
      value: col,
    })
    .from(players)
    .innerJoin(playerStats, eq(playerStats.playerId, players.id))
    .orderBy(desc(col))
    .limit(limit);
}

export async function claimDailyReward(
  playerId: string,
  dailyAmount: number
): Promise<{ chips: number; alreadyClaimed: boolean }> {
  const today = utcDateString();

  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId));

  if (!player) {
    return { chips: 0, alreadyClaimed: true };
  }

  if (player.lastDailyClaimed === today) {
    return { chips: player.chips, alreadyClaimed: true };
  }

  const newChips = player.chips + dailyAmount;
  const [updated] = await db
    .update(players)
    .set({ chips: newChips, lastDailyClaimed: today, updatedAt: new Date() })
    .where(eq(players.id, playerId))
    .returning();

  return { chips: updated.chips, alreadyClaimed: false };
}
