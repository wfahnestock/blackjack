// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * A role definition as returned by the server.
 * Roles are stored in the `roles` table and managed via admin tooling.
 * A player with an empty `roles` array is an ordinary (unprivileged) player.
 */
export interface RoleInfo {
  id: string;
  name: string;
  /** Human-readable display label, e.g. "Moderator" */
  label: string;
  /** Tailwind color key used by the client badge, e.g. "sky", "amber", "violet" */
  color: string;
  /** FontAwesome solid icon class, e.g. "fa-gavel", "fa-wrench" */
  icon: string;
}

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

export type HandResult = "win" | "lose" | "push" | "blackjack" | "bust" | "five-card-charlie" | null;

export interface ActionRecord {
  action: "hit" | "stand" | "double" | "split";
  /** Best hand value before this action was taken. */
  handValueBefore: number;
  isSoftBefore: boolean;
  /** True if hand was a splittable pair before this action. */
  isPairBefore: boolean;
  /** The first card rank of the pair (only meaningful when isPairBefore is true). */
  pairRank: Rank | null;
  dealerUpcard: Rank;
  /** Number of cards in hand before this action. */
  cardCountBefore: number;
}

export interface Hand {
  handId: string;
  cards: Card[];
  bet: number;
  doubled: boolean;
  stood: boolean;
  busted: boolean;
  fiveCardCharlie: boolean;
  result: HandResult;
  insuranceBet: number;
  splitFromHandId: string | null;
  /** Every player decision made on this hand, in order. */
  actionHistory: ActionRecord[];
}

// ─── Achievements ─────────────────────────────────────────────────────────────

export type AchievementCategory =
  | "skill"
  | "streak"
  | "gambler"
  | "rare"
  | "comeback"
  | "meta"
  | "funny";

export interface AchievementInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  unlockedAt: number | null; // epoch ms, null = locked
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
  /** Equipped vanity name-effect key, or null for default white text. */
  nameEffect: string | null;
  /** Equipped card skin key, or null for the classic white/blue default. Visible to all players at the table. */
  cardSkin: string | null;
}

// ─── Game Settings ─────────────────────────────────────────────────────────────

export interface GameSettings {
  startingChips: number;
  dailyChips: number;
  bettingTimerSeconds: number;
  turnTimerSeconds: number;
  allowCountingHint: boolean;
  bankruptcyProtection: boolean;
  fiveCardCharlie: boolean;
  minBet: number;
  maxBet: number;
  /** When true, this room is hidden from public room discovery. */
  isPrivate: boolean;
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
  /**
   * Card skin key applied to the dealer's deck.  Always `null` under normal play.
   * Reserved for a future event system (e.g. "Gold Dealer" double-payout event).
   */
  dealerCardSkin: string | null;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  messageId: string;
  playerId: string;
  displayName: string;
  avatarColor: string;
  message: string;
  /** True when a moderator has removed this message. */
  /** TODO: this isn't the correct field for this, but works for now */
  censored: boolean;
  timestamp: number; // epoch ms
  /** Roles held by the sender at the time the message was sent. */
  roles: RoleInfo[];
  /** Vanity name-effect key of the sender at send time. */
  nameEffect?: string | null;
  /** If true, rendered as a centered system notice (not a chat bubble). */
  isSystem?: boolean;
}

// ─── Round Results ─────────────────────────────────────────────────────────────

export interface RoundResult {
  playerId: string;
  handId: string;
  result: HandResult;
  payout: number;
}

// ─── Room Discovery ───────────────────────────────────────────────────────────

/** Snapshot of a room as shown in the public room browser. */
export interface RoomListing {
  code: string;
  playerCount: number;
  maxPlayers: number;
  phase: GamePhase;
  settings: Pick<
    GameSettings,
    | "minBet"
    | "maxBet"
    | "bettingTimerSeconds"
    | "turnTimerSeconds"
    | "allowCountingHint"
    | "bankruptcyProtection"
    | "isPrivate"
  >;
  /** Connected (non-disconnected) players, for avatar display. */
  players: Array<{ displayName: string; avatarColor: string }>;
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
    payload: { settings?: Partial<GameSettings> },
    callback: (response: RoomCreateResponse) => void
  ) => void;

  "room:join": (
    payload: { roomCode: string },
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

  "chat:send": (payload: { message: string }) => void;

  "chat:remove_message": (payload: { messageId: string }) => void;
  "chat:clear": () => void;

  /** Request the current public room list (initial fetch). Server replies via callback. */
  "rooms:subscribe": (callback: (rooms: RoomListing[]) => void) => void;
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

  "game:bankruptcy-relief": (payload: { playerId: string }) => void;

  "error": (payload: { code: string; message: string }) => void;
  "notification": (payload: { type: "info" | "warning"; message: string }) => void;

  "chat:message": (message: ChatMessage) => void;
  "chat:history": (messages: ChatMessage[]) => void;
  "chat:error": (payload: { message: string }) => void;

  "chat:message_removed": (payload: { messageId: string }) => void;
  "chat:cleared": (payload: { clearedBy: string }) => void;

  "achievement:unlocked": (payload: { playerId: string; achievement: AchievementInfo }) => void;

  /** Server pushes an updated public room list whenever a room's discoverable state changes. */
  "rooms:updated": (rooms: RoomListing[]) => void;
}
