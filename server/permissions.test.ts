import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  effectivePermissions,
  hasAnyPermission,
  hasPermission,
  isPermission,
  type Permission,
} from "../app/lib/permissions.js";

const role = (permissions: string[]) => ({ permissions });

describe("hasPermission", () => {
  test("true only when one of the roles grants the key", () => {
    assert.equal(hasPermission([role(["player.kick"])], "player.kick"), true);
    assert.equal(hasPermission([role(["player.kick"])], "player.ban"), false);
  });

  test("false with no roles or empty permissions", () => {
    assert.equal(hasPermission([], "admin.access"), false);
    assert.equal(hasPermission(null, "admin.access"), false);
    assert.equal(hasPermission(undefined, "admin.access"), false);
    assert.equal(hasPermission([role([])], "admin.access"), false);
  });

  test("unions across multiple roles", () => {
    const roles = [role(["chat.clear"]), role(["player.ban"])];
    assert.equal(hasPermission(roles, "chat.clear"), true);
    assert.equal(hasPermission(roles, "player.ban"), true);
    assert.equal(hasPermission(roles, "role.manage"), false);
  });
});

describe("hasAnyPermission / effectivePermissions", () => {
  test("hasAnyPermission needs only one match", () => {
    assert.equal(hasAnyPermission([role(["player.mute"])], ["player.ban", "player.mute"]), true);
    assert.equal(hasAnyPermission([role(["player.mute"])], ["player.ban"]), false);
  });

  test("effectivePermissions dedupes across roles", () => {
    const perms = effectivePermissions([
      role(["player.kick", "chat.clear"]),
      role(["player.kick"]),
    ]);
    assert.deepEqual([...perms].sort(), ["chat.clear", "player.kick"].sort());
  });
});

describe("isPermission", () => {
  test("accepts known keys and rejects everything else", () => {
    assert.equal(isPermission("player.ban"), true);
    assert.equal(isPermission("player.nuke"), false);
    // Must not fall through to Object.prototype members.
    assert.equal(isPermission("toString"), false);
    assert.equal(isPermission("constructor"), false);
  });
});

describe("default role permissions", () => {
  test("developer holds every permission", () => {
    assert.deepEqual([...DEFAULT_ROLE_PERMISSIONS.developer].sort(), [...ALL_PERMISSIONS].sort());
  });

  test("moderator is a strict, safe subset", () => {
    const mod = DEFAULT_ROLE_PERMISSIONS.moderator;
    assert.ok(mod.length < ALL_PERMISSIONS.length);

    // A moderator must not be able to ban, touch the economy, or manage roles.
    for (const denied of [
      "player.ban",
      "player.adjust_chips",
      "player.reset_stats",
      "role.assign",
      "role.manage",
    ] as Permission[]) {
      assert.equal(mod.includes(denied), false, `moderator must not have ${denied}`);
    }

    // But must be able to do day-to-day moderation.
    for (const allowed of [
      "admin.access",
      "player.kick",
      "player.mute",
      "chat.delete_message",
      "chat.clear",
    ] as Permission[]) {
      assert.ok(mod.includes(allowed), `moderator should have ${allowed}`);
    }
  });

  test("every seeded permission is a known key", () => {
    for (const [roleName, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const p of perms) {
        assert.ok(isPermission(p), `${roleName} has unknown permission ${p}`);
      }
    }
  });
});

describe("in-game admin tab gating", () => {
  // Mirrors showAdminTab in app/components/ui/ProfileModal.tsx: the quick-action
  // tab appears only for staff who can actually do something, and never against
  // yourself. Server still re-checks each action.
  const QUICK_ACTIONS: Permission[] = [
    "player.kick",
    "player.mute",
    "player.ban",
    "player.unban",
    "player.adjust_chips",
  ];
  const showAdminTab = (roles: { permissions: string[] }[], isSelf: boolean) =>
    !isSelf && hasPermission(roles, "admin.access") && hasAnyPermission(roles, QUICK_ACTIONS);

  test("shown to a moderator viewing another player", () => {
    assert.equal(showAdminTab([role(DEFAULT_ROLE_PERMISSIONS.moderator)], false), true);
  });

  test("hidden when viewing your own profile", () => {
    assert.equal(showAdminTab([role(DEFAULT_ROLE_PERMISSIONS.developer)], true), false);
  });

  test("hidden from ordinary players", () => {
    assert.equal(showAdminTab([], false), false);
    assert.equal(showAdminTab([role([])], false), false);
  });

  test("hidden from a role with console access but no actionable permission", () => {
    // e.g. a read-only auditor: can open the console, can't act on players.
    assert.equal(showAdminTab([role(["admin.access", "chat.clear"])], false), false);
  });

  test("hidden from a role with actions but no admin.access", () => {
    assert.equal(showAdminTab([role(["player.kick"])], false), false);
  });
});

describe("privilege-escalation guard", () => {
  // Mirrors outranks() in server/index.ts: you may only assign, grant, or edit
  // permissions you already hold yourself.
  const outranks = (callerPerms: Set<Permission>, perms: readonly string[]) =>
    perms.every((p) => isPermission(p) && callerPerms.has(p));

  test("a moderator cannot hand out the developer role", () => {
    const mod = new Set(DEFAULT_ROLE_PERMISSIONS.moderator);
    assert.equal(outranks(mod, DEFAULT_ROLE_PERMISSIONS.developer), false);
  });

  test("a moderator cannot grant themselves a permission they lack", () => {
    const mod = new Set(DEFAULT_ROLE_PERMISSIONS.moderator);
    assert.equal(outranks(mod, ["player.ban"]), false);
    assert.equal(outranks(mod, ["player.kick"]), true);
  });

  test("a developer outranks every role", () => {
    const dev = new Set(DEFAULT_ROLE_PERMISSIONS.developer);
    assert.equal(outranks(dev, DEFAULT_ROLE_PERMISSIONS.moderator), true);
    assert.equal(outranks(dev, ALL_PERMISSIONS), true);
  });

  test("unknown keys are always rejected", () => {
    const dev = new Set(DEFAULT_ROLE_PERMISSIONS.developer);
    assert.equal(outranks(dev, ["player.nuke"]), false);
  });
});
