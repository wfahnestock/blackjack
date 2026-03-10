// ─── Primitives ───────────────────────────────────────────────────────────────

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "J" | "Q" | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
  faceDown: boolean;
}

// ─── Hand ─────────────────────────────────────────────────────────────────────

export type HandResult = "win" | "lose" | "push" | "blackjack" | "bust" | null;

export interface Hand {
  handId: string;
  cards: Card[];
  bet: number;
  doubled: boolean;
  stood: boolean;
  busted: boolean;
  result: HandResult;
  insuranceBet: number;
  splitFromHandId: string | null;
}

// ─── Player ───────────────────────────────────────────────────────────────────

export type PlayerStatus =
  | "connected"
  | "disconnected"
  | "betting"
  | "acting"
  | "waiting"
  | "sitting-out";

export interface Player {
  playerId: string;
  displayName: string;
  seatIndex: number;
  chips: number;
  hands: Hand[];
  status: PlayerStatus;
  isHost: boolean;
  avatarColor: string;
}

// ─── Game Settings ─────────────────────────────────────────────────────────────

export interface GameSettings {
  startingChips: number;
  dailyChips: number;
  bettingTimerSeconds: number;
  turnTimerSeconds: number;
  allowCountingHint: boolean;
  minBet: number;
  maxBet: number;
}

// ─── Game Phase ───────────────────────────────────────────────────────────────

export type GamePhase =
  | "lobby"
  | "betting"
  | "dealing"
  | "player-turn"
  | "dealer-turn"
  | "payout"
  | "cleanup";

// ─── Shoe State ───────────────────────────────────────────────────────────────

export interface ShoeState {
  totalCards: number;
  cardsRemaining: number;
  penetration: number;
  shufflePending: boolean;
}

// ─── Full Game State ──────────────────────────────────────────────────────────

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  dealerHand: Hand;
  shoe: ShoeState;
  activePlayerId: string | null;
  activeHandId: string | null;
  phaseEndsAt: number | null;
  roundNumber: number;
  settings: GameSettings;
  hiLoCount: number | null;
}

// ─── Round Results ─────────────────────────────────────────────────────────────

export interface RoundResult {
  playerId: string;
  handId: string;
  result: HandResult;
  payout: number;
}

// ─── Callback Response Types ──────────────────────────────────────────────────

export interface RoomCreateResponse {
  success: boolean;
  roomCode?: string;
  error?: string;
}

export interface RoomJoinResponse {
  success: boolean;
  state?: GameState;
  error?: string;
}

// ─── Socket Events: Client → Server ──────────────────────────────────────────

export interface ClientToServerEvents {
  "room:create": (
    payload: {
      displayName: string;
      playerId: string;
      avatarColor: string;
      settings?: Partial<GameSettings>;
    },
    callback: (response: RoomCreateResponse) => void
  ) => void;

  "room:join": (
    payload: {
      roomCode: string;
      displayName: string;
      playerId: string;
      avatarColor: string;
    },
    callback: (response: RoomJoinResponse) => void
  ) => void;

  "room:leave": () => void;

  "room:start": () => void;

  "room:update-settings": (settings: Partial<GameSettings>) => void;

  "game:place-bet": (payload: { amount: number }) => void;

  "game:hit": (payload: { handId: string }) => void;
  "game:stand": (payload: { handId: string }) => void;
  "game:double": (payload: { handId: string }) => void;
  "game:split": (payload: { handId: string }) => void;
  "game:insurance": (payload: { take: boolean }) => void;
}

// ─── Socket Events: Server → Client ──────────────────────────────────────────

export interface ServerToClientEvents {
  "state:sync": (state: GameState) => void;

  "state:player-updated": (player: Player) => void;
  "state:hand-updated": (payload: { playerId: string; hand: Hand }) => void;
  "state:dealer-updated": (dealerHand: Hand) => void;
  "state:shoe-updated": (shoe: ShoeState) => void;
  "state:phase-changed": (payload: {
    phase: GamePhase;
    phaseEndsAt: number | null;
    activePlayerId: string | null;
    activeHandId: string | null;
  }) => void;

  "game:card-dealt": (payload: {
    target: "dealer" | "player";
    playerId?: string;
    handId?: string;
    card: Card;
    delay: number;
  }) => void;

  "game:round-result": (results: RoundResult[]) => void;

  "game:shuffle": () => void;

  "error": (payload: { code: string; message: string }) => void;
  "notification": (payload: { type: "info" | "warning"; message: string }) => void;
}
