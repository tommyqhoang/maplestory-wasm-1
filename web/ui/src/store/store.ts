import { create } from "zustand";
import type { WorldInfo, CharInfo } from "../bridge/protocol";

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
  loginResult: { ok: boolean; reason: string } | null;
  worlds: WorldInfo[];
  characters: CharInfo[];
  assets: Record<string, string>;
  setScene: (name: string) => void;
  setStats: (s: Stats) => void;
  setPong: (nonce: number) => void;
  setCharacter: (c: { name: string; job: string }) => void;
  addChatLine: (l: ChatLine) => void;
  setLoginResult: (r: { ok: boolean; reason: string }) => void;
  setWorlds: (worlds: WorldInfo[]) => void;
  setCharacters: (characters: CharInfo[]) => void;
  setAsset: (key: string, dataUrl: string) => void;
}

export const useGame = create<GameState>((set) => ({
  scene: "loading",
  stats: { hp: 0, maxHp: 0, mp: 0, maxMp: 0, level: 0, exp: 0 },
  lastPong: null,
  character: { name: "", job: "" },
  chat: [],
  loginResult: null,
  worlds: [],
  characters: [],
  assets: {},
  setScene: (name) => set({ scene: name }),
  setStats: (stats) => set({ stats }),
  setPong: (nonce) => set({ lastPong: nonce }),
  setCharacter: (character) => set({ character }),
  addChatLine: (l) =>
    set((state) => ({
      chat: [...state.chat, l].slice(-200),
    })),
  setLoginResult: (loginResult) => set({ loginResult }),
  setWorlds: (worlds) => set({ worlds }),
  setCharacters: (characters) => set({ characters }),
  setAsset: (key, dataUrl) =>
    set((state) => ({ assets: { ...state.assets, [key]: dataUrl } })),
}));
