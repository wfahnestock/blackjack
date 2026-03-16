import { eq, and } from "drizzle-orm";
import { db } from "./client.js";
import { players, playerOwnedSkins } from "./schema.js";

export type SkinType = "card" | "table-bg";

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Returns the skin keys owned by a player for a given skin type (never includes "default"). */
export async function getOwnedSkins(playerId: string, skinType: SkinType): Promise<string[]> {
  const rows = await db
    .select({ skinKey: playerOwnedSkins.skinKey })
    .from(playerOwnedSkins)
    .where(
      and(
        eq(playerOwnedSkins.playerId, playerId),
        eq(playerOwnedSkins.skinType, skinType),
      ),
    );
  return rows.map((r) => r.skinKey);
}

/** Returns the currently equipped skin key for the given type, or null if none. */
export async function getEquippedSkin(playerId: string, skinType: SkinType): Promise<string | null> {
  const [row] = await db
    .select({
      equippedCardSkin: players.equippedCardSkin,
      equippedTableBg:  players.equippedTableBg,
    })
    .from(players)
    .where(eq(players.id, playerId));

  if (!row) return null;
  return skinType === "card"
    ? (row.equippedCardSkin ?? null)
    : (row.equippedTableBg  ?? null);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Atomically deducts `cost` chips from the player and records skin ownership.
 * Returns the new chip total on success.
 */
export async function purchaseSkin(
  playerId: string,
  skinType: SkinType,
  skinKey: string,
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
      .select({ skinKey: playerOwnedSkins.skinKey })
      .from(playerOwnedSkins)
      .where(
        and(
          eq(playerOwnedSkins.playerId, playerId),
          eq(playerOwnedSkins.skinType, skinType),
          eq(playerOwnedSkins.skinKey, skinKey),
        ),
      );
    if (existing) return { success: false, error: "Already owned" };

    const newChips = player.chips - cost;
    await tx
      .update(players)
      .set({ chips: newChips, updatedAt: new Date() })
      .where(eq(players.id, playerId));

    await tx.insert(playerOwnedSkins).values({ playerId, skinType, skinKey });

    return { success: true, chips: newChips };
  });
}

/**
 * Sets the player's equipped skin for a given type.  Pass `null` to revert to default.
 * The caller is responsible for verifying ownership before calling this.
 */
export async function equipSkin(
  playerId: string,
  skinType: SkinType,
  skinKey: string | null,
): Promise<void> {
  const field = skinType === "card"
    ? { equippedCardSkin: skinKey, updatedAt: new Date() }
    : { equippedTableBg:  skinKey, updatedAt: new Date() };

  await db
    .update(players)
    .set(field)
    .where(eq(players.id, playerId));
}
