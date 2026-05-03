/**
 * Standalone Mode — Mock tRPC Provider
 *
 * Intercepts all tRPC hooks used in Game.tsx and replaces them
 * with local implementations using the client-side game engine.
 *
 * This allows the full game UI to run without any backend.
 */

import { create } from "zustand";
import { doSpin, getPaytable, PAYLINES } from "./gameEngine";

// ─── Types ───────────────────────────────────────────────────────────────

interface StandaloneBalance {
  currency: string;
  available: number;
  locked: number;
  bdtEquivalent: number;
}

interface StandaloneJackpot {
  tier: string;
  amount: number;
  bdtEquivalent: number;
}

interface StandaloneSession {
  sessionId: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

// ─── Store ────────────────────────────────────────────────────────────────

interface StandaloneStore {
  session: StandaloneSession | null;
  balances: StandaloneBalance[];
  jackpots: StandaloneJackpot[];
  setSession: (s: StandaloneSession | null) => void;
  setBalances: (b: StandaloneBalance[]) => void;
  setJackpots: (j: StandaloneJackpot[]) => void;
  updateBalance: (currency: string, delta: number) => void;
}

export const useStandaloneStore = create<StandaloneStore>((set) => ({
  session: null,
  balances: [
    { currency: "BTC", available: 0.5234, locked: 0, bdtEquivalent: 5757400 },
    { currency: "ETH", available: 2.15, locked: 0, bdtEquivalent: 1182500 },
    { currency: "USDT", available: 1500, locked: 0, bdtEquivalent: 165000 },
    { currency: "BDT", available: 50000, locked: 0, bdtEquivalent: 50000 },
  ],
  jackpots: [
    { tier: "mega", amount: 10.45, bdtEquivalent: 114950000 },
    { tier: "major", amount: 0.523, bdtEquivalent: 5753000 },
    { tier: "mini", amount: 0.052, bdtEquivalent: 572000 },
  ],
  setSession: (session) => set({ session }),
  setBalances: (balances) => set({ balances }),
  setJackpots: (jackpots) => set({ jackpots }),
  updateBalance: (currency, delta) =>
    set((state) => ({
      balances: state.balances.map((b) =>
        b.currency === currency
          ? { ...b, available: b.available + delta }
          : b
      ),
    })),
}));

// ─── Mock Hooks ─────────────────────────────────────────────────────────

export function useMockStartSession() {
  return {
    mutateAsync: async (input: { clientSeed?: string }) => {
      const store = useStandaloneStore.getState();
      const crypto = await import("crypto");

      const serverSeed = crypto.randomBytes(32).toString("hex");
      const serverSeedHash = crypto
        .createHash("sha256")
        .update(serverSeed)
        .digest("hex");
      const clientSeed = input.clientSeed || crypto.randomBytes(16).toString("hex");

      const session: StandaloneSession = {
        sessionId: Date.now(),
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce: 0,
      };

      store.setSession(session);

      return {
        sessionId: session.sessionId,
        serverSeedHash,
        clientSeed,
        startingNonce: 0,
      };
    },
  };
}

export function useMockSpin() {
  return {
    mutateAsync: async (input: {
      sessionId: number;
      betAmount: string;
      currency: string;
    }) => {
      const store = useStandaloneStore.getState();
      const session = store.session;
      if (!session) throw new Error("No active session");

      const betAmount = parseFloat(input.betAmount);
      const balance = store.balances.find((b) => b.currency === input.currency);
      if (!balance || balance.available < betAmount) {
        throw new Error("Insufficient balance");
      }

      const newNonce = session.nonce + 1;

      // Use game engine
      const result = doSpin(
        session.serverSeed,
        session.clientSeed,
        newNonce,
        betAmount
      );

      // Update balance
      store.updateBalance(input.currency, result.winAmount - betAmount);

      // Update session nonce
      store.setSession({ ...session, nonce: newNonce });

      return {
        spinId: Date.now(),
        nonce: newNonce,
        reelPositions: result.reelPositions,
        symbols: result.symbols,
        winAmount: String(result.winAmount),
        winLines: result.winLines,
        isBigWin: result.isBigWin,
        isJackpot: result.isJackpot,
        featureTriggered: result.featureTriggered,
        freeSpinsAwarded: result.freeSpinsAwarded,
        hash: result.hash,
        newBalance: String(
          (balance.available + (result.winAmount - betAmount))
        ),
        jackpotTier: result.jackpotTier,
      };
    },
  };
}

export function useMockBalanceGet() {
  return {
    mutateAsync: async () => {
      return useStandaloneStore.getState().balances;
    },
  };
}

export function useMockJackpotPools() {
  return {
    mutateAsync: async () => {
      return useStandaloneStore.getState().jackpots;
    },
  };
}

export function useMockPaytable() {
  return {
    mutateAsync: async () => {
      return getPaytable();
    },
  };
}
