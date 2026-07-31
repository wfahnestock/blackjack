import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { DefaultEventsMap } from "socket.io";
import { nanoid } from "nanoid";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../app/lib/types.js";
import { ROOM_CODE_LENGTH, DEFAULT_SETTINGS } from "../app/lib/constants.js";
import { GameRoom } from "./GameRoom.js";
import * as playerRepo from "./db/PlayerRepository.js";
import * as roleRepo from "./db/RoleRepository.js";
import * as adminRepo from "./db/AdminRepository.js";
import {
  effectivePermissions,
  isPermission,
  type Permission,
} from "../app/lib/permissions.js";
import type { Role } from "./db/schema.js";
import * as statsRepo from "./db/StatsRepository.js";
import * as authService from "./auth/AuthService.js";
import * as vanityRepo from "./db/VanityRepository.js";
import * as achievementRepo from "./db/AchievementRepository.js";
import * as achievementEngine from "./achievements/AchievementEngine.js";
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from "./achievements/definitions.js";
import { NAME_EFFECT_KEYS, NAME_EFFECTS } from "../app/lib/nameEffects.js";
import * as skinsRepo from "./db/SkinsRepository.js";
import { CARD_SKIN_KEYS, CARD_SKINS } from "../app/lib/cardSkins.js";
import { TABLE_BG_KEYS, TABLE_BGS } from "../app/lib/tableBgs.js";
import { installConsoleTimestamps, log } from "./logger.js";

// Timestamp + level every console line, including all the existing [tag] logs.
// Installed before anything else logs.
installConsoleTimestamps();

// ─── Express ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
const httpServer = createServer(app);

// ─── Auth Middleware ─────────────────────────────────────────────────────────

type AuthedRequest = express.Request & {
  playerId?: string;
  /** Username from the JWT, for audit logging of admin actions. */
  username?: string;
  /** Populated by requirePermission(): the caller's roles and effective permissions. */
  callerRoles?: Role[];
  callerPerms?: Set<Permission>;
};

function requireAuth(
  req: AuthedRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const payload = authService.verifyToken(authHeader.slice(7));
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.playerId = payload.playerId;
  req.username = payload.username;
  next();
}

/**
 * Gates an admin endpoint behind a single permission key. Loads the caller's
 * roles, derives their effective permissions, and rejects when the key isn't
 * granted. The server is the authority: the client's copy of these permissions
 * only decides what UI to render, never what is allowed.
 */
function requirePermission(permission: Permission) {
  return async (
    req: AuthedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    if (!req.playerId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const roles = await roleRepo.getPlayerRoles(req.playerId);
      req.callerRoles = roles;
      req.callerPerms = new Set(effectivePermissions(roles));
      if (!req.callerPerms.has(permission)) {
        res.status(403).json({ error: "Forbidden", missing: permission });
        return;
      }
      next();
    } catch (err) {
      console.error("[requirePermission]", err);
      res.status(500).json({ error: "Server error" });
    }
  };
}

/**
 * Anti-escalation guard. A caller may only grant, assign, or edit permissions
 * they already hold themselves. Without this, anyone with `role.assign` could
 * hand themselves the Developer role, and anyone with `role.manage` could grant
 * themselves every key (or strip a role above them).
 */
function outranks(callerPerms: Set<Permission> | undefined, perms: readonly string[]): boolean {
  if (!callerPerms) return false;
  return perms.every((p) => isPermission(p) && callerPerms.has(p));
}

