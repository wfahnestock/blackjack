import { randomUUID } from "crypto";
import type { Server, Socket } from "socket.io";
import type {
  Player,
  GameSettings,
  ClientToServerEvents,
  ServerToClientEvents,
  RoundResult,
  ChatMessage,
  RoleInfo,
  RoomListing,
} from "../app/lib/types.js";
import { DEFAULT_SETTINGS, MAX_PLAYERS, MAX_CHAT_MESSAGE_LENGTH, MAX_CHAT_HISTORY, MODERATOR_ROLE_NAMES } from "../app/lib/constants.js";
import { GameStateMachine } from "./GameStateMachine.js";
import * as chatRepo from "./db/ChatRepository.js";
import * as roleRepo from "./db/RoleRepository.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

interface ChatRateLimit {
  lastAt: number;
  lastContent: string;
}

export class GameRoom {
  readonly code: string;
  private machine: GameStateMachine;
  private socketToPlayer = new Map<string, string>();     // socketId → playerId
  private playerToSocket = new Map<string, string>();     // playerId → socketId
  private chatRateLimits = new Map<string, ChatRateLimit>(); // playerId → rate limit state
  private playerRolesCache = new Map<string, RoleInfo[]>(); // playerId → roles (cached on join)

  constructor(
    code: string,
    private io: AppServer,
    settings: Partial<GameSettings>,
    flushRound?: (players: Player[], results: RoundResult[]) => Promise<void>,
    private onListingChanged?: () => void
  ) {
    this.code = code;
    const merged: GameSettings = { ...DEFAULT_SETTINGS, ...settings };
    this.machine = new GameStateMachine(
      code,
      merged,
      (event, data) => {
        this.broadcast(event, data);
        // Phase changes affect the room listing (In Lobby ↔ In Game)
        if (event === "state:phase-changed") onListingChanged?.();
      }
    );

    if (flushRound) {
      this.machine.onRoundEnd = (players, results) => {
        flushRound(players, results).catch((err) =>
          console.error("[GameRoom] flushRound error", err)
        );
      };
    }
  }

  get playerCount(): number {
    return this.machine.state.players.length;
  }

  get isEmpty(): boolean {
    // True when there are no players at all, OR every remaining player is disconnected
    // (i.e. they left mid-game). In either case nobody is actively using the room.
    return this.machine.state.players.every((p) => p.status === "disconnected");
  }

  get state() {
    return this.machine.state;
  }

  addPlayer(
    socket: AppSocket,
    playerId: string,
    displayName: string,
    avatarColor: string,
    initialChips: number,
    roles: RoleInfo[] = []
  ): { success: boolean; error?: string } {
    if (this.playerCount >= MAX_PLAYERS) {
      return { success: false, error: "Room is full" };
    }

    const existing = this.machine.getPlayer(playerId);
    if (existing) {
      // Reconnect
      this.socketToPlayer.set(socket.id, playerId);
      this.playerToSocket.set(playerId, socket.id);
      this.playerRolesCache.set(playerId, roles);
      socket.join(this.code);
      this.machine.updatePlayer(playerId, { status: "connected", displayName });
      // Send full state to the reconnecting socket so their client has current game state
      socket.emit("state:sync", this.machine.state);
      this.broadcast("state:player-updated", this.machine.getPlayer(playerId)!);
      this.onListingChanged?.();
      return { success: true };
    }

    const isHost = this.playerCount === 0;
    const seatIndex = this.nextSeat();

    const player: Player = {
      playerId,
      displayName,
      seatIndex,
      chips: initialChips,
      hands: [],
      status: "connected",
      isHost,
      avatarColor,
    };

    this.machine.addPlayer(player);
    this.socketToPlayer.set(socket.id, playerId);
    this.playerToSocket.set(playerId, socket.id);
    this.playerRolesCache.set(playerId, roles);
    socket.join(this.code);

    this.broadcast("state:sync", this.machine.state);
    this.onListingChanged?.();
    return { success: true };
  }

  removePlayer(socketId: string, intentional = false): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return;

    // Leave the socket.io room so the socket stops receiving room broadcasts
    const socket = this.io.sockets.sockets.get(socketId);
    socket?.leave(this.code);

    this.socketToPlayer.delete(socketId);
    this.playerToSocket.delete(playerId);
    this.playerRolesCache.delete(playerId);

    const player = this.machine.getPlayer(playerId);
    if (player) {
      const isActiveMidRound =
        this.machine.state.phase !== "lobby" && this.machine.state.phase !== "cleanup";

      if (!intentional && isActiveMidRound) {
        // Unintentional disconnect mid-round: keep the player in state but mark offline
        this.machine.updatePlayer(playerId, { status: "disconnected" });
        this.broadcast("state:player-updated", this.machine.getPlayer(playerId)!);
        this.onListingChanged?.();
        return;
      }

      // Intentional leave, or leaving from lobby/cleanup: remove entirely
      this.machine.removePlayer(playerId);
      // Reassign host if needed
      if (player.isHost && this.playerCount > 0) {
        const nextHost = this.machine.state.players[0];
        this.machine.updatePlayer(nextHost.playerId, { isHost: true });
      }
    }

