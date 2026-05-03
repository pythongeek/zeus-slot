/**
 * Zeus Thunder — Client-Side Game Engine
 * Mirrors the server-side game logic from api/routers/game.ts
 * Used when running in standalone mode (no backend).
 */

import crypto from "crypto";

// ─── Symbol Definitions ────────────────────────────────────────────────────

export const SYMBOLS = {
  ZEUS: 0,
  SCATTER: 1,
  PEGASUS: 2,
  TEMPLE: 3,
  HARP: 4,
  AMPHORA: 5,
  HELMET: 6,
  SHIELD: 7,
  ACE: 8,
  KING: 9,
  QUEEN: 10,
} as const;

export const SYMBOL_NAMES: Record<number, string> = {
  0: "zeus",
  1: "thunderbolt",
  2: "pegasus",
  3: "temple",
  4: "harp",
  5: "amphora",
  6: "helmet",
  7: "shield",
  8: "ace",
  9: "king",
  10: "queen",
};

// ─── Payout Table ─────────────────────────────────────────────────────────

type PayoutKey = 3 | 4 | 5;

const PAYOUTS: Record<number, { 3: number; 4: number; 5: number }> = {
  [SYMBOLS.ZEUS]: { 3: 50, 4: 200, 5: 1000 },
  [SYMBOLS.SCATTER]: { 3: 2, 4: 5, 5: 20 },
  [SYMBOLS.PEGASUS]: { 3: 30, 4: 100, 5: 500 },
  [SYMBOLS.TEMPLE]: { 3: 25, 4: 80, 5: 400 },
  [SYMBOLS.HARP]: { 3: 20, 4: 60, 5: 300 },
  [SYMBOLS.AMPHORA]: { 3: 15, 4: 40, 5: 200 },
  [SYMBOLS.HELMET]: { 3: 10, 4: 30, 5: 150 },
  [SYMBOLS.SHIELD]: { 3: 8, 4: 25, 5: 100 },
  [SYMBOLS.ACE]: { 3: 5, 4: 15, 5: 60 },
  [SYMBOLS.KING]: { 3: 5, 4: 15, 5: 60 },
  [SYMBOLS.QUEEN]: { 3: 4, 4: 10, 5: 50 },
};

// ─── Reel Strips ─────────────────────────────────────────────────────────

export const REEL_STRIPS = [
  [0,0,1,1, 2,2,2,3,3,3, 4,4,4,5,5,5,5, 6,6,6,6,7,7,7,7, 8,8,8,8,8,9,9,9,9,9, 10,10,10,10,10],
  [0,0,1,1, 2,2,2,3,3,3, 4,4,4,5,5,5,5, 6,6,6,6,7,7,7,7, 8,8,8,8,8,9,9,9,9,9, 10,10,10,10,10],
  [0,0,0,1,1, 2,2,2,3,3,3, 4,4,4,5,5,5,5, 6,6,6,6,7,7,7,7, 8,8,8,8,8,9,9,9,9,9, 10,10,10,10,10],
  [0,0,1,1, 2,2,2,3,3,3, 4,4,4,5,5,5,5, 6,6,6,6,7,7,7,7, 8,8,8,8,8,9,9,9,9,9, 10,10,10,10,10],
  [0,0,1,1, 2,2,2,3,3,3, 4,4,4,5,5,5,5, 6,6,6,6,7,7,7,7, 8,8,8,8,8,9,9,9,9,9, 10,10,10,10,10],
];

// ─── Paylines ────────────────────────────────────────────────────────────

export const PAYLINES: number[][] = [
  [1,1,1,1,1], // Middle row
  [0,0,0,0,0], // Top row
  [2,2,2,2,2], // Bottom row
  [0,1,2,1,0], // V shape
  [2,1,0,1,2], // Inverted V
  [0,0,1,0,0],
  [2,2,1,2,2],
  [1,0,0,0,1],
  [1,2,2,2,1],
  [0,1,1,1,0],
  [2,1,1,1,2],
  [1,0,1,0,1],
  [1,2,1,2,1],
  [0,1,0,1,0],
  [2,1,2,1,2],
  [0,2,0,2,0],
  [2,0,2,0,2],
  [1,1,0,1,1],
  [1,1,2,1,1],
  [0,0,2,0,0],
];

// ─── Spin Calculation ─────────────────────────────────────────────────────

export interface SpinResult {
  reelStops: number[];
  symbols: number[][];
  hash: string;
}