// ─── REST Endpoints ──────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, displayName, avatarColor, password } = req.body as {
      username: string;
      displayName: string;
      avatarColor: string;
      password: string;
    };

    if (!username || username.length < 3 || username.length > 32) {
      res.status(400).json({ error: "Username must be 3–32 characters" });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      res.status(400).json({ error: "Username may only contain letters, numbers, and underscores" });
      return;
    }
    if (!displayName || displayName.trim().length < 2 || displayName.trim().length > 50) {
      res.status(400).json({ error: "Display name must be 2–50 characters" });
      return;
    }
    if (!password || password.length < 12 || password.length > 128) {
      res.status(400).json({ error: "Password must be between 12 and 128 characters" });
      return;
    }

    const existing = await playerRepo.findByUsername(username);
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await authService.hashPassword(password);
    const player = await playerRepo.createPlayer(
      username,
      passwordHash,
      displayName.trim(),
      avatarColor ?? "#10B981",
      DEFAULT_SETTINGS.startingChips
    );

    log.info("auth", `new account registered: ${player.username} (id: ${player.id})`);

    const token = authService.signToken({ playerId: player.id, username: player.username });
    const playerRoles = await roleRepo.getPlayerRoles(player.id);
    res.json({
      token,
      player: {
        id: player.id,
        username: player.username,
        displayName: player.displayName,
        avatarColor: player.avatarColor,
        chips: player.chips,
        lastDailyClaimed: player.lastDailyClaimed,
        roles: playerRoles,
        equippedNameEffect: player.equippedNameEffect ?? null,
        equippedCardSkin:   player.equippedCardSkin   ?? null,
        equippedTableBg:    player.equippedTableBg    ?? null,
      },
    });
  } catch (err) {
    console.error("[register]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string };

    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    const player = await playerRepo.findByUsername(username);
    if (!player) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const valid = await authService.verifyPassword(password, player.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    // Checked only after the password is verified, so we don't leak ban status.
    if (player.bannedAt) {
      res.status(403).json({
        error: player.banReason
          ? `This account is banned: ${player.banReason}`
          : "This account is banned",
      });
      return;
    }

    const token = authService.signToken({ playerId: player.id, username: player.username });
    const playerRoles = await roleRepo.getPlayerRoles(player.id);
    res.json({
      token,
      player: {
        id: player.id,
        username: player.username,
        displayName: player.displayName,
        avatarColor: player.avatarColor,
        chips: player.chips,
        lastDailyClaimed: player.lastDailyClaimed,
        roles: playerRoles,
        equippedNameEffect: player.equippedNameEffect ?? null,
        equippedCardSkin:   player.equippedCardSkin   ?? null,
        equippedTableBg:    player.equippedTableBg    ?? null,
      },
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/refresh", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const payload = authService.decodeTokenLenient(authHeader.slice(7));
    if (!payload) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const player = await playerRepo.findById(payload.playerId);
    if (!player) {
      res.status(401).json({ error: "Player not found" });
      return;
    }
    const token = authService.signToken({ playerId: player.id, username: player.username });
    const playerRoles = await roleRepo.getPlayerRoles(player.id);
    res.json({
      token,
      player: {
        id: player.id,
        username: player.username,
        displayName: player.displayName,
        avatarColor: player.avatarColor,
        chips: player.chips,
        lastDailyClaimed: player.lastDailyClaimed,
        roles: playerRoles,
        equippedNameEffect: player.equippedNameEffect ?? null,
        equippedCardSkin:   player.equippedCardSkin   ?? null,
        equippedTableBg:    player.equippedTableBg    ?? null,
      },
    });
  } catch (err) {
    console.error("[refresh]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/daily-reward", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await playerRepo.claimDailyReward(
      req.playerId!,
      DEFAULT_SETTINGS.dailyChips
    );
    res.json(result);
  } catch (err) {
    console.error("[daily-reward]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/players/:id/profile", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await playerRepo.findProfileById(req.params["id"] as string);
    if (!result) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    const { player, stats } = result;
    const playerRoles = await roleRepo.getPlayerRoles(player.id);
    const empty = { handsPlayed: 0, handsWon: 0, handsLost: 0, handsPushed: 0, blackjacks: 0, totalWagered: 0, netWinnings: 0, biggestWin: 0, biggestBet: 0, splitsMade: 0, doublesMade: 0, timesBusted: 0 };
    res.json({
      playerId: player.id,
      username: player.username,
      displayName: player.displayName,
      avatarColor: player.avatarColor,
      chips: player.chips,
      roles: playerRoles,
      equippedNameEffect: player.equippedNameEffect ?? null,
      stats: stats ? {
        handsPlayed: stats.handsPlayed,
        handsWon: stats.handsWon,
        handsLost: stats.handsLost,
        handsPushed: stats.handsPushed,
        blackjacks: stats.blackjacks,
        totalWagered: stats.totalWagered,
        netWinnings: stats.netWinnings,
        biggestWin: stats.biggestWin,
        biggestBet: stats.biggestBet,
        splitsMade: stats.splitsMade,
        doublesMade: stats.doublesMade,
        timesBusted: stats.timesBusted,
      } : empty,
    });
  } catch (err) {
    console.error("[profile]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/leaderboard", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const stat = (req.query["stat"] as string) ?? "chips";
    if (!["chips", "netWinnings", "handsPlayed"].includes(stat)) {
      res.status(400).json({ error: "Invalid stat" });
      return;
    }
    const entries = await playerRepo.getLeaderboard(stat as playerRepo.LeaderboardStat);
    res.json(entries);
  } catch (err) {
    console.error("[leaderboard]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/players/:id/achievements", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const unlocked = await achievementRepo.getUnlocked(req.params["id"] as string);
    const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));

    const achievements = ACHIEVEMENTS.map((def) => {
      const unlockedAt = unlockedMap.get(def.id);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
        unlockedAt: unlockedAt ? unlockedAt.getTime() : null,
      };
    });

    res.json({ achievements });
  } catch (err) {
    console.error("[achievements]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/players/:id/settings", requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.playerId !== req.params["id"]) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { displayName, avatarColor, currentPassword, newPassword } = req.body as {
      displayName: string;
      avatarColor: string;
      currentPassword?: string;
      newPassword?: string;
    };

    if (!displayName || displayName.trim().length < 2 || displayName.trim().length > 50) {
      res.status(400).json({ error: "Display name must be 2–50 characters" });
      return;
    }

    let passwordHash: string | undefined;
    if (currentPassword !== undefined || newPassword !== undefined) {
      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "Both current and new password are required to change password" });
        return;
      }
      if (newPassword.length < 8) {
        res.status(400).json({ error: "New password must be at least 12 characters" });
        return;
      }
      const player = await playerRepo.findById(req.playerId!);
      if (!player) {
        res.status(404).json({ error: "Player not found" });
        return;
      }
      const valid = await authService.verifyPassword(currentPassword, player.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }
      passwordHash = await authService.hashPassword(newPassword);
    }

    const updated = await playerRepo.updateProfile(
      req.playerId!,
      displayName.trim(),
      avatarColor ?? "#10B981",
      passwordHash
    );

    res.json({
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      avatarColor: updated.avatarColor,
      chips: updated.chips,
      lastDailyClaimed: updated.lastDailyClaimed,
    });
  } catch (err) {
    console.error("[settings]", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Vanity Endpoints ─────────────────────────────────────────────────────────

app.get("/api/vanity/name-effects", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [owned, equipped] = await Promise.all([
      vanityRepo.getOwnedEffects(req.playerId!),
      vanityRepo.getEquippedEffect(req.playerId!),
    ]);
    res.json({ catalog: NAME_EFFECTS, owned, equipped });
  } catch (err) {
    console.error("[vanity/name-effects]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/vanity/name-effects/purchase", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { effectKey } = req.body as { effectKey?: string };
    if (!effectKey || !NAME_EFFECT_KEYS.has(effectKey) || effectKey === "default") {
      res.status(400).json({ error: "Invalid effect" });
      return;
    }
    const effect = NAME_EFFECTS.find((e) => e.key === effectKey)!;
    if (effect.requiredRole) {
      res.status(400).json({ error: "This effect cannot be purchased" });
      return;
    }
    const result = await vanityRepo.purchaseEffect(req.playerId!, effectKey, effect.cost);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ chips: result.chips });
  } catch (err) {
    console.error("[vanity/purchase]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/vanity/name-effects/equip", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { effectKey } = req.body as { effectKey?: string | null };
    const key = !effectKey || effectKey === "default" ? null : effectKey;
    if (key !== null) {
      if (!NAME_EFFECT_KEYS.has(key)) {
        res.status(400).json({ error: "Invalid effect" });
        return;
      }
      const effect = NAME_EFFECTS.find((e) => e.key === key)!;
      if (effect?.requiredRole) {
        // Role-locked effect: verify the player holds the required role
        const playerRoles = await roleRepo.getPlayerRoles(req.playerId!);
        if (!playerRoles.some((r) => r.name === effect.requiredRole)) {
          res.status(403).json({ error: "You don't have access to this effect" });
          return;
        }
      } else {
        // Regular effect: verify ownership
        const owned = await vanityRepo.getOwnedEffects(req.playerId!);
        if (!owned.includes(key)) {
          res.status(403).json({ error: "Effect not owned" });
          return;
        }
      }
    }
    await vanityRepo.equipEffect(req.playerId!, key);
    res.json({ effectKey: key });
  } catch (err) {
    console.error("[vanity/equip]", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Skin Endpoints ───────────────────────────────────────────────────────────

app.get("/api/vanity/card-skins", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [owned, equipped] = await Promise.all([
      skinsRepo.getOwnedSkins(req.playerId!, "card"),
      skinsRepo.getEquippedSkin(req.playerId!, "card"),
    ]);
    res.json({ catalog: CARD_SKINS, owned, equipped });
  } catch (err) {
    console.error("[vanity/card-skins]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/vanity/card-skins/purchase", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { skinKey } = req.body as { skinKey?: string };
    if (!skinKey || !CARD_SKIN_KEYS.has(skinKey) || skinKey === "default") {
      res.status(400).json({ error: "Invalid skin" });
      return;
    }
    const skin = CARD_SKINS.find((s) => s.key === skinKey)!;
    if (skin.requiredRole) {
      res.status(400).json({ error: "This skin cannot be purchased" });
      return;
    }
    const result = await skinsRepo.purchaseSkin(req.playerId!, "card", skinKey, skin.cost);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ chips: result.chips });
  } catch (err) {
    console.error("[vanity/card-skins/purchase]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/vanity/card-skins/equip", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { skinKey } = req.body as { skinKey?: string | null };
    const key = !skinKey || skinKey === "default" ? null : skinKey;
    if (key !== null) {
      if (!CARD_SKIN_KEYS.has(key)) {
        res.status(400).json({ error: "Invalid skin" });
        return;
      }
      const skin = CARD_SKINS.find((s) => s.key === key)!;
      if (skin.requiredRole) {
        const playerRoles = await roleRepo.getPlayerRoles(req.playerId!);
        if (!playerRoles.some((r) => r.name === skin.requiredRole)) {
          res.status(403).json({ error: "You don't have access to this skin" });
          return;
        }
      } else {
        const owned = await skinsRepo.getOwnedSkins(req.playerId!, "card");
        if (!owned.includes(key)) {
          res.status(403).json({ error: "Skin not owned" });
          return;
        }
      }
    }
    await skinsRepo.equipSkin(req.playerId!, "card", key);
    res.json({ skinKey: key });
  } catch (err) {
    console.error("[vanity/card-skins/equip]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/vanity/table-bgs", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [owned, equipped] = await Promise.all([
      skinsRepo.getOwnedSkins(req.playerId!, "table-bg"),
      skinsRepo.getEquippedSkin(req.playerId!, "table-bg"),
    ]);
    res.json({ catalog: TABLE_BGS, owned, equipped });
  } catch (err) {
    console.error("[vanity/table-bgs]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/vanity/table-bgs/purchase", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { skinKey } = req.body as { skinKey?: string };
    if (!skinKey || !TABLE_BG_KEYS.has(skinKey) || skinKey === "default") {
      res.status(400).json({ error: "Invalid background" });
      return;
    }
    const bg = TABLE_BGS.find((b) => b.key === skinKey)!;
    if (bg.requiredRole) {
      res.status(400).json({ error: "This background cannot be purchased" });
      return;
    }
    const result = await skinsRepo.purchaseSkin(req.playerId!, "table-bg", skinKey, bg.cost);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ chips: result.chips });
  } catch (err) {
    console.error("[vanity/table-bgs/purchase]", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/vanity/table-bgs/equip", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { skinKey } = req.body as { skinKey?: string | null };
    const key = !skinKey || skinKey === "default" ? null : skinKey;
    if (key !== null) {
      if (!TABLE_BG_KEYS.has(key)) {
        res.status(400).json({ error: "Invalid background" });
        return;
      }
      const bg = TABLE_BGS.find((b) => b.key === key)!;
      if (bg.requiredRole) {
        const playerRoles = await roleRepo.getPlayerRoles(req.playerId!);
        if (!playerRoles.some((r) => r.name === bg.requiredRole)) {
          res.status(403).json({ error: "You don't have access to this background" });
          return;
        }
      } else {
        const owned = await skinsRepo.getOwnedSkins(req.playerId!, "table-bg");
        if (!owned.includes(key)) {
          res.status(403).json({ error: "Background not owned" });
          return;
        }
      }
    }
    await skinsRepo.equipSkin(req.playerId!, "table-bg", key);
    res.json({ skinKey: key });
  } catch (err) {
    console.error("[vanity/table-bgs/equip]", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Socket.io ───────────────────────────────────────────────────────────────

type SocketData = { playerId: string; username: string };
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;

const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>(
  httpServer,
  {
    cors: {
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  }
);

// Validate JWT on every socket connection
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error("Authentication required"));
    return;
  }
  const payload = authService.verifyToken(token);
  if (!payload) {
    next(new Error("Invalid or expired token"));
    return;
  }
  // A ban blocks the socket too, otherwise an already-issued JWT would still
  // let a banned player keep playing until it expired.
  try {
    const ban = await adminRepo.getBanStatus(payload.playerId);
    if (ban.banned) {
      next(new Error(ban.reason ? `Banned: ${ban.reason}` : "This account is banned"));
      return;
    }
  } catch (err) {
    console.error("[socket auth] ban check failed", err);
  }
  socket.data.playerId = payload.playerId;
  socket.data.username = payload.username;
  next();
});

const rooms = new Map<string, GameRoom>();
const socketRoom = new Map<string, string>(); // socketId -> roomCode

/** Broadcasts the current public room list to ALL connected sockets. */
function broadcastRoomList() {
  const listing = [...rooms.values()]
    .filter((r) => !r.state.settings.isPrivate)
    .map((r) => r.getListing());
  io.emit("rooms:updated", listing);
}

function generateRoomCode(): string {
  let code: string;
  do {
    code = nanoid(ROOM_CODE_LENGTH).toUpperCase();
  } while (rooms.has(code));
  return code;
}

io.on("connection", (socket: AppSocket) => {
  const playerId = socket.data.playerId;
  const playerName = socket.data.username;
  console.log(`[server] connected: ${socket.id} (player: ${playerName}, id: ${playerId})`);

  socket.on("room:create", async (payload, callback) => {
    try {
      const player = await playerRepo.findById(playerId);
      if (!player) {
        callback({ success: false, error: "Player not found" });
        return;
      }

      const code = generateRoomCode();
      const room = new GameRoom(
        code,
        io,
        payload.settings ?? {},
        async (players, results) => {
          const dealerCards = room.state.dealerHand.cards;
          const dealerRevealed = dealerCards.length > 0 && dealerCards.every((c) => !c.faceDown);
          const dealerTotal = (() => {
            let best = 0, aces = 0;
            for (const c of dealerCards) {
              if (c.rank === "A") { best += 11; aces++; }
              else best += Math.min(10, Number(c.rank) || 10);
            }
            while (best > 21 && aces-- > 0) best -= 10;
            return best;
          })();
          const dealerBusted = dealerRevealed && dealerTotal > 21;

          await Promise.all([
            Promise.all(players.map((p) => playerRepo.updateChips(p.playerId, p.chips))),
            statsRepo.recordRoundResults(results, players),
          ]);
          await achievementEngine.processRound(
            players,
            results,
            (event, data) => (io.to(code) as any).emit(event, data),
            dealerBusted,
            room.state.settings.maxBet
          );

          // One concise line per completed round: enough to follow the action
          // on the backend without a per-move play-by-play.
          const tally = results.reduce(
            (a, r) => {
              if (r.result === "win" || r.result === "blackjack" || r.result === "five-card-charlie") a.w++;
              else if (r.result === "push") a.p++;
              else a.l++;
              return a;
            },
            { w: 0, l: 0, p: 0 }
          );
          log.info(
            "game",
            `${code} round ${room.state.roundNumber}: ${results.length} hand(s) ` +
              `${tally.w}W/${tally.l}L/${tally.p}P, dealer ${dealerTotal}${dealerBusted ? " bust" : ""}`
          );
        },
        broadcastRoomList
      );
      rooms.set(code, room);

      const playerRoles = await roleRepo.getPlayerRoles(playerId);
      const result = room.addPlayer(
        socket,
        playerId,
        player.displayName,
        player.avatarColor,
        player.chips,
        playerRoles,
        player.equippedNameEffect ?? null,
        player.equippedCardSkin   ?? null
      );
      if (!result.success) {
        rooms.delete(code);
        room.destroy();
        callback({ success: false, error: result.error });
        return;
      }

      socketRoom.set(socket.id, code);
      callback({ success: true, roomCode: code });
      console.log(`[server] room created: ${code} (by player: ${playerName}, id: ${playerId})`);
      broadcastRoomList();
      room.sendChatHistory(socket).catch(console.error);
    } catch (err) {
      console.error("[server] room:create error", err);
      callback({ success: false, error: "Server error" });
    }
  });

  socket.on("room:join", async (payload, callback) => {
    try {
      const code = payload.roomCode.toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }

      const player = await playerRepo.findById(playerId);
      if (!player) {
        callback({ success: false, error: "Player not found" });
        return;
      }

      const playerRoles = await roleRepo.getPlayerRoles(playerId);
      const result = room.addPlayer(
        socket,
        playerId,
        player.displayName,
        player.avatarColor,
        player.chips,
        playerRoles,
        player.equippedNameEffect ?? null,
        player.equippedCardSkin   ?? null
      );
      if (!result.success) {
        callback({ success: false, error: result.error });
        return;
      }

      socketRoom.set(socket.id, code);
      callback({ success: true, state: room.state });
      console.log(`[server] player ${playerName} (id: ${playerId}) joined room: ${code}`);
      broadcastRoomList();
      room.sendChatHistory(socket).catch(console.error);
    } catch (err) {
      console.error("[server] room:join error", err);
      callback({ success: false, error: "Server error" });
    }
  });

  socket.on("room:leave", () => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.removePlayer(socket.id, true);
      console.log(`[server] player ${playerName} (id: ${playerId}) left room: ${code}`);
      if (room.isEmpty) {
        room.destroy();
        rooms.delete(code);
        log.info("room", `${code} closed (empty)`);
      }
      broadcastRoomList();
    }
    socketRoom.delete(socket.id);
  });

  socket.on("room:start", () => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms.get(code)?.handleStart(socket.id);
  });

  socket.on("room:update-settings", (settings) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms.get(code)?.handleUpdateSettings(socket.id, settings);
  });

  socket.on("game:place-bet", ({ amount }) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms.get(code)?.handlePlaceBet(socket.id, amount);
  });

  socket.on("game:hit", ({ handId }) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms.get(code)?.handleHit(socket.id, handId);
  });

  socket.on("game:stand", ({ handId }) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms.get(code)?.handleStand(socket.id, handId);
  });

  socket.on("game:double", ({ handId }) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms.get(code)?.handleDouble(socket.id, handId);
  });

  socket.on("game:split", ({ handId }) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms.get(code)?.handleSplit(socket.id, handId);
  });

  socket.on("game:insurance", ({ take }) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms.get(code)?.handleInsurance(socket.id, take);
  });

  socket.on("chat:send", ({ message }) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms
      .get(code)
      ?.handleChatMessage(socket.id, message)
      .catch((err) => console.error("[chat:send]", err));
  });

  socket.on("chat:remove_message", ({ messageId }) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms.get(code)?.handleRemoveMessage(socket.id, messageId);
  });

  socket.on("chat:clear", () => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    rooms.get(code)?.handleClearChat(socket.id);
  });

  // Use "disconnecting" (not "disconnect") because socket.rooms is still populated at this point.
  // By the time "disconnect" fires, socket.rooms has already been cleared.
  socket.on("disconnecting", () => {
    console.log(`[server] disconnecting: ${socket.id}`);
    const code = socketRoom.get(socket.id);
    if (code) {
      const room = rooms.get(code);
      if (room) {
        room.removePlayer(socket.id);
        if (room.isEmpty) {
          room.destroy();
          rooms.delete(code);
          log.info("room", `${code} closed (empty)`);
        }
        broadcastRoomList();
      }
      socketRoom.delete(socket.id);
    }
  });

  socket.on("rooms:subscribe", (callback) => {
    const listing = [...rooms.values()]
      .filter((r) => !r.state.settings.isPrivate)
      .map((r) => r.getListing());
    callback(listing);
  });
});

