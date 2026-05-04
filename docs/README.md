# Zeus Thunder — Provably Fair Slot Game

**Version:** 1.0.0 | **Stack:** React 19 + Vite 7 (Frontend) · Hono + tRPC + MySQL (Backend)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Frontend (Cloudflare Pages)](#3-frontend-cloudflare-pages)
4. [Backend (Hono + tRPC)](#4-backend-hono--trpc)
5. [Game Logic](#5-game-logic)
6. [Provably Fair System](#6-provably-fair-system)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Deployment Guide](#9-deployment-guide)
10. [Environment Variables](#10-environment-variables)
11. [Security Considerations](#11-security-considerations)

---

## 1. Project Overview

**Zeus Thunder** is a browser-based provably fair slot machine game built with Greek mythology theming. Players spin 5-reel, 3-row slot machines across 20 paylines, supporting multiple cryptocurrencies (BTC, ETH, USDT) and fiat (BDT).

### Key Features

- **Provably Fair** — Server seed hash revealed before spin, verifiable after
- **Multi-currency** — BTC, ETH, USDT, BDT with live conversion rates
- **Jackpot System** — 3 tiers (Mini, Major, Mega) with progressive pools
- **Bonus Features** — Free spins (Scatter), Thunder Strike (1% random wild transform)
- **Auto-spin** — Configurable auto-spin with loss/win limits
- **Turbo Mode** — Fast reel stops for rapid play
- **Real-time Balance** — Atomic balance updates per spin
- **Full Audit Log** — Every bet, win, deposit, withdrawal recorded

### Project Location

```
/mnt/f/zeus/
```

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (Client)                         │
│   React 19 + Vite 7 + Pixi.js 7 + GSAP + Howler.js          │
│   tRPC Client (React Query)                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (REST/tRPC over fetch)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            CLOUDFLARE EDGE (Static Hosting)                 │
│         Frontend built to /dist/public                      │
│         vite.config.ts → outDir: dist/public                │
│                                                             │
│   Serves: index.html, JS/CSS bundles, /assets/*            │
└──────────────────────────┬──────────────────────────────────┘
                           │ Proxy /api/* to Backend origin
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND — VPS (Node.js / Hono)                 │
│                    Port 3000                                 │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Hono HTTP Server                                   │  │
│   │    └─> tRPC Router (/api/trpc/*)                    │  │
│   │          ├─ auth.*   (me, logout)                   │  │
│   │          ├─ game.*   (startSession, spin, ...)     │  │
│   │          ├─ balance.* (get, deposit, withdraw)      │  │
│   │          ├─ jackpot.* (getPools, getHistory)       │  │
│   │          └─ fairness.* (verify, changeSeed)         │  │
│   └──────────────────────┬──────────────────────────────┘  │
│                          │                                  │
│   ┌──────────────────────▼──────────────────────────────┐  │
│   │  MySQL (Drizzle ORM)                                │  │
│   │    users, balances, game_sessions, spins,            │  │
│   │    transactions, jackpot_pool, audit_log             │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   OAuth: Kimi Platform (KIMI_AUTH_URL)                     │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow (Spin Example)

```
Browser                  Cloudflare            Backend VPS
   │                         │                     │
   │ POST /api/trpc/game.spin│                     │
   │ ───────────────────────►│ Proxy to backend ──►│
   │                         │                     │ 1. Validate session
   │                         │                     │ 2. Check balance
   │                         │                     │ 3. calculateSpin()
   │                         │                     │ 4. evaluatePaylines()
   │                         │                     │ 5. Check jackpot
   │                         │                     │ 6. Atomic balance update
   │                         │                     │ 7. Record spin to DB
   │ ◄───────────────────────│ ◄───────────────────│
   │ { reelPositions,        │                     │
   │   symbols, winAmount,    │                     │
   │   newBalance, ... }     │                     │
```

### Development vs Production

| Mode | Frontend | Backend | Command |
|------|----------|---------|---------|
| Dev | Vite HMR (port 3000) | Vite dev-server injects API (port 3000) | `npm run dev` |
| Prod (local) | Served by Hono on :3000/dist/public | Hono server on :3000 | `npm run build && npm start` |
| Prod (deploy) | Cloudflare Pages | VPS (port 3000) | wrangler pages deploy |

---

## 3. Frontend (Cloudflare Pages)

### Build Output

```
vite.config.ts → outDir: dist/public
```

Cloudflare Pages serves the built React app as static files. The `/api/*` routes are **proxied** to the backend VPS origin.

### Key Frontend Files

```
src/
├── App.tsx                  # React Router routes: /, /login, *
├── main.tsx                 # React DOM entry point
├── pages/
│   ├── Game.tsx             # Main slot game UI (900 lines)
│   ├── Home.tsx             # Landing/home page
│   ├── Login.tsx            # OAuth login page
│   └── NotFound.tsx
├── stores/
│   └── gameStore.ts         # Zustand state (balances, session, bets, UI)
├── hooks/
│   ├── useAuth.ts           # Auth state hook
│   └── use-mobile.ts        # Mobile detection
├── providers/
│   └── trpc.tsx             # tRPC + React Query provider
└── components/ui/           # shadcn/ui components (40+)
```

### State Management (Zustand)

`gameStore.ts` manages all client-side state:

```typescript
interface GameStore {
  // Session
  session: GameSession | null;        // Provably fair session
  setSession: (s) => void;

  // Balance
  balances: Balance[];                // Per-currency balances
  activeCurrency: Currency;           // BTC | ETH | USDT | BDT

  // Betting
  betAmount: number;                  // Current bet per spin
  minBet: 0.1; maxBet: 1000;

  // Game State
  gameState: "idle" | "spinning" | "winning" | "bonus" | "freespins";

  // Auto-spin
  isAutoSpinning: boolean;
  autoSpinCount: number;
  turboMode: boolean;

  // UI dialogs
  showPaytable: boolean;
  showFairness: boolean;
  showWallet: boolean;
  showSettings: boolean;

  // Jackpots
  jackpots: { tier, amount, bdtEquivalent }[];
}
```

### tRPC Client Setup

```typescript
// src/providers/trpc.tsx
// Wraps App with tRPC + React Query provider
// Endpoint: /api/trpc (proxied through Cloudflare to backend)
```

### Frontend Build Commands

```bash
cd /mnt/f/zeus

npm run dev          # Dev with HMR (frontend + API on :3000)
npm run build        # Vite build → dist/public/
npm run preview      # Preview built output
npm run lint
npm run format
```

### Cloudflare Pages Deployment

```bash
# Build
npm run build

# Deploy with Wrangler
npx wrangler pages deploy dist/public \
  --project-name=zeus-thunder \
  --branch=main

# Or via GitHub integration (recommended)
# Connect repo → Cloudflare Pages → auto-deploy on push
```

**Required Cloudflare Pages Config:**

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist/public` |
| Environment variables | `VITE_API_URL` → backend VPS URL |

---

## 4. Backend (Hono + tRPC)

### Entry Point

```typescript
// api/boot.ts
const app = new Hono();
app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 })); // 50MB

// OAuth callback
app.get("/api/oauth/callback", createOAuthCallbackHandler());

// tRPC handler (all API routes)
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
```

In **production**, static files from `dist/public` are served, making a single `npm start` command serve both frontend and backend.

### tRPC Router Structure

```typescript
// api/router.ts
export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,       // me, logout
  game: gameRouter,        // startSession, spin, endSession, getPaytable, ...
  balance: balanceRouter,  // get, deposit, withdraw, getHistory
  fairness: fairnessRouter, // verify, changeSeed, getSession
  jackpot: jackpotRouter,   // getPools, getHistory
});
```

### Auth Middleware

```typescript
// api/middleware.ts
const requireAuth = t.middleware(async (opts) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const authedQuery = t.procedure.use(requireAuth);
```

### Context (Per-Request)

```typescript
// api/context.ts
export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;  // Populated by authenticateRequest() from session cookie
};

export async function createContext(opts) {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch { /* auth optional */ }
  return ctx;
}
```

### Backend API Directory

```
api/
├── boot.ts               # Hono app entry + static file serving
├── context.ts            # tRPC context (auth from cookie)
├── router.ts             # Root tRPC router
├── auth-router.ts        # /auth/me, /auth/logout
├── middleware.ts         # tRPC middleware (requireAuth, adminQuery)
├── queries/
│   ├── connection.ts     # Drizzle MySQL connection singleton
│   └── users.ts          # User CRUD
├── lib/
│   ├── cookies.ts         # Cookie serialization options
│   ├── env.ts            # Environment variables
│   ├── http.ts           # HTTP utility
│   └── vite.ts           # Vite static middleware
├── kimi/
│   ├── auth.ts           # OAuth code exchange, JWT verification
│   ├── platform.ts       # Kimi platform API client
│   ├── session.ts        # Session token sign/verify (jose)
│   └── types.ts          # TypeScript types for Kimi API
└── routers/
    ├── game.ts           # Slot game logic (475 lines)
    ├── balance.ts        # Wallet operations
    ├── fairness.ts       # Provably fair verification
    └── jackpot.ts        # Progressive jackpot pools
```

---

## 5. Game Logic

### Slot Machine Specifications

| Parameter | Value |
|-----------|-------|
| Reels | 5 |
| Rows | 3 |
| Paylines | 20 (fixed) |
| RTP | 96.5% |
| Volatility | HIGH |
| Min Bet | 0.1 |
| Max Bet | 1000 |
| Max Win | 1000x bet |

### Symbol Definitions

```typescript
const SYMBOLS = {
  ZEUS:      0,   // Wild — substitutes all except Scatter
  SCATTER:   1,   // Thunderbolt — triggers Free Spins
  PEGASUS:   2,
  TEMPLE:    3,
  HARP:      4,
  AMPHORA:   5,
  HELMET:    6,
  SHIELD:    7,
  ACE:       8,
  KING:      9,
  QUEEN:     10,
};
```

### Payout Table (multiplier per bet-per-line)

| Symbol | 3 Match | 4 Match | 5 Match |
|--------|---------|---------|---------|
| Zeus (Wild) | 50x | 200x | 1000x |
| Scatter | 2x + FS | 5x + FS | 20x + FS |
| Pegasus | 30x | 100x | 500x |
| Temple | 25x | 80x | 400x |
| Harp | 20x | 60x | 300x |
| Amphora | 15x | 40x | 200x |
| Helmet | 10x | 30x | 150x |
| Shield | 8x | 25x | 100x |
| Ace | 5x | 15x | 60x |
| King | 5x | 15x | 60x |
| Queen | 4x | 10x | 50x |

### Reel Strips

5 reels, each with 40 weighted positions. Lower-value symbols (Ace, King, Queen) appear more frequently than high-value ones (Zeus, Scatter).

```typescript
const REEL_STRIPS = [
  [0,0,1,1, 2,2,2,3,3,3, 4,4,4,5,5,5,5, 6,6,6,6,7,7,7,7, 8,8,8,8,8,9,9,9,9,9, 10,10,10,10,10],
  // ... (5 reels total)
];
```

### Paylines (20 total)

Lines 0-2 are the standard horizontal lines. Remaining lines create V-shapes, W-shapes, zigzags, and other patterns.

```typescript
const PAYLINES = [
  [1,1,1,1,1], // Middle row
  [0,0,0,0,0], // Top row
  [2,2,2,2,2], // Bottom row
  [0,1,2,1,0], // V shape
  [2,1,0,1,2], // Inverted V
  // ... 15 more patterns
];
```

### Bonus Features

**1. Free Spins (Scatter)**
- 3+ Thunderbolts anywhere on reels
- Awards: 3 Scatter = 10 FS, 4 = 15 FS, 5 = 25 FS
- Scatter also pays 2x-20x bet (multiplied by all 20 lines)

**2. Thunder Strike (Random)**
- 1% chance on any losing spin
- Transforms 1-3 random symbols into Wilds (Zeus)
- Guarantees minimum 10x bet win
- Visual: lightning flash overlay

### Spin Algorithm (Provably Fair)

```typescript
function calculateSpin(serverSeed, clientSeed, nonce) {
  const hash = crypto
    .createHash("sha256")
    .update(serverSeed + clientSeed + String(nonce))
    .digest("hex");

  // Use first 20 hex chars (5 reels × 4 chars each)
  const reelStops: number[] = [];
  for (let i = 0; i < 5; i++) {
    const bytePair = hash.substring(i * 4, i * 4 + 4);
    const value = parseInt(bytePair, 16);
    reelStops.push(value % REEL_STRIPS[i].length);
  }

  // Map stops to visible 3-row symbols
  const symbols: number[][] = [];
  for (let reel = 0; reel < 5; reel++) {
    const reelSymbols: number[] = [];
    for (let row = 0; row < 3; row++) {
      const pos = (reelStops[reel] + row) % REEL_STRIPS[reel].length;
      reelSymbols.push(REEL_STRIPS[reel][pos]);
    }
    symbols.push(reelSymbols);
  }

  return { reelStops, symbols, hash };
}
```

### Jackpot System

| Tier | Seed | Contribution Rate | Approx USD (demo) |
|------|------|-------------------|-------------------|
| Mini | 0.01 BTC | 0.1% per bet | ~$50 |
| Major | 0.1 BTC | 0.05% per bet | ~$500 |
| Mega | 1.0 BTC | 0.01% per bet | ~$10,000 |

Jackpot roll chance per spin: Mega 0.001%, Major 0.01%, Mini 0.1%.

---

## 6. Provably Fair System

### How It Works

1. **Before Spin**: Server generates a random `serverSeed` (64 hex chars). The **hash** of this seed (`SHA-256`) is sent to the client. The seed itself is hidden until the session ends.

2. **Spin**: Client seed + server seed + nonce are combined and hashed to determine reel positions. Both client and server contribute to randomness.

3. **After Spin**: The server reveals the `serverSeed`. The client can verify: `SHA256(serverSeed + clientSeed + nonce)` produces the same hash and reel positions recorded in the DB.

### Session Flow

```
┌─────────────┐                      ┌─────────────┐
│   Client    │                      │   Server    │
└──────┬──────┘                      └──────┬──────┘
       │                                    │
       │──── startSession() ───────────────►│
       │     clientSeed: "abc123..."        │
       │◄─── { sessionId, serverSeedHash,   │  (serverSeed hidden)
       │      clientSeed, startingNonce: 0 }│
       │                                    │
       │==== SPIN #1 (nonce=1) ====        │
       │     hash = SHA256(srv + cli + 1)  │  (server computes same hash)
       │◄─── { reelPositions, symbols,      │
       │      winAmount, newBalance, ... }  │
       │                                    │
       │==== SPIN #2 (nonce=2) ====        │
       │◄─── { ... }                       │
       │                                    │
       │──── endSession() ────────────────►│
       │◄─── { serverSeed: "abc..." }      │  (serverSeed revealed)
       │                                    │
       │  NOW CLIENT CAN VERIFY:            │
       │  SHA256("abc..." + "abc123..." + 1)│
       │  = hash from spin #1 ?             │
```

### Frontend Verification UI

The `Game.tsx` includes a "Fairness" dialog where users can:
- See current `serverSeedHash`
- Input their own `clientSeed` before session starts
- Verify any past spin by recalculating the hash

### Backend Verification Endpoint

```typescript
// api/routers/fairness.ts
fairnessRouter.verify({
  input: { sessionId, nonce },
  // Returns: hash, reelPositions, symbols, calculationSteps
  // Compares stored vs recomputed to confirm match
});
```

---

## 7. Database Schema

**Engine:** MySQL 8+ | **ORM:** Drizzle | **Connection:** `mysql2`

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| unionId | VARCHAR(255) | Unique — Kimi platform ID |
| name | VARCHAR(255) | Display name |
| email | VARCHAR(320) | |
| avatar | TEXT | URL |
| role | ENUM('user','admin') | Default: 'user' |
| walletAddress | VARCHAR(42) | Unique, nullable |
| username | VARCHAR(32) | Unique |
| nonce | VARCHAR(32) | For wallet auth |
| isActive | BOOLEAN | Default: true |
| createdAt | TIMESTAMP | Auto |
| lastSignInAt | TIMESTAMP | |

#### `balances`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| userId | BIGINT | FK → users.id |
| currency | ENUM('BTC','ETH','USDT','BDT') | |
| available | DECIMAL(24,8) | Withdrawable balance |
| locked | DECIMAL(24,8) | Pending (withdrawals) |
| totalDeposited | DECIMAL(24,8) | |
| totalWithdrawn | DECIMAL(24,8) | |

**Unique index:** `(userId, currency)`

#### `game_sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| userId | BIGINT | FK |
| serverSeed | VARCHAR(64) | Hidden until session ends |
| serverSeedHash | VARCHAR(64) | Shown to client before spin |
| clientSeed | VARCHAR(64) | Client-provided |
| nonce | BIGINT | Spin counter |
| status | ENUM('active','completed','expired') | |
| totalSpins | BIGINT | |
| totalWagered | DECIMAL(24,8) | |
| totalWon | DECIMAL(24,8) | |

**Indexes:** `(userId, status)`, `(serverSeedHash)`

#### `spins`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| sessionId | BIGINT | FK |
| userId | BIGINT | FK |
| nonce | BIGINT | |
| betAmount | DECIMAL(24,8) | |
| currency | ENUM | |
| reelPositions | JSON | [38, 12, 7, 22, 5] |
| symbolsShown | JSON | 5×3 array |
| winAmount | DECIMAL(24,8) | |
| winLines | JSON | Array of line results |
| isBigWin | BOOLEAN | ≥50x bet |
| isJackpot | BOOLEAN | |
| featureTriggered | ENUM('none','free_spins','thunder_strike') | |
| freeSpinsAwarded | BIGINT | |
| hash | VARCHAR(64) | SHA256 result |

**Unique index:** `(sessionId, nonce)`  
**Indexes:** `(userId, createdAt)`, `(isBigWin, createdAt)`

#### `transactions`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| userId | BIGINT | FK |
| type | ENUM('deposit','withdrawal') | |
| currency | ENUM('BTC','ETH','USDT') | |
| amount | DECIMAL(24,8) | |
| fee | DECIMAL(24,8) | |
| status | ENUM('pending','confirming','confirmed','failed','cancelled') | |
| txHash | VARCHAR(66) | On-chain hash |
| toAddress | VARCHAR(42) | |
| confirmations | BIGINT | |

#### `jackpot_pool`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| tier | ENUM('mini','major','mega') | Unique |
| seedAmount | DECIMAL(24,8) | Initial seed |
| currentAmount | DECIMAL(24,8) | Current pool |
| contributionRate | DECIMAL(6,6) | % of each bet |
| lastWonAt | TIMESTAMP | |
| lastWonBy | BIGINT | FK → users.id |
| hitCount | BIGINT | |

#### `audit_log`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| userId | BIGINT | Nullable |
| action | VARCHAR(50) | |
| details | JSON | |
| ipAddress | VARCHAR(45) | |
| userAgent | VARCHAR(500) | |

### DB Commands

```bash
cd /mnt/f/zeus

npm run db:generate   # drizzle-kit generate → migrations/
npm run db:push       # drizzle-kit push (dev — direct schema sync)
npm run db:migrate    # drizzle-kit migrate (production)
```

---

## 8. API Reference

All endpoints are tRPC procedures served at `/api/trpc/<router>.<procedure>`.

### Public (no auth required)

```typescript
// Ping
game.ping() → { ok: boolean; ts: number }

// Get paytable
game.getPaytable() → {
  symbols: Array<{ id, name, payouts, isWild, isScatter }>;
  paylines: 20;
  rtp: 96.5;
  volatility: "HIGH";
}

// Get jackpot pools
jackpot.getPools() → Array<{
  tier, amount, bdtEquivalent, seedAmount, contributionRate, hitCount
}>

// Get recent jackpot wins
jackpot.getHistory() → Array<{ id, username, winAmount, currency, bdtEquivalent, createdAt }>
```

### Authenticated (session cookie required)

```typescript
// --- Game ---
game.startSession({ clientSeed?: string }) → {
  sessionId: number;
  serverSeedHash: string;
  clientSeed: string;
  startingNonce: number;
}

game.spin({
  sessionId: number;
  betAmount: string;      // e.g. "1.0"
  currency: "BTC"|"ETH"|"USDT"|"BDT";
}) → {
  spinId: number;
  nonce: number;
  reelPositions: number[];
  symbols: string[][];    // 5 columns × 3 rows of symbol names
  winAmount: string;
  winLines: Array<{ lineIndex, symbol, count, payout, positions }>;
  isBigWin: boolean;
  isJackpot: boolean;
  featureTriggered: "none"|"free_spins"|"thunder_strike";
  freeSpinsAwarded: number;
  hash: string;
  newBalance: string;
  jackpotTier: string | null;
}

game.endSession({ sessionId: number }) → {
  serverSeed: string;     // Revealed after session ends
  totalSpins: number;
  totalWagered: string;
  totalWon: string;
}

game.getRecentSpins({ limit?: number }) → Spin[]

game.getSessionSpins({ sessionId: number }) → { session, spins }

game.getPaytable() → Paytable

// --- Balance ---
balance.get() → Array<{
  currency, available, locked, bdtEquivalent
}>

balance.deposit({
  currency: "BTC"|"ETH"|"USDT";
  amount: string;
}) → {
  txId: number;
  depositAddress: string; // Generated mock address
  amount: string;
  status: "pending";
  minConfirmations: number;
}

balance.confirmDeposit({ txId: number }) → { success, amount, currency }

balance.withdraw({
  currency: "BTC"|"ETH"|"USDT";
  amount: string;
  toAddress: string;
}) → { txId, amount, fee, status }

balance.getHistory({ limit?, offset?, type? }) → Transaction[]

// --- Fairness ---
fairness.verify({ sessionId, nonce }) → {
  verified: boolean;
  serverSeed, clientSeed, nonce, hash;
  hashMatch, positionsMatch, symbolsMatch;
  calculationSteps: string[];
}

fairness.getSession({ sessionId }) → { session, spins }

fairness.changeSeed({ sessionId, newClientSeed }) → { success, newClientSeed }

// --- Auth ---
auth.me() → User

auth.logout() → { success: true }
```

### Error Codes

| tRPC Code | Meaning |
|-----------|---------|
| `UNAUTHORIZED` | No valid session cookie |
| `FORBIDDEN` | Insufficient role (admin only) |
| `NOT_FOUND` | Session/spin not found |
| `BAD_REQUEST` | Invalid input (bet ≤ 0, insufficient balance) |
| `INTERNAL_SERVER_ERROR` | DB failure, unexpected error |

---

## 9. Deployment Guide

### Overview

```
┌────────────────────┐     ┌─────────────────────────────────┐
│   Cloudflare Edge  │     │        VPS (Backend)             │
│                    │     │                                 │
│  Frontend (static) │────►│  Hono API (:3000)               │
│  zeus.domain.com   │     │  MySQL (:3306)                  │
│                    │     │  Node.js 20                     │
└────────────────────┘     └─────────────────────────────────┘
         │                            ▲
         │                            │
         └──── CORS / Proxy ──────────┘
```

### Step 1 — Prepare Backend VPS

```bash
# On VPS (e.g. Hetzner cx33)
# 1. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 2. Install MySQL
apt-get install -y mysql-server
mysql_secure_installation

# 3. Create database
mysql -u root -p
CREATE DATABASE zeus_slot;
CREATE USER 'zeus'@'%' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON zeus_slot.* TO 'zeus'@'%';
FLUSH PRIVILEGES;

# 4. Clone / copy project
git clone <your-repo> /opt/zeus-slot
cd /opt/zeus-slot

# 5. Install dependencies
npm install

# 6. Create .env
cp .env.example .env
# Edit .env with your values

# 7. Push database schema
npm run db:push

# 8. Start in background
nohup npm start > /var/log/zeus.log 2>&1 &

# 9. Verify
curl http://localhost:3000/api/trpc/ping
```

### Step 2 — Configure Backend .env

```bash
# /opt/zeus-slot/.env

NODE_ENV=production
PORT=3000

# App ID (Kimi OAuth App)
APP_ID=your_kimi_app_id
APP_SECRET=your_kimi_app_secret

# Kimi OAuth URLs (platform endpoints)
KIMI_AUTH_URL=https://your-kimi-platform.com
KIMI_OPEN_URL=https://your-kimi-platform.com

# Database
DATABASE_URL=mysql://zeus:password@localhost:3306/zeus_slot

# Optional: Admin override
OWNER_UNION_ID=your_union_id
```

### Step 3 — Cloudflare Pages (Frontend)

```bash
# Local build
npm run build

# Option A: Wrangler CLI
npx wrangler pages deploy dist/public \
  --project-name=zeus-thunder \
  --branch=production

# Option B: GitHub Integration (recommended)
# 1. Push to GitHub
# 2. Cloudflare Dashboard → Pages → New Project
# 3. Connect GitHub repo
# 4. Configure:
#    - Build command: npm run build
#    - Build output: dist/public
# 5. Add environment variable:
#    VITE_API_URL=https://api.yourdomain.com

# Option C: Upload dist/ folder via Dashboard
```

### Step 4 — Cloudflare Proxy Setup

In Cloudflare Dashboard → Rules → Overview:

**Option A: Subdomain proxy to VPS**
```
# DNS A record
api.zeus.domain.com → <VPS_IP> (Proxied)

# Cloudflare Worker (routes /api/* to backend)
# worker.js or Pages Function:
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})
```

**Option B: Full domain proxy**

Point `zeus.domain.com` to VPS IP (Cloudflare proxies all traffic). On VPS, serve frontend as static files from `dist/public` via Hono's `serveStaticFiles`.

### Step 5 — Production Startup Script

```bash
# /opt/zeus-slot/start.sh
#!/bin/bash
cd /opt/zeus-slot
NODE_ENV=production npm start >> /var/log/zeus.log 2>&1 &
echo "Zeus Slot started on :3000"
```

### Development Mode

```bash
npm run dev   # Single command — Vite HMR + Hono API together
# Frontend: http://localhost:3000
# API: http://localhost:3000/api/trpc
```

---

## 10. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` or `development` |
| `PORT` | No | Server port (default: 3000) |
| `APP_ID` | Yes | Kimi OAuth App ID |
| `APP_SECRET` | Yes | Kimi OAuth App Secret |
| `KIMI_AUTH_URL` | Yes | Kimi auth server base URL |
| `KIMI_OPEN_URL` | Yes | Kimi open platform base URL |
| `DATABASE_URL` | Yes | MySQL DSN: `mysql://user:pass@host:3306/db` |
| `OWNER_UNION_ID` | No | Kimi unionId for admin override |

---

## 11. Security Considerations

### Authentication
- Session tokens signed with **jose** (JWT RS256 via Kimi's JWKS)
- Cookies: `httpOnly`, `sameSite=lax`, `secure` in production
- Session stored server-side in DB (users table)
- Kimi OAuth 2.0 authorization code flow

### Database
- All balance updates are **atomic** (single UPDATE statement)
- Spin records are **immutable** — never updated, only inserted
- Transaction amounts stored as `DECIMAL(24,8)` — no floating point
- Prepared statements via Drizzle ORM (no raw SQL injection)

### Provably Fair
- Server seed is **never revealed** until session ends
- Client can verify every spin independently
- Hash chain: `SHA256(serverSeed + clientSeed + nonce)` is deterministic

### Input Validation
- All tRPC inputs validated with **Zod schemas**
- Bet amounts regex: `/^\d+\.?\d*$/` (string → parsed float)
- Currency must be exact enum match
- Address validation: 26-64 chars for wallet addresses

### Rate Limiting (TODO)
- Add rate limiting middleware to `/api/trpc/game.spin`
- Recommended: 10 spins/second per user

### CORS
- In production, backend should only accept requests from Cloudflare IPs or your domain
- Configure in Hono middleware if needed

### Sensitive Data
- `APP_SECRET` — never expose to frontend
- `serverSeed` — never send to client before session ends
- Private keys (if any wallet signing) — use HSM/vault, never in env plain text
