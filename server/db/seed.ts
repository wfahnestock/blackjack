/**
 * Seed script — inserts the default role definitions.
 *
 * Run AFTER applying the schema migration:
 *   npm run db:push   ← applies schema changes
 *   npm run db:seed   ← inserts default roles
 *
 * Safe to re-run: existing rows are skipped.
 *
 * Note: any role assignments that existed on the old `players.role`
 * column must be re-applied via admin tooling or directly in the DB
 * after the migration, since that column is dropped.
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { roles } from "./schema.js";

const DEFAULT_ROLES = [
  { name: "moderator", label: "Moderator", color: "sky",    icon: "fa-gavel"  },
  { name: "staff",     label: "Staff",     color: "amber",  icon: "fa-wrench" },
  { name: "developer", label: "Developer", color: "violet", icon: "fa-code"   },
] as const;

async function seed() {
  console.log("Seeding roles...");

  for (const role of DEFAULT_ROLES) {
    const [existing] = await db.select().from(roles).where(eq(roles.name, role.name));
    if (!existing) {
      await db.insert(roles).values(role);
      console.log(`  ✓ Created: ${role.name}`);
    } else {
      console.log(`  – Skipped (exists): ${role.name}`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