    this.broadcast("state:sync", this.machine.state);
    this.onListingChanged?.();
  }

  handleStart(socketId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    const player = playerId ? this.machine.getPlayer(playerId) : null;
    if (!player?.isHost) return;
    if (this.machine.state.phase !== "lobby") return;
    if (this.playerCount < 1) return;

    this.machine.startBetting();
  }

  handleUpdateSettings(socketId: string, settings: Partial<GameSettings>): void {
    const playerId = this.socketToPlayer.get(socketId);
    const player = playerId ? this.machine.getPlayer(playerId) : null;
    if (!player?.isHost) return;
    if (this.machine.state.phase !== "lobby") return;

    Object.assign(this.machine.state.settings, settings);
    this.broadcast("state:sync", this.machine.state);
    this.onListingChanged?.();
  }

  handlePlaceBet(socketId: string, amount: number): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return;
    this.machine.placeBet(playerId, amount);
  }

  handleHit(socketId: string, handId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return;
    this.machine.handleHit(playerId, handId);
  }

  handleStand(socketId: string, handId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return;
    this.machine.handleStand(playerId, handId);
  }

  handleDouble(socketId: string, handId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return;
    this.machine.handleDouble(playerId, handId);
  }

  handleSplit(socketId: string, handId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return;
    this.machine.handleSplit(playerId, handId);
  }

  handleChatMessage(socketId: string, rawMessage: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return;

    const player = this.machine.getPlayer(playerId);
    if (!player) return;

    const message = rawMessage.trim();
    if (message.length === 0 || message.length > MAX_CHAT_MESSAGE_LENGTH) return;

    const now = Date.now();
    const rateLimit = this.chatRateLimits.get(playerId) ?? { lastAt: 0, lastContent: "" };

    if (message === rateLimit.lastContent) {
      if (now - rateLimit.lastAt < 15_000) {
        const remaining = Math.ceil((15_000 - (now - rateLimit.lastAt)) / 1000);
        (this.io.to(socketId) as any).emit("chat:error", {
          message: `Wait ${remaining}s before repeating the same message.`,
        });
        return;
      }
    } else {
      if (now - rateLimit.lastAt < 2_000) {
        (this.io.to(socketId) as any).emit("chat:error", {
          message: "You're sending messages too fast. Please wait a moment.",
        });
        return;
      }
    }

    this.chatRateLimits.set(playerId, { lastAt: now, lastContent: message });

    const messageId = randomUUID();
    const chatMessage: ChatMessage = {
      messageId,
      playerId,
      displayName: player.displayName,
      avatarColor: player.avatarColor,
      message,
      censored: false,
      timestamp: now,
      roles: this.playerRolesCache.get(playerId) ?? [],
    };

    this.broadcast("chat:message", chatMessage);

    chatRepo
      .saveMessage({
        id: messageId,
        roomCode: this.code,
        playerId,
        displayName: player.displayName,
        avatarColor: player.avatarColor,
        message,
      })
      .catch((err) => console.error("[GameRoom] chat save error", err));
  }

  handleRemoveMessage(socketId: string, messageId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId || !this.hasModerationPrivilege(playerId)) return;

    chatRepo
      .censorMessage(messageId)
      .catch((err) => console.error("[GameRoom] censorMessage error", err));

    this.broadcast("chat:message_removed", { messageId });
  }

  handleClearChat(socketId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId || !this.hasModerationPrivilege(playerId)) return;

    const player = this.machine.getPlayer(playerId);
    if (!player) return;

    chatRepo
      .clearRoomMessages(this.code)
      .catch((err) => console.error("[GameRoom] clearRoomMessages error", err));

    this.broadcast("chat:cleared", { clearedBy: player.displayName });
  }

  async sendChatHistory(socket: AppSocket): Promise<void> {
    try {
      const rows = await chatRepo.getRecentMessages(this.code, MAX_CHAT_HISTORY);

      // Batch-fetch roles for all unique senders in one query
      const uniquePlayerIds = [...new Set(rows.map((r) => r.playerId))];
      const rolesMap = await roleRepo.getPlayerRolesBatch(uniquePlayerIds);

      const history: ChatMessage[] = rows.map((row) => ({
        messageId: row.id,
        playerId: row.playerId,
        displayName: row.displayName,
        avatarColor: row.avatarColor,
        message: row.message,
        censored: row.censored,
        timestamp: row.createdAt.getTime(),
        roles: rolesMap.get(row.playerId) ?? [],
      }));
      socket.emit("chat:history", history);
    } catch (err) {
      console.error("[GameRoom] sendChatHistory error", err);
    }
  }

  private nextSeat(): number {
    const taken = new Set(this.machine.state.players.map((p) => p.seatIndex));
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!taken.has(i)) return i;
    }
    return this.playerCount;
  }

  private hasModerationPrivilege(playerId: string): boolean {
    const roles = this.playerRolesCache.get(playerId) ?? [];
    return roles.some((r) => MODERATOR_ROLE_NAMES.has(r.name));
  }

  /** Returns a lightweight snapshot used by the public room browser. */
  getListing(): RoomListing {
    const s = this.machine.state;
    // Only count/show players who are actually present (not mid-game departures).
    const activePlayers = s.players.filter((p) => p.status !== "disconnected");
    return {
      code: this.code,
      playerCount: activePlayers.length,
      maxPlayers: MAX_PLAYERS,
      phase: s.phase,
      settings: {
        minBet: s.settings.minBet,
        maxBet: s.settings.maxBet,
        bettingTimerSeconds: s.settings.bettingTimerSeconds,
        turnTimerSeconds: s.settings.turnTimerSeconds,
        allowCountingHint: s.settings.allowCountingHint,
        bankruptcyProtection: s.settings.bankruptcyProtection,
        isPrivate: s.settings.isPrivate,
      },
      players: activePlayers.map((p) => ({
        displayName: p.displayName,
        avatarColor: p.avatarColor,
      })),
    };
  }

  private broadcast(event: string, data: unknown): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.io.to(this.code) as any).emit(event, data);
  }

  destroy(): void {
    this.machine.destroy();
  }
}
