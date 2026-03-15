import { eq, and } from "drizzle-orm";
import { db } from "./client.js";
import { players, playerOwnedEffects } from "./schema.js";

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Returns the effect keys owned by a player (never includes "default"). */
export async function getOwnedEffects(playerId: string): Promise<string[]> {
  const rows = await db
    .select({ effectKey: playerOwnedEffects.effectKey })
    .from(playerOwnedEffects)
    .where(eq(playerOwnedEffects.playerId, playerId));
  return rows.map((r) => r.effectKey);
}

/** Returns the currently equipped effect key, or null if none. */
export async function getEquippedEffect(playerId: string): Promise<string | null> {
  const [row] = await db
    .select({ equippedNameEffect: players.equippedNameEffect })
    .from(players)
    .where(eq(players.id, playerId));
  return row?.equippedNameEffect ?? null;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Atomically deducts `cost` chips from the player and records ownership.
 * Returns the new chip total on success.
 */
export async function purchaseEffect(
  playerId: string,
  effectKey: string,
  cost: number,
): Promise<{ success: boolean; chips?: number; error?: string }> {
  return db.transaction(async (tx) => {
    const [player] = await tx
      .select({ chips: players.chips })
      .from(players)
      .where(eq(players.id, playerId));

    if (!player) return { success: false, error: "Player not found" };
    if (player.chips < cost) return { success: false, error: "Not enough chips" };

    // Guard against double-purchase
    const [existing] = await tx
      .select({ effectKey: playerOwnedEffects.effectKey })
      .from(playerOwnedEffects)
      .where(
        and(
          eq(playerOwnedEffects.playerId, playerId),
          eq(playerOwnedEffects.effectKey, effectKey),
        ),
      );
    if (existing) return { success: false, error: "Already owned" };

    const newChips = player.chips - cost;
    await tx
      .update(players)
      .set({ chips: newChips, updatedAt: new Date() })
      .where(eq(players.id, playerId));

    await tx.insert(playerOwnedEffects).values({ playerId, effectKey });

    return { success: true, chips: newChips };
  });
}

/**
 * Sets the player's equipped name effect.  Pass `null` to revert to default.
 * The caller is responsible for verifying ownership before calling this.
 */
export async function equipEffect(
  playerId: string,
  effectKey: string | null,
): Promise<void> {
  await db
    .update(players)
    .set({ equippedNameEffect: effectKey, updatedAt: new Date() })
    .where(eq(players.id, playerId));
}
