import { pgTable, uuid, varchar, integer, date, timestamp, boolean, primaryKey, jsonb } from "drizzle-orm/pg-core";


export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 50 }).notNull(),
  avatarColor: varchar("avatar_color", { length: 20 }).notNull().default("#10B981"),
  equippedNameEffect: varchar("equipped_name_effect", { length: 30 }),
  equippedCardSkin:   varchar("equipped_card_skin",   { length: 30 }),
  equippedTableBg:    varchar("equipped_table_bg",    { length: 30 }),
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
  achievementProgress: jsonb("achievement_progress").notNull().default({}),
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

/**
 * Role definitions. Seeded via `npm run db:seed` and managed through
 * future moderation tooling. New roles can be added without code deploys
 * by inserting a row here and re-running the seed (or via admin API).
 */
export const roles = pgTable("roles", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      varchar("name",  { length: 50 }).notNull().unique(),
  label:     varchar("label", { length: 50 }).notNull(),
  /** Tailwind color key used by the client badge (e.g. "sky", "amber", "violet"). */
  color:     varchar("color", { length: 30 }).notNull(),
  /** Full FontAwesome solid icon class (e.g. "fa-gavel", "fa-wrench"). */
  icon:      varchar("icon",  { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Join table assigning roles to players.
 * A player with no rows here is an ordinary (unprivileged) player.
 */
export const playerRoles = pgTable("player_roles", {
  playerId:   uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  roleId:     uuid("role_id").notNull().references(() => roles.id,   { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.playerId, t.roleId] }),
}));

/**
 * Tracks which name-effect vanity items a player has purchased.
 * The effect catalog is defined in app/lib/nameEffects.ts — no DB table needed
 * for the catalog itself.
 */
export const playerAchievements = pgTable("player_achievements", {
  playerId:      uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  achievementId: varchar("achievement_id", { length: 50 }).notNull(),
  unlockedAt:    timestamp("unlocked_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.playerId, t.achievementId] }),
}));

export const playerOwnedEffects = pgTable("player_owned_effects", {
  playerId:   uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  effectKey:  varchar("effect_key", { length: 30 }).notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.playerId, t.effectKey] }),
}));

/**
 * Tracks which skin vanity items (card skins, table backgrounds) a player has purchased.
 * skinType is 'card' or 'table-bg'. The skin catalog is defined in app/lib/cardSkins.ts
 * and app/lib/tableBgs.ts — no DB table needed for the catalogs themselves.
 */
export const playerOwnedSkins = pgTable("player_owned_skins", {
  playerId:   uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  skinType:   varchar("skin_type", { length: 20 }).notNull(), // 'card' | 'table-bg'
  skinKey:    varchar("skin_key",  { length: 30 }).notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.playerId, t.skinType, t.skinKey] }),
}));

export type Player                  = typeof players.$inferSelect;
export type NewPlayer               = typeof players.$inferInsert;
export type PlayerStats             = typeof playerStats.$inferSelect;
export type ChatMessageRow          = typeof chatMessages.$inferSelect;
export type Role                    = typeof roles.$inferSelect;
export type PlayerRoleRow           = typeof playerRoles.$inferSelect;
export type PlayerOwnedEffectRow    = typeof playerOwnedEffects.$inferSelect;
export type PlayerOwnedSkinRow      = typeof playerOwnedSkins.$inferSelect;
export type PlayerAchievementRow    = typeof playerAchievements.$inferSelect;
