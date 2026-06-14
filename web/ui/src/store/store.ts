import { create } from "zustand";

export interface Stats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  exp: number;
}

interface GameState {
  scene: string;
  stats: Stats;
  lastPong: number | null;
  setScene: (name: string) => void;
  setStats: (s: Stats) => void;
  setPong: (nonce: number) => void;
}

export const useGame = create<GameState>((set) => ({
  scene: "loading",
  stats: { hp: 0, maxHp: 0, mp: 0, maxMp: 0, level: 0, exp: 0 },
  lastPong: null,
  setScene: (name) => set({ scene: name }),
  setStats: (stats) => set({ stats }),
  setPong: (nonce) => set({ lastPong: nonce }),
}));
