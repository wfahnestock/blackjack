#!/usr/bin/env node
/**
 * Password reset utility.
 *
 * There is no self-serve password reset in the app, so use this to reset a
 * player's password directly against the database. It hashes the new password
 * with the same bcrypt logic the login flow uses, so the account will log in
 * normally afterward.
 *
 * Usage:
 *   npx tsx scripts/reset-password.ts <username> <newPassword>
 *
 * Requires DATABASE_URL in your .env (same one the server uses).
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/db/client.js";
import { players } from "../server/db/schema.js";
import { hashPassword } from "../server/auth/AuthService.js";

async function main() {
  const [username, newPassword] = process.argv.slice(2);

  if (!username || !newPassword) {
    console.error("Usage: npx tsx scripts/reset-password.ts <username> <newPassword>");
    process.exit(1);
  }
  if (newPassword.length > 128) {
    console.error("Password must be 128 characters or fewer.");
    process.exit(1);
  }
  if (newPassword.length < 12) {
    console.warn(
      `Warning: password is ${newPassword.length} chars, below the 12-char registration minimum. ` +
      `Setting it anyway since login doesn't enforce length.`
    );
  }

  const existing = await db.query.players.findFirst({
    where: eq(players.username, username),
  });
  if (!existing) {
    console.error(`No player found with username "${username}".`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(players)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(players.username, username));

  console.log(`Password reset for "${username}" (id: ${existing.id}). You can log in now.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
