import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { nanoid } from "nanoid";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../app/lib/types.js";
import { ROOM_CODE_LENGTH } from "../app/lib/constants.js";
import { GameRoom } from "./GameRoom.js";
import { ChipLedger } from "./ChipLedger.js";

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const rooms = new Map<string, GameRoom>();
const ledger = new ChipLedger();

function generateRoomCode(): string {
  let code: string;
  do {
    code = nanoid(ROOM_CODE_LENGTH).toUpperCase();
  } while (rooms.has(code));
  return code;
}

io.on("connection", (socket) => {
  console.log(`[server] connected: ${socket.id}`);

  socket.on("room:create", (payload, callback) => {
    try {
      const code = generateRoomCode();
      const room = new GameRoom(code, io, payload.settings ?? {}, ledger);
      rooms.set(code, room);

      const result = room.addPlayer(
        socket,
        payload.playerId,
        payload.displayName,
        payload.avatarColor
      );

      if (!result.success) {
        rooms.delete(code);
        room.destroy();
        callback({ success: false, error: result.error });
        return;
      }

      callback({ success: true, roomCode: code });
    } catch (err) {
      console.error("[server] room:create error", err);
      callback({ success: false, error: "Server error" });
    }
  });

  socket.on("room:join", (payload, callback) => {
    try {
      const code = payload.roomCode.toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }

      const result = room.addPlayer(
        socket,
        payload.playerId,
        payload.displayName,
        payload.avatarColor
      );

      if (!result.success) {
        callback({ success: false, error: result.error });
        return;
      }

      callback({ success: true, state: room.state });
    } catch (err) {
      console.error("[server] room:join error", err);
      callback({ success: false, error: "Server error" });
    }
  });

  socket.on("room:leave", () => {
    // Find room this socket is in
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
  console.log(`[server] Socket.io listening on ${HOST}:${PORT}`);
});
