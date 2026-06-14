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
  ChatChannel,
} from "../bridge/protocol";
import { CHAT_CHANNELS } from "../bridge/protocol";

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
  // Exp required to reach the next level (0 at level cap).
  expNext: number;
}

export interface ChatLine {
  line: string;
  ctype: number;
  channel: ChatChannel;
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
  chatChannel: ChatChannel;
  meso: number;
  systemMenuOpen: boolean;
  bgmVolume: number;
  sfxVolume: number;
  bgmMuted: boolean;
  sfxMuted: boolean;
  supersample: number;
  showFps: boolean;
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
  setChatChannel: (channel: ChatChannel) => void;
  cycleChatChannel: (dir: number) => void;
  setMeso: (meso: number) => void;
  setSystemMenuOpen: (open: boolean) => void;
  setBgmVolume: (value: number) => void;
  setSfxVolume: (value: number) => void;
  setBgmMuted: (muted: boolean) => void;
  setSfxMuted: (muted: boolean) => void;
  setSupersample: (value: number) => void;
  setShowFps: (show: boolean) => void;
}

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

function saveSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — keep the in-memory value only */
  }
}

// Volume preferences persist across sessions. Read defensively so a missing or
// corrupt localStorage value falls back to a sensible default.
function loadVolume(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v = Number(raw);
    return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : fallback;
  } catch {
    return fallback;
  }
}

function saveVolume(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable — keep the in-memory value only */
  }
}

// Read an integer setting constrained to [min, max]. A missing, non-numeric, or
// out-of-range value (e.g. a manually edited localStorage entry) falls back to
// the default so the UI never renders an unselectable option.
function loadClampedInt(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v = Number(raw);
    return Number.isInteger(v) && v >= min && v <= max ? v : fallback;
  } catch {
    return fallback;
  }
}

// Monotonic id source for toast notices. Module-level so ids stay unique
// across the lifetime of the page even as the list is capped/dismissed.
let nextNoticeId = 1;

// Most recent toasts kept in the store; older ones are dropped past this cap.
const MAX_NOTICES = 5;

export const useGame = create<GameState>((set) => ({
  scene: "loading",
  stats: { hp: 0, maxHp: 0, mp: 0, maxMp: 0, level: 0, exp: 0, expNext: 0 },
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
  chatChannel: "all",
  meso: 0,
  systemMenuOpen: false,
  bgmVolume: loadVolume("maple.bgmVolume", 50),
  sfxVolume: loadVolume("maple.sfxVolume", 50),
  bgmMuted: loadBool("maple.bgmMuted", false),
  sfxMuted: loadBool("maple.sfxMuted", false),
  supersample: loadClampedInt("maple.supersample", 4, 1, 4),
  showFps: loadBool("maple.showFps", false),
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
  setChatChannel: (chatChannel) => set({ chatChannel }),
  cycleChatChannel: (dir) =>
    set((state) => {
      const i = CHAT_CHANNELS.indexOf(state.chatChannel);
      const next = (i + dir + CHAT_CHANNELS.length) % CHAT_CHANNELS.length;
      return { chatChannel: CHAT_CHANNELS[next] };
    }),
  setMeso: (meso) => set({ meso }),
  setSystemMenuOpen: (systemMenuOpen) => set({ systemMenuOpen }),
  setBgmVolume: (value) => {
    saveVolume("maple.bgmVolume", value);
    set({ bgmVolume: value });
  },
  setSfxVolume: (value) => {
    saveVolume("maple.sfxVolume", value);
    set({ sfxVolume: value });
  },
  setBgmMuted: (muted) => {
    saveSetting("maple.bgmMuted", String(muted));
    set({ bgmMuted: muted });
  },
  setSfxMuted: (muted) => {
    saveSetting("maple.sfxMuted", String(muted));
    set({ sfxMuted: muted });
  },
  setSupersample: (value) => {
    saveSetting("maple.supersample", String(value));
    set({ supersample: value });
  },
  setShowFps: (show) => {
    saveSetting("maple.showFps", String(show));
    set({ showFps: show });
  },
}));
