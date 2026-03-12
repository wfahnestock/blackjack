import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { roles, playerRoles } from "./schema.js";
import type { Role } from "./schema.js";

// ─── Role CRUD ────────────────────────────────────────────────────────────────

export async function findAllRoles(): Promise<Role[]> {
  return db.select().from(roles).orderBy(roles.name);
}

export async function findRoleById(id: string): Promise<Role | null> {
  const [role] = await db.select().from(roles).where(eq(roles.id, id));
  return role ?? null;
}

export async function findRoleByName(name: string): Promise<Role | null> {
  const [role] = await db.select().from(roles).where(eq(roles.name, name));
  return role ?? null;
}

export async function createRole(data: {
  name: string;
  label: string;
  color: string;
  icon: string;
}): Promise<Role> {
  const [role] = await db.insert(roles).values(data).returning();
  return role;
}

export async function updateRole(
  id: string,
  data: Partial<{ name: string; label: string; color: string; icon: string }>
): Promise<Role> {
  const [updated] = await db
    .update(roles)
    .set(data)
    .where(eq(roles.id, id))
    .returning();
  if (!updated) throw new Error(`Role not found: ${id}`);
  return updated;
}

export async function deleteRole(id: string): Promise<void> {
  await db.delete(roles).where(eq(roles.id, id));
}

// ─── Player ↔ Role assignment ─────────────────────────────────────────────────

/** Returns the full role definitions for every role a player holds. */
export async function getPlayerRoles(playerId: string): Promise<Role[]> {
  const rows = await db
    .select({ role: roles })
    .from(playerRoles)
    .innerJoin(roles, eq(playerRoles.roleId, roles.id))
    .where(eq(playerRoles.playerId, playerId));
  return rows.map((r) => r.role);
}

/** Assigns a role to a player. No-ops if already assigned. */
export async function addRoleToPlayer(playerId: string, roleId: string): Promise<void> {
  await db
    .insert(playerRoles)
    .values({ playerId, roleId })
    .onConflictDoNothing();
}

/** Removes a role from a player. No-ops if the player doesn't have the role. */
export async function removeRoleFromPlayer(playerId: string, roleId: string): Promise<void> {
  await db
    .delete(playerRoles)
    .where(and(eq(playerRoles.playerId, playerId), eq(playerRoles.roleId, roleId)));
}