export function calculateSpin(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): SpinResult {
  const hash = crypto
    .createHash("sha256")
    .update(serverSeed + clientSeed + String(nonce))
    .digest("hex");

  const reelStops: number[] = [];
  for (let i = 0; i < 5; i++) {
    const bytePair = hash.substring(i * 4, i * 4 + 4);
    const value = parseInt(bytePair, 16);
    reelStops.push(value % REEL_STRIPS[i].length);
  }

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

// ─── Payline Evaluation ──────────────────────────────────────────────────

export interface WinLine {
  lineIndex: number;
  symbol: number;
  count: number;
  payout: number;
  positions: Array<[number, number]>;
}

export interface EvaluationResult {
  lines: WinLine[];
  totalPayout: number;
  scatterCount: number;
  freeSpinsAwarded: number;
}

export function evaluatePaylines(
  symbols: number[][],
  betPerLine: number
): EvaluationResult {
  const lines: WinLine[] = [];
  let totalPayout = 0;

  for (let li = 0; li < PAYLINES.length; li++) {
    const line = PAYLINES[li];
    const firstSymbol = symbols[0][line[0]];

    let matchSymbol = firstSymbol === SYMBOLS.ZEUS ? -1 : firstSymbol;
    let matchCount = 1;
    const positions: Array<[number, number]> = [[0, line[0]]];

    for (let reel = 1; reel < 5; reel++) {
      const sym = symbols[reel][line[reel]];
      if (sym === SYMBOLS.ZEUS || sym === matchSymbol || matchSymbol === -1) {
        if (matchSymbol === -1 && sym !== SYMBOLS.ZEUS) {
          matchSymbol = sym;
        }
        matchCount++;
        positions.push([reel, line[reel]]);
      } else {
        break;
      }
    }

    if (matchSymbol === -1) matchSymbol = SYMBOLS.ZEUS;

    if (matchCount >= 3 && PAYOUTS[matchSymbol]) {
      const payout = PAYOUTS[matchSymbol][matchCount as PayoutKey] * betPerLine;
      if (payout > 0) {
        lines.push({ lineIndex: li, symbol: matchSymbol, count: matchCount, payout, positions });
        totalPayout += payout;
      }
    }
  }

  // Count scatters
  let scatterCount = 0;
  for (let reel = 0; reel < 5; reel++) {
    for (let row = 0; row < 3; row++) {
      if (symbols[reel][row] === SYMBOLS.SCATTER) {
        scatterCount++;
      }
    }
  }

  let freeSpinsAwarded = 0;
  if (scatterCount >= 3) {
    const scatterPayout = PAYOUTS[SYMBOLS.SCATTER][Math.min(scatterCount, 5) as PayoutKey] * betPerLine * PAYLINES.length;
    totalPayout += scatterPayout;
    freeSpinsAwarded = scatterCount === 3 ? 10 : scatterCount === 4 ? 15 : 25;
  }

  return { lines, totalPayout, scatterCount, freeSpinsAwarded };
}

// ─── Thunder Strike (1% random wild transform) ────────────────────────────

export function applyThunderStrike(symbols: number[][]): { symbols: number[][]; wildPositions: Array<[number, number]> } {
  const newSymbols = symbols.map(col => [...col]);
  const wildPositions: Array<[number, number]> = [];
  const numTransforms = Math.floor(Math.random() * 3) + 1;

  for (let i = 0; i < numTransforms; i++) {
    const r = Math.floor(Math.random() * 5);
    const row = Math.floor(Math.random() * 3);
    newSymbols[r][row] = SYMBOLS.ZEUS;
    wildPositions.push([r, row]);
  }

  return { symbols: newSymbols, wildPositions };
}

// ─── Jackpot Check ────────────────────────────────────────────────────────

export interface JackpotResult {
  tier: string;
  amount: number;
}

export function checkJackpot(): JackpotResult | null {
  const rand = Math.random();
  if (rand < 0.00001) return { tier: "mega", amount: 10000 };
  if (rand < 0.0001) return { tier: "major", amount: 500 };
  if (rand < 0.001) return { tier: "mini", amount: 50 };
  return null;
}

// ─── Full Spin ────────────────────────────────────────────────────────────

export interface FullSpinResult {
  reelPositions: number[];
  symbols: string[][];
  winAmount: number;
  winLines: WinLine[];
  isBigWin: boolean;
  isJackpot: boolean;
  featureTriggered: "none" | "free_spins" | "thunder_strike";
  freeSpinsAwarded: number;
  hash: string;
  jackpotTier: string | null;
}

export function doSpin(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  betAmount: number
): FullSpinResult {
  const betPerLine = betAmount / PAYLINES.length;
  const { reelStops, symbols, hash } = calculateSpin(serverSeed, clientSeed, nonce);

  let { lines, totalPayout, scatterCount, freeSpinsAwarded } = evaluatePaylines(symbols, betPerLine);

  let winAmount = totalPayout;
  let isBigWin = false;
  let isJackpot = false;
  let featureTriggered: "none" | "free_spins" | "thunder_strike" = "none";
  let jackpotTier: string | null = null;

  if (winAmount >= betAmount * 50) {
    isBigWin = true;
  }

  if (scatterCount >= 3) {
    featureTriggered = "free_spins";
  }

  // Thunder strike on losing spins (1% chance)
  if (winAmount === 0 && Math.random() < 0.01) {
    featureTriggered = "thunder_strike";
    const { symbols: struckSymbols } = applyThunderStrike(symbols);
    const reeval = evaluatePaylines(struckSymbols, betPerLine);
    winAmount = Math.max(reeval.totalPayout, betAmount * 10);
    lines = reeval.lines;
  }

  // Jackpot check
  const jackpot = checkJackpot();
  if (jackpot) {
    isJackpot = true;
    jackpotTier = jackpot.tier;
    winAmount += betAmount * jackpot.amount;
  }

  return {
    reelPositions: reelStops,
    symbols: symbols.map(col => col.map(s => SYMBOL_NAMES[s])),
    winAmount,
    winLines: lines,
    isBigWin,
    isJackpot,
    featureTriggered,
    freeSpinsAwarded,
    hash,
    jackpotTier,
  };
}

// ─── Paytable ─────────────────────────────────────────────────────────────

export function getPaytable() {
  return {
    symbols: Object.entries(SYMBOL_NAMES).map(([id, name]) => ({
      id: parseInt(id),
      name,
      payouts: PAYOUTS[parseInt(id)] || null,
      isWild: parseInt(id) === SYMBOLS.ZEUS,
      isScatter: parseInt(id) === SYMBOLS.SCATTER,
    })),
    paylines: PAYLINES.length,
    rtp: 96.5,
    volatility: "HIGH",
  };
}
