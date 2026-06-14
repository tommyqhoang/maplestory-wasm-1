import { create } from "zustand";
import type {
  WorldInfo,
  CharInfo,
  StatsDetail,
  InventorySlot,
  EquipSlot,
  SkillEntry,
} from "../bridge/protocol";

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
  statsDetail: StatsDetail | null;
  inventory: InventorySlot[];
  equipment: EquipSlot[];
  skills: SkillEntry[];
  openWindows: Record<string, boolean>;
  setScene: (name: string) => void;
  setStats: (s: Stats) => void;
  setPong: (nonce: number) => void;
  setCharacter: (c: { name: string; job: string }) => void;
  addChatLine: (l: ChatLine) => void;
  setLoginResult: (r: { ok: boolean; reason: string }) => void;
  setWorlds: (worlds: WorldInfo[]) => void;
  setCharacters: (characters: CharInfo[]) => void;
  setAsset: (key: string, dataUrl: string) => void;
  setStatsDetail: (detail: StatsDetail | null) => void;
  setInventory: (inventory: InventorySlot[]) => void;
  setEquipment: (equipment: EquipSlot[]) => void;
  setSkills: (skills: SkillEntry[]) => void;
  toggleWindow: (name: string) => void;
  closeWindow: (name: string) => void;
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
  statsDetail: null,
  inventory: [],
  equipment: [],
  skills: [],
  openWindows: {},
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
  setStatsDetail: (statsDetail) => set({ statsDetail }),
  setInventory: (inventory) => set({ inventory }),
  setEquipment: (equipment) => set({ equipment }),
  setSkills: (skills) => set({ skills }),
  toggleWindow: (name) =>
    set((state) => ({
      openWindows: { ...state.openWindows, [name]: !state.openWindows[name] },
    })),
  closeWindow: (name) =>
    set((state) => ({
      openWindows: { ...state.openWindows, [name]: false },
    })),
}));
