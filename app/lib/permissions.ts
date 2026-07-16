/**
 * Granular admin permissions.
 *
 * Every admin capability is one key. Roles hold a list of these keys (stored in
 * the `permissions` column on the roles table), so *which roles can do what* is
 * configurable at runtime from the admin console, with no code deploy. Adding a
 * key here makes it grantable; wiring it into an action makes it enforced.
 *
 * The server is always the authority: every admin action re-checks the caller's
 * permissions server-side. The client uses these purely to show/hide controls.
 */

export const PERMISSIONS = {
  // ── Access ──────────────────────────────────────────────────────────────────
  "admin.access": "Open the admin console",

  // ── Player moderation ───────────────────────────────────────────────────────
  "player.kick": "Kick a player from a table",
  "player.mute": "Mute or unmute a player's chat",
  "player.ban": "Ban a player's account",
  "player.unban": "Unban a player's account",

  // ── Economy & player data ───────────────────────────────────────────────────
  "player.adjust_chips": "Adjust or set a player's chips",
  "player.reset_stats": "Reset a player's stats",
  "player.grant_achievement": "Grant an achievement to a player",
  "player.revoke_achievement": "Revoke an achievement from a player",

  // ── Roles ───────────────────────────────────────────────────────────────────
  "role.assign": "Assign or revoke roles on players",
  "role.manage": "Create, edit and delete roles and their permissions",

  // ── Chat moderation ─────────────────────────────────────────────────────────
  "chat.delete_message": "Remove a chat message",
  "chat.clear": "Clear a table's chat",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Display grouping for the admin console's permission matrix. */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "Access", permissions: ["admin.access"] },
  {
    label: "Player moderation",
    permissions: ["player.kick", "player.mute", "player.ban", "player.unban"],
  },
  {
    label: "Economy & player data",
    permissions: [
      "player.adjust_chips",
      "player.reset_stats",
      "player.grant_achievement",
      "player.revoke_achievement",
    ],
  },
  { label: "Roles", permissions: ["role.assign", "role.manage"] },
  { label: "Chat moderation", permissions: ["chat.delete_message", "chat.clear"] },
];

/** Minimal shape so these helpers work with both the DB Role row and client RoleInfo. */
interface RoleLike {
  permissions?: string[] | null;
}

/** True if any role the holder has grants `permission`. */
export function hasPermission(
  roles: readonly RoleLike[] | null | undefined,
  permission: Permission
): boolean {
  if (!roles?.length) return false;
  return roles.some((r) => r.permissions?.includes(permission) ?? false);
}

/** True if any role the holder has grants at least one of `permissions`. */
export function hasAnyPermission(
  roles: readonly RoleLike[] | null | undefined,
  permissions: readonly Permission[]
): boolean {
  return permissions.some((p) => hasPermission(roles, p));
}

/** Every permission the holder has, deduped across all their roles. */
export function effectivePermissions(
  roles: readonly RoleLike[] | null | undefined
): Permission[] {
  const granted = new Set<string>();
  for (const role of roles ?? []) {
    for (const p of role.permissions ?? []) granted.add(p);
  }
  return ALL_PERMISSIONS.filter((p) => granted.has(p));
}

/** Guards untrusted input (e.g. an API body) against the known key set. */
export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

/**
 * Permissions granted to the built-in roles on seed. Existing roles are
 * backfilled with these; after that, edit them from the admin console.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  developer: [...ALL_PERMISSIONS],
  moderator: [
    "admin.access",
    "player.kick",
    "player.mute",
    "chat.delete_message",
    "chat.clear",
  ],
  staff: [
    "admin.access",
    "player.kick",
    "player.mute",
    "chat.delete_message",
    "chat.clear",
  ],
};
