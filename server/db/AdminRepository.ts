import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "./client.js";
import { players, playerStats, playerAchievements, roles, playerRoles } from "./schema.js";
import type { PlayerStats, Role } from "./schema.js";

/** Account-level view of a player, as shown in the admin console. */
export interface AdminPlayerSummary {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  chips: number;
  bannedAt: Date | null;
  banReason: string | null;
  mutedUntil: Date | null;
  createdAt: Date;
}

const summaryColumns = {
  id: players.id,
  username: players.username,
  displayName: players.displayName,
  avatarColor: players.avatarColor,
  chips: players.chips,
  bannedAt: players.bannedAt,
  banReason: players.banReason,
  mutedUntil: players.mutedUntil,
  createdAt: players.createdAt,
};

/** Search players by username or display name. Empty query returns the newest accounts. */
export async function searchPlayers(query: string, limit = 25): Promise<AdminPlayerSummary[]> {
  const term = query.trim();
  const base = db.select(summaryColumns).from(players);
  const rows = term
    ? await base
        .where(or(ilike(players.username, `%${term}%`), ilike(players.displayName, `%${term}%`)))
        .orderBy(desc(players.createdAt))
        .limit(limit)
    : await base.orderBy(desc(players.createdAt)).limit(limit);
  return rows;
}

/** Full admin view of one player: account, stats, roles, unlocked achievements. */
export async function getPlayerDetail(playerId: string): Promise<{
  player: AdminPlayerSummary;
  stats: PlayerStats | null;
  roles: Role[];
  achievements: string[];
} | null> {
  const [row] = await db
    .select()
    .from(players)
    .leftJoin(playerStats, eq(playerStats.playerId, players.id))
    .where(eq(players.id, playerId));
  if (!row) return null;

  const [roleRows, achRows] = await Promise.all([
    db
      .select({ role: roles })
      .from(playerRoles)
      .innerJoin(roles, eq(playerRoles.roleId, roles.id))
      .where(eq(playerRoles.playerId, playerId)),
    db
      .select({ achievementId: playerAchievements.achievementId })
      .from(playerAchievements)
      .where(eq(playerAchievements.playerId, playerId)),
  ]);

  const p = row.players;
  return {
    player: {
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      avatarColor: p.avatarColor,
      chips: p.chips,
      bannedAt: p.bannedAt,
      banReason: p.banReason,
      mutedUntil: p.mutedUntil,
      createdAt: p.createdAt,
    },
    stats: row.player_stats ?? null,
    roles: roleRows.map((r) => r.role),
    achievements: achRows.map((a) => a.achievementId),
  };
}

// ─── Economy ──────────────────────────────────────────────────────────────────

/** Set chips to an absolute value. Never negative. Returns the new balance. */
export async function setChips(playerId: string, chips: number): Promise<number> {
  const next = Math.max(0, Math.floor(chips));
  const [updated] = await db
    .update(players)
    .set({ chips: next, updatedAt: new Date() })
    .where(eq(players.id, playerId))
    .returning({ chips: players.chips });
  return updated?.chips ?? 0;
}

/** Add or subtract chips atomically, clamped at 0. Returns the new balance. */
export async function adjustChips(playerId: string, delta: number): Promise<number> {
  const amount = Math.floor(delta);
  const [updated] = await db
    .update(players)
    .set({
      chips: sql`GREATEST(0, ${players.chips} + ${amount})`,
      updatedAt: new Date(),
    })
    .where(eq(players.id, playerId))
    .returning({ chips: players.chips });
  return updated?.chips ?? 0;
}

// ─── Moderation ───────────────────────────────────────────────────────────────

export async function setBan(
  playerId: string,
  banned: boolean,
  reason: string | null
): Promise<void> {
  await db
    .update(players)
    .set({
      bannedAt: banned ? new Date() : null,
      banReason: banned ? reason : null,
      updatedAt: new Date(),
    })
    .where(eq(players.id, playerId));
}

/** Mute until a timestamp. Pass null to unmute. */
export async function setMute(playerId: string, until: Date | null): Promise<void> {
  await db
    .update(players)
    .set({ mutedUntil: until, updatedAt: new Date() })
    .where(eq(players.id, playerId));
}

export async function resetStats(playerId: string): Promise<void> {
  await db
    .update(playerStats)
    .set({
      handsPlayed: 0,
      handsWon: 0,
      handsLost: 0,
      handsPushed: 0,
      blackjacks: 0,
      totalWagered: 0,
      netWinnings: 0,
      biggestWin: 0,
      biggestBet: 0,
      splitsMade: 0,
      doublesMade: 0,
      timesBusted: 0,
      updatedAt: new Date(),
    })
    .where(eq(playerStats.playerId, playerId));
}

// ─── Enforcement lookups (used on login / socket connect / chat send) ─────────

export async function getBanStatus(
  playerId: string
): Promise<{ banned: boolean; reason: string | null }> {
  const [row] = await db
    .select({ bannedAt: players.bannedAt, banReason: players.banReason })
    .from(players)
    .where(eq(players.id, playerId));
  return { banned: Boolean(row?.bannedAt), reason: row?.banReason ?? null };
}

export async function isBannedByUsername(username: string): Promise<boolean> {
  const [row] = await db
    .select({ bannedAt: players.bannedAt })
    .from(players)
    .where(eq(players.username, username));
  return Boolean(row?.bannedAt);
}

/** True if the player currently has an unexpired mute. */
export async function isMuted(playerId: string): Promise<boolean> {
  const [row] = await db
    .select({ mutedUntil: players.mutedUntil })
    .from(players)
    .where(eq(players.id, playerId));
  return Boolean(row?.mutedUntil && row.mutedUntil.getTime() > Date.now());
}
