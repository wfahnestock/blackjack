import { pgTable, uuid, varchar, integer, date, timestamp, boolean } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 50 }).notNull(),
  avatarColor: varchar("avatar_color", { length: 20 }).notNull().default("#10B981"),
  chips: integer("chips").notNull().default(2500),
  lastDailyClaimed: date("last_daily_claimed"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const playerStats = pgTable("player_stats", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  handsPlayed: integer("hands_played").notNull().default(0),
  handsWon: integer("hands_won").notNull().default(0),
  handsLost: integer("hands_lost").notNull().default(0),
  handsPushed: integer("hands_pushed").notNull().default(0),
  blackjacks: integer("blackjacks").notNull().default(0),
  totalWagered: integer("total_wagered").notNull().default(0),
  netWinnings: integer("net_winnings").notNull().default(0),
  biggestWin: integer("biggest_win").notNull().default(0),
  biggestBet: integer("biggest_bet").notNull().default(0),
  splitsMade: integer("splits_made").notNull().default(0),
  doublesMade: integer("doubles_made").notNull().default(0),
  timesBusted: integer("times_busted").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id:          uuid("id").primaryKey().defaultRandom(),
  roomCode:    varchar("room_code",    { length: 6   }).notNull(),
  playerId:    uuid("player_id").notNull(),
  displayName: varchar("display_name", { length: 50  }).notNull(),
  avatarColor: varchar("avatar_color", { length: 20  }).notNull(),
  message:     varchar("message",      { length: 200 }).notNull(),
  /** Reserved for a future censor/profanity pass. Always false for now. */
  censored:    boolean("censored").notNull().default(false),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type PlayerStats = typeof playerStats.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
