/**
 * Seed script — inserts the default role definitions and backfills their
 * default permissions.
 *
 * Run AFTER applying the schema:
 *   npm run db:push   ← applies schema changes (roles.permissions, player ban/mute cols)
 *   npm run db:seed   ← inserts default roles + backfills their permissions
 *
 * Safe to re-run. Existing roles keep their name/label/color/icon, and their
 * permissions are only backfilled when empty, so any customization made from
 * the admin console is never clobbered.
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { roles } from "./schema.js";
import { DEFAULT_ROLE_PERMISSIONS } from "../../app/lib/permissions.js";

const DEFAULT_ROLES = [
  { name: "moderator", label: "Moderator", color: "sky",    icon: "fa-gavel"  },
  { name: "staff",     label: "Staff",     color: "amber",  icon: "fa-wrench" },
  { name: "developer", label: "Developer", color: "violet", icon: "fa-code"   },
] as const;

async function seed() {
  console.log("Seeding roles...");

  for (const role of DEFAULT_ROLES) {
    const perms = DEFAULT_ROLE_PERMISSIONS[role.name] ?? [];
    const [existing] = await db.select().from(roles).where(eq(roles.name, role.name));

    if (!existing) {
      await db.insert(roles).values({ ...role, permissions: perms });
      console.log(`  ✓ Created: ${role.name} (${perms.length} permissions)`);
      continue;
    }

    // Only backfill when the role has no permissions yet. This keeps an existing
    // deployment working after the migration without overwriting console edits.
    if (!existing.permissions || existing.permissions.length === 0) {
      await db.update(roles).set({ permissions: perms }).where(eq(roles.id, existing.id));
      console.log(`  ✓ Backfilled permissions: ${role.name} (${perms.length})`);
    } else {
      console.log(
        `  – Skipped (exists, ${existing.permissions.length} permissions): ${role.name}`
      );
    }
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
