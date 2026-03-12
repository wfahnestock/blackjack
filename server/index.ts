import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server, type Socket } from "socket.io";
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
import * as statsRepo from "./db/StatsRepository.js";
import * as authService from "./auth/AuthService.js";

// ─── Express ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
const httpServer = createServer(app);

// ─── Auth Middleware ─────────────────────────────────────────────────────────

type AuthedRequest = express.Request & { playerId?: string };

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
  next();
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
      },
    });
  } catch (err) {
    console.error("[login]", err);
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
        res.status(400).json({ error: "New password must be at least 8 characters" });
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
io.use((socket, next) => {
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
  socket.data.playerId = payload.playerId;
  socket.data.username = payload.username;
  next();
});

const rooms = new Map<string, GameRoom>();

function generateRoomCode(): string {
  let code: string;
  do {
    code = nanoid(ROOM_CODE_LENGTH).toUpperCase();
  } while (rooms.has(code));
  return code;
}

io.on("connection", (socket: AppSocket) => {
  const playerId = socket.data.playerId;
  console.log(`[server] connected: ${socket.id} (player: ${playerId})`);

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
          await Promise.all([
            Promise.all(players.map((p) => playerRepo.updateChips(p.playerId, p.chips))),
            statsRepo.recordRoundResults(results, players),
          ]);
        }
      );
      rooms.set(code, room);

      const playerRoles = await roleRepo.getPlayerRoles(playerId);
      const result = room.addPlayer(
        socket,
        playerId,
        player.displayName,
        player.avatarColor,
        player.chips,
        playerRoles
      );
      if (!result.success) {
        rooms.delete(code);
        room.destroy();
        callback({ success: false, error: result.error });
        return;
      }

      callback({ success: true, roomCode: code });
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
        playerRoles
      );
      if (!result.success) {
        callback({ success: false, error: result.error });
        return;
      }

      callback({ success: true, state: room.state });
      room.sendChatHistory(socket).catch(console.error);
    } catch (err) {
      console.error("[server] room:join error", err);
      callback({ success: false, error: "Server error" });
    }
  });

  socket.on("room:leave", () => {
    for (const [code, room] of rooms) {
      if (socket.rooms.has(code)) {
        room.removePlayer(socket.id);
        if (room.isEmpty) {
          room.destroy();
          rooms.delete(code);
        }
        break;
      }
    }
  });

  socket.on("room:start", () => {
    for (const [, room] of rooms) {
      if (socket.rooms.has(room.code)) {
        room.handleStart(socket.id);
        break;
      }
    }
  });

  socket.on("room:update-settings", (settings) => {
    for (const [, room] of rooms) {
      if (socket.rooms.has(room.code)) {
        room.handleUpdateSettings(socket.id, settings);
        break;
      }
    }
  });

  socket.on("game:place-bet", ({ amount }) => {
    for (const [, room] of rooms) {
      if (socket.rooms.has(room.code)) {
        room.handlePlaceBet(socket.id, amount);
        break;
      }
    }
  });

  socket.on("game:hit", ({ handId }) => {
    for (const [, room] of rooms) {
      if (socket.rooms.has(room.code)) {
        room.handleHit(socket.id, handId);
        break;
      }
    }
  });

  socket.on("game:stand", ({ handId }) => {
    for (const [, room] of rooms) {
      if (socket.rooms.has(room.code)) {
        room.handleStand(socket.id, handId);
        break;
      }
    }
  });

  socket.on("game:double", ({ handId }) => {
    for (const [, room] of rooms) {
      if (socket.rooms.has(room.code)) {
        room.handleDouble(socket.id, handId);
        break;
      }
    }
  });

  socket.on("game:split", ({ handId }) => {
    for (const [, room] of rooms) {
      if (socket.rooms.has(room.code)) {
        room.handleSplit(socket.id, handId);
        break;
      }
    }
  });

  socket.on("chat:send", ({ message }) => {
    for (const [, room] of rooms) {
      if (socket.rooms.has(room.code)) {
        room.handleChatMessage(socket.id, message);
        break;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`[server] disconnected: ${socket.id}`);
    for (const [code, room] of rooms) {
      if (socket.rooms.has(code) || room.state.players.length > 0) {
        room.removePlayer(socket.id);
        if (room.isEmpty) {
          room.destroy();
          rooms.delete(code);
        }
        break;
      }
    }
  });
});

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
httpServer.listen(PORT, HOST, () => {
  console.log(`[server] listening on ${HOST}:${PORT}`);
});
