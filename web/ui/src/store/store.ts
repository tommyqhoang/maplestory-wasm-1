import { create } from "zustand";
import type {
  WorldInfo,
  CharInfo,
  StatsDetail,
  InventorySlot,
  EquipSlot,
  SkillEntry,
  NpcDialogPayload,
  ShopPayload,
  BuffEntry,
} from "../bridge/protocol";

export interface Notice {
  id: number;
  text: string;
  ntype: string;
}

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
  npcDialog: NpcDialogPayload | null;
  shop: ShopPayload | null;
  buffs: BuffEntry[];
  notices: Notice[];
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
  setNpcDialog: (dialog: NpcDialogPayload | null) => void;
  setShop: (shop: ShopPayload | null) => void;
  setBuffs: (buffs: BuffEntry[]) => void;
  pushNotice: (text: string, ntype: string) => void;
  dismissNotice: (id: number) => void;
  toggleWindow: (name: string) => void;
  closeWindow: (name: string) => void;
}

// Monotonic id source for toast notices. Module-level so ids stay unique
// across the lifetime of the page even as the list is capped/dismissed.
let nextNoticeId = 1;

// Most recent toasts kept in the store; older ones are dropped past this cap.
const MAX_NOTICES = 5;

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
  npcDialog: null,
  shop: null,
  buffs: [],
  notices: [],
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
  setNpcDialog: (npcDialog) => set({ npcDialog }),
  setShop: (shop) => set({ shop }),
  setBuffs: (buffs) => set({ buffs }),
  pushNotice: (text, ntype) =>
    set((state) => ({
      notices: [...state.notices, { id: nextNoticeId++, text, ntype }].slice(
        -MAX_NOTICES,
      ),
    })),
  dismissNotice: (id) =>
    set((state) => ({
      notices: state.notices.filter((n) => n.id !== id),
    })),
  toggleWindow: (name) =>
    set((state) => ({
      openWindows: { ...state.openWindows, [name]: !state.openWindows[name] },
    })),
  closeWindow: (name) =>
    set((state) => ({
      openWindows: { ...state.openWindows, [name]: false },
    })),
}));