// ─── Admin API ───────────────────────────────────────────────────────────────
// Every endpoint is gated by a permission key (app/lib/permissions.ts). Which
// roles hold which keys lives on the roles table and is editable at runtime, so
// access can be retuned without a deploy. The server always re-checks.

/** Force every live socket for a player to disconnect (used by ban and kick). */
function disconnectPlayer(playerId: string, message: string): void {
  for (const [, s] of io.sockets.sockets) {
    const sock = s as AppSocket;
    if (sock.data?.playerId === playerId) {
      sock.emit("error", { code: "FORCE_DISCONNECT", message });
      sock.disconnect(true);
    }
  }
}

app.get(
  "/api/admin/players",
  requireAuth,
  requirePermission("admin.access"),
  async (req: AuthedRequest, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      res.json({ players: await adminRepo.searchPlayers(q) });
    } catch (err) {
      console.error("[admin/players]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.get(
  "/api/admin/players/:id",
  requireAuth,
  requirePermission("admin.access"),
  async (req: AuthedRequest, res) => {
    try {
      const detail = await adminRepo.getPlayerDetail((req.params.id as string));
      if (!detail) {
        res.status(404).json({ error: "Player not found" });
        return;
      }
      res.json(detail);
    } catch (err) {
      console.error("[admin/player-detail]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.get(
  "/api/admin/roles",
  requireAuth,
  requirePermission("admin.access"),
  async (_req: AuthedRequest, res) => {
    try {
      res.json({ roles: await roleRepo.findAllRoles() });
    } catch (err) {
      console.error("[admin/roles]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.get(
  "/api/admin/achievements",
  requireAuth,
  requirePermission("admin.access"),
  (_req: AuthedRequest, res) => {
    res.json({
      achievements: ACHIEVEMENTS.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        icon: a.icon,
      })),
    });
  }
);

// ── Economy & player data ────────────────────────────────────────────────────

app.post(
  "/api/admin/players/:id/chips",
  requireAuth,
  requirePermission("player.adjust_chips"),
  async (req: AuthedRequest, res) => {
    try {
      const { set, delta } = req.body ?? {};
      let chips: number;
      if (typeof set === "number" && Number.isFinite(set)) {
        chips = await adminRepo.setChips((req.params.id as string), set);
      } else if (typeof delta === "number" && Number.isFinite(delta)) {
        chips = await adminRepo.adjustChips((req.params.id as string), delta);
      } else {
        res.status(400).json({ error: "Provide a numeric `set` or `delta`" });
        return;
      }
      // If the player is seated at a live table, push the new balance into the
      // in-memory game state too. The round-end flush writes that value back to
      // the DB, so skipping this would quietly undo the adjustment.
      let syncedToTable = false;
      for (const room of rooms.values()) {
        if (room.syncPlayerChips(req.params.id as string, chips)) {
          syncedToTable = true;
          break;
        }
      }
      log.info(
        "admin",
        `${req.username} set chips of ${(req.params.id as string)} to ${chips}` +
          (syncedToTable ? " (synced to live table)" : "")
      );
      res.json({ chips });
    } catch (err) {
      console.error("[admin/chips]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.post(
  "/api/admin/players/:id/reset-stats",
  requireAuth,
  requirePermission("player.reset_stats"),
  async (req: AuthedRequest, res) => {
    try {
      await adminRepo.resetStats((req.params.id as string));
      log.info("admin", `${req.username} reset stats of ${(req.params.id as string)}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin/reset-stats]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.post(
  "/api/admin/players/:id/achievements/:achievementId",
  requireAuth,
  requirePermission("player.grant_achievement"),
  async (req: AuthedRequest, res) => {
    try {
      if (!ACHIEVEMENT_MAP.has((req.params.achievementId as string))) {
        res.status(400).json({ error: "Unknown achievement" });
        return;
      }
      await achievementRepo.unlockAchievement((req.params.id as string), (req.params.achievementId as string));
      log.info("admin", `${req.username} granted "${(req.params.achievementId as string)}" to ${(req.params.id as string)}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin/grant-achievement]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.delete(
  "/api/admin/players/:id/achievements/:achievementId",
  requireAuth,
  requirePermission("player.revoke_achievement"),
  async (req: AuthedRequest, res) => {
    try {
      await achievementRepo.revokeAchievement((req.params.id as string), (req.params.achievementId as string));
      log.info("admin", `${req.username} revoked "${(req.params.achievementId as string)}" from ${(req.params.id as string)}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin/revoke-achievement]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ── Moderation ───────────────────────────────────────────────────────────────

app.post(
  "/api/admin/players/:id/kick",
  requireAuth,
  requirePermission("player.kick"),
  async (req: AuthedRequest, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 200) : null;
      disconnectPlayer(
        (req.params.id as string),
        reason ? `Kicked from the table: ${reason}` : "You were kicked from the table."
      );
      log.info("admin", `${req.username} kicked ${(req.params.id as string)}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin/kick]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.post(
  "/api/admin/players/:id/ban",
  requireAuth,
  requirePermission("player.ban"),
  async (req: AuthedRequest, res) => {
    try {
      if ((req.params.id as string) === req.playerId) {
        res.status(400).json({ error: "You can't ban yourself" });
        return;
      }
      const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 200) : null;
      await adminRepo.setBan((req.params.id as string), true, reason);
      disconnectPlayer((req.params.id as string), reason ? `Banned: ${reason}` : "You have been banned.");
      log.warn("admin", `${req.username} BANNED ${(req.params.id as string)}${reason ? ` (${reason})` : ""}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin/ban]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.post(
  "/api/admin/players/:id/unban",
  requireAuth,
  requirePermission("player.unban"),
  async (req: AuthedRequest, res) => {
    try {
      await adminRepo.setBan((req.params.id as string), false, null);
      log.info("admin", `${req.username} unbanned ${(req.params.id as string)}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin/unban]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.post(
  "/api/admin/players/:id/mute",
  requireAuth,
  requirePermission("player.mute"),
  async (req: AuthedRequest, res) => {
    try {
      const minutes = req.body?.minutes;
      // Absent / null / <= 0 means unmute. Capped at one year.
      const until =
        typeof minutes === "number" && minutes > 0
          ? new Date(Date.now() + Math.min(minutes, 525_600) * 60_000)
          : null;
      await adminRepo.setMute((req.params.id as string), until);
      log.info(
        "admin",
        `${req.username} ${until ? `muted ${(req.params.id as string)} until ${until.toISOString()}` : `unmuted ${(req.params.id as string)}`}`
      );
      res.json({ ok: true, mutedUntil: until });
    } catch (err) {
      console.error("[admin/mute]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ── Roles ────────────────────────────────────────────────────────────────────
// Assigning/editing roles is guarded against privilege escalation: you may only
// touch permissions you already hold yourself.

app.post(
  "/api/admin/players/:id/roles/:roleId",
  requireAuth,
  requirePermission("role.assign"),
  async (req: AuthedRequest, res) => {
    try {
      const role = await roleRepo.findRoleById((req.params.roleId as string));
      if (!role) {
        res.status(404).json({ error: "Role not found" });
        return;
      }
      if (!outranks(req.callerPerms, role.permissions ?? [])) {
        res
          .status(403)
          .json({ error: "You can't assign a role holding permissions you don't have" });
        return;
      }
      await roleRepo.addRoleToPlayer((req.params.id as string), (req.params.roleId as string));
      log.info("admin", `${req.username} assigned role ${role.name} to ${(req.params.id as string)}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin/assign-role]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.delete(
  "/api/admin/players/:id/roles/:roleId",
  requireAuth,
  requirePermission("role.assign"),
  async (req: AuthedRequest, res) => {
    try {
      const role = await roleRepo.findRoleById((req.params.roleId as string));
      if (!role) {
        res.status(404).json({ error: "Role not found" });
        return;
      }
      if (!outranks(req.callerPerms, role.permissions ?? [])) {
        res
          .status(403)
          .json({ error: "You can't remove a role holding permissions you don't have" });
        return;
      }
      await roleRepo.removeRoleFromPlayer((req.params.id as string), (req.params.roleId as string));
      log.info("admin", `${req.username} removed role ${role.name} from ${(req.params.id as string)}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin/revoke-role]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.put(
  "/api/admin/roles/:id/permissions",
  requireAuth,
  requirePermission("role.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const role = await roleRepo.findRoleById((req.params.id as string));
      if (!role) {
        res.status(404).json({ error: "Role not found" });
        return;
      }
      const requested: string[] = Array.isArray(req.body?.permissions)
        ? req.body.permissions.filter((p: unknown): p is string => typeof p === "string")
        : [];
      const invalid = requested.filter((p) => !isPermission(p));
      if (invalid.length) {
        res.status(400).json({ error: `Unknown permissions: ${invalid.join(", ")}` });
        return;
      }
      // Can't edit a role that already holds keys you lack, and can't grant keys you lack.
      if (!outranks(req.callerPerms, role.permissions ?? [])) {
        res.status(403).json({ error: "You can't edit a role that outranks you" });
        return;
      }
      if (!outranks(req.callerPerms, requested)) {
        res.status(403).json({ error: "You can't grant permissions you don't have" });
        return;
      }
      const updatedRole = await roleRepo.setRolePermissions((req.params.id as string), requested);
      log.info(
        "admin",
        `${req.username} set ${updatedRole.name} permissions to [${requested.join(", ") || "none"}]`
      );
      res.json({ role: updatedRole });
    } catch (err) {
      console.error("[admin/role-permissions]", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ─── Static Frontend (production) ────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientBuild = join(__dirname, "../build/client");

if (existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get("*", (_req, res) => {
    res.sendFile(join(clientBuild, "index.html"));
  });
  console.log(`[server] serving static files from ${clientBuild}`);
}

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
httpServer.listen(PORT, HOST, () => {
  console.log(`[server] listening on ${HOST}:${PORT}`);
});
