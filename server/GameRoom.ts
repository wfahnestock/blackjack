import type { Server, Socket } from "socket.io";
import type {
  Player,
  GameSettings,
  ClientToServerEvents,
  ServerToClientEvents,
  RoundResult,
} from "../app/lib/types.js";
import { DEFAULT_SETTINGS, MAX_PLAYERS } from "../app/lib/constants.js";
import { GameStateMachine } from "./GameStateMachine.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

export class GameRoom {
  readonly code: string;
  private machine: GameStateMachine;
  private socketToPlayer = new Map<string, string>(); // socketId → playerId
  private playerToSocket = new Map<string, string>(); // playerId → socketId

  constructor(
    code: string,
    private io: AppServer,
    settings: Partial<GameSettings>,
    flushRound?: (players: Player[], results: RoundResult[]) => Promise<void>
  ) {
    this.code = code;
    const merged: GameSettings = { ...DEFAULT_SETTINGS, ...settings };
    this.machine = new GameStateMachine(
      code,
      merged,
      (event, data) => this.broadcast(event, data)
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
    return this.playerCount === 0;
  }

  get state() {
    return this.machine.state;
  }

  addPlayer(
    socket: AppSocket,
    playerId: string,
    displayName: string,
    avatarColor: string,
    initialChips: number
  ): { success: boolean; error?: string } {
    if (this.playerCount >= MAX_PLAYERS) {
      return { success: false, error: "Room is full" };
    }

    const existing = this.machine.getPlayer(playerId);
    if (existing) {
      // Reconnect
      this.socketToPlayer.set(socket.id, playerId);
      this.playerToSocket.set(playerId, socket.id);
      socket.join(this.code);
      this.machine.updatePlayer(playerId, { status: "connected", displayName });
      this.broadcast("state:player-updated", this.machine.getPlayer(playerId)!);
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
    socket.join(this.code);

    this.broadcast("state:sync", this.machine.state);
    return { success: true };
  }

  removePlayer(socketId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return;

    this.socketToPlayer.delete(socketId);
    this.playerToSocket.delete(playerId);

    const player = this.machine.getPlayer(playerId);
    if (player) {
      // If game is in lobby, remove entirely; otherwise mark disconnected
      if (this.machine.state.phase === "lobby" || this.machine.state.phase === "cleanup") {
        this.machine.removePlayer(playerId);
        // Reassign host if needed
        if (player.isHost && this.playerCount > 0) {
          const nextHost = this.machine.state.players[0];
          this.machine.updatePlayer(nextHost.playerId, { isHost: true });
        }
      } else {
        this.machine.updatePlayer(playerId, { status: "disconnected" });
        this.broadcast("state:player-updated", this.machine.getPlayer(playerId)!);
        return;
      }
    }

    this.broadcast("state:sync", this.machine.state);
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

  private nextSeat(): number {
    const taken = new Set(this.machine.state.players.map((p) => p.seatIndex));
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!taken.has(i)) return i;
    }
    return this.playerCount;
  }

  private broadcast(event: string, data: unknown): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.io.to(this.code) as any).emit(event, data);
  }

  destroy(): void {
    this.machine.destroy();
  }
}
