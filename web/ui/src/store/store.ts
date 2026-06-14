import { create } from "zustand";

export interface Stats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  exp: number;
}

export interface ChatLine {
  line: string;
  ctype: number;
}

interface GameState {
  scene: string;
  stats: Stats;
  lastPong: number | null;
  character: { name: string; job: string };
  chat: ChatLine[];
  setScene: (name: string) => void;
  setStats: (s: Stats) => void;
  setPong: (nonce: number) => void;
  setCharacter: (c: { name: string; job: string }) => void;
  addChatLine: (l: ChatLine) => void;
}

export const useGame = create<GameState>((set) => ({
  scene: "loading",
  stats: { hp: 0, maxHp: 0, mp: 0, maxMp: 0, level: 0, exp: 0 },
  lastPong: null,
  character: { name: "", job: "" },
  chat: [],
  setScene: (name) => set({ scene: name }),
  setStats: (stats) => set({ stats }),
  setPong: (nonce) => set({ lastPong: nonce }),
  setCharacter: (character) => set({ character }),
  addChatLine: (l) =>
    set((state) => ({
      chat: [...state.chat, l].slice(-200),
    })),
}));
