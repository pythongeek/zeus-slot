import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  numeric,
  json,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ── Enum types ──────────────────────────────────────────────────────────────

const roleEnum = pgEnum("role", ["user", "admin"]);
const currencyEnum4 = pgEnum("currency", ["BTC", "ETH", "USDT", "BDT"]);
const currencyEnum3 = pgEnum("currency", ["BTC", "ETH", "USDT"]);
const statusEnum = pgEnum("status", ["active", "completed", "expired"]);
const featureTriggeredEnum = pgEnum("feature_triggered", ["none", "free_spins", "thunder_strike"]);
const txTypeEnum = pgEnum("type", ["deposit", "withdrawal"]);
const txStatusEnum = pgEnum("status", ["pending", "confirming", "confirmed", "failed", "cancelled"]);
const jackpotTierEnum = pgEnum("tier", ["mini", "major", "mega"]);

// ── Tables ─────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("union_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: roleEnum("role").default("user").notNull(),
  walletAddress: varchar("wallet_address", { length: 42 }).unique(),
  username: varchar("username", { length: 32 }).unique(),
  nonce: varchar("nonce", { length: 32 }).notNull().default(""),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("last_sign_in_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const balances = pgTable("balances", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  currency: currencyEnum4("currency").notNull(),
  available: numeric("available", { precision: 24, scale: 8 }).default("0").notNull(),
  locked: numeric("locked", { precision: 24, scale: 8 }).default("0").notNull(),
  totalDeposited: numeric("total_deposited", { precision: 24, scale: 8 }).default("0").notNull(),
  totalWithdrawn: numeric("total_withdrawn", { precision: 24, scale: 8 }).default("0").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uk_user_currency").on(table.userId, table.currency),
]);

export type Balance = typeof balances.$inferSelect;

export const gameSessions = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  serverSeed: varchar("server_seed", { length: 64 }).notNull(),
  serverSeedHash: varchar("server_seed_hash", { length: 64 }).notNull(),
  clientSeed: varchar("client_seed", { length: 64 }).notNull(),
  nonce: bigint("nonce", { mode: "number", unsigned: true }).default(0).notNull(),
  status: statusEnum("status").default("active").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  totalSpins: bigint("total_spins", { mode: "number", unsigned: true }).default(0).notNull(),
  totalWagered: numeric("total_wagered", { precision: 24, scale: 8 }).default("0").notNull(),
  totalWon: numeric("total_won", { precision: 24, scale: 8 }).default("0").notNull(),
}, (table) => [
  index("idx_user_active").on(table.userId, table.status),
  index("idx_seed_hash").on(table.serverSeedHash),
]);

export type GameSession = typeof gameSessions.$inferSelect;

export const spins = pgTable("spins", {
  id: serial("id").primaryKey(),
  sessionId: bigint("session_id", { mode: "number", unsigned: true }).notNull(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  nonce: bigint("nonce", { mode: "number", unsigned: true }).notNull(),
  betAmount: numeric("bet_amount", { precision: 24, scale: 8 }).notNull(),
  currency: currencyEnum4("currency").notNull(),
  reelPositions: json("reel_positions").notNull(),
  symbolsShown: json("symbols_shown").notNull(),
  winAmount: numeric("win_amount", { precision: 24, scale: 8 }).default("0").notNull(),
  winLines: json("win_lines"),
  isBigWin: boolean("is_big_win").default(false).notNull(),
  isJackpot: boolean("is_jackpot").default(false).notNull(),
  featureTriggered: featureTriggeredEnum("feature_triggered").default("none").notNull(),
  freeSpinsAwarded: bigint("free_spins_awarded", { mode: "number", unsigned: true }).default(0).notNull(),
  hash: varchar("hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uk_session_nonce").on(table.sessionId, table.nonce),
  index("idx_user_spins").on(table.userId, table.createdAt),
  index("idx_big_wins").on(table.isBigWin, table.createdAt),
]);

export type Spin = typeof spins.$inferSelect;

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  type: txTypeEnum("type").notNull(),
  currency: currencyEnum3("currency").notNull(),
  amount: numeric("amount", { precision: 24, scale: 8 }).notNull(),
  fee: numeric("fee", { precision: 24, scale: 8 }).default("0").notNull(),
  status: txStatusEnum("status").default("pending").notNull(),
  txHash: varchar("tx_hash", { length: 66 }),
  fromAddress: varchar("from_address", { length: 42 }),
  toAddress: varchar("to_address", { length: 42 }).notNull(),
  confirmations: bigint("confirmations", { mode: "number", unsigned: true }).default(0).notNull(),
  requiredConfirmations: bigint("required_confirmations", { mode: "number", unsigned: true }).default(3).notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_user_tx").on(table.userId, table.type, table.status),
  index("idx_tx_hash").on(table.txHash),
]);

export type Transaction = typeof transactions.$inferSelect;

export const jackpotPool = pgTable("jackpot_pool", {
  id: serial("id").primaryKey(),
  tier: jackpotTierEnum("tier").notNull().unique(),
  seedAmount: numeric("seed_amount", { precision: 24, scale: 8 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 24, scale: 8 }).notNull(),
  contributionRate: numeric("contribution_rate", { precision: 6, scale: 6 }).notNull(),
  lastWonAt: timestamp("last_won_at"),
  lastWonBy: bigint("last_won_by", { mode: "number", unsigned: true }),
  hitCount: bigint("hit_count", { mode: "number", unsigned: true }).default(0).notNull(),
});

export type JackpotPool = typeof jackpotPool.$inferSelect;

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }),
  action: varchar("action", { length: 50 }).notNull(),
  details: json("details").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_user_action").on(table.userId, table.action),
  index("idx_created").on(table.createdAt),
]);
