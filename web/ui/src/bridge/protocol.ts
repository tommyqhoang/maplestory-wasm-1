import { z } from "zod";

export const PROTOCOL_VERSION = 1;

const base = { v: z.literal(PROTOCOL_VERSION) };

export const PongMsg = z.object({
  ...base,
  t: z.literal("pong"),
  nonce: z.number().int(),
});
export const SceneMsg = z.object({
  ...base,
  t: z.literal("scene"),
  name: z.string(),
});
export const StatsMsg = z.object({
  ...base,
  t: z.literal("stats"),
  hp: z.number().int(),
  maxHp: z.number().int(),
  mp: z.number().int(),
  maxMp: z.number().int(),
  level: z.number().int(),
  exp: z.number().int(),
});

export const CharacterMsg = z.object({
  ...base,
  t: z.literal("character"),
  name: z.string(),
  job: z.string(),
});
export const ChatMsg = z.object({
  ...base,
  t: z.literal("chat"),
  line: z.string(),
  ctype: z.number().int(),
});

// Inner data schemas for variable-length list fields
export const WorldInfo = z.object({
  wid: z.number().int(),
  name: z.string(),
  message: z.string(),
  channelcount: z.number().int(),
  flag: z.number().int(),
  channelloads: z.array(z.number().int()),
});
export type WorldInfo = z.infer<typeof WorldInfo>;

export const CharInfo = z.object({
  cid: z.number().int(),
  name: z.string(),
  level: z.number().int(),
  job: z.number().int(),
  str: z.number().int(),
  dex: z.number().int(),
  int: z.number().int(),
  luk: z.number().int(),
});
export type CharInfo = z.infer<typeof CharInfo>;

// Inbound message schemas (engine → TS)
export const LoginResultMsg = z.object({
  ...base,
  t: z.literal("loginResult"),
  ok: z.number().int(),
  reason: z.string(),
});
export const WorldsMsg = z.object({
  ...base,
  t: z.literal("worlds"),
  json: z.string(),
});
export const CharactersMsg = z.object({
  ...base,
  t: z.literal("characters"),
  json: z.string(),
});
export const AssetMsg = z.object({
  ...base,
  t: z.literal("asset"),
  key: z.string(),
  dataUrl: z.string(),
});
export const StatsDetailMsg = z.object({
  ...base,
  t: z.literal("statsdetail"),
  json: z.string(),
});
export const InventoryMsg = z.object({
  ...base,
  t: z.literal("inventory"),
  json: z.string(),
});
export const EquipmentMsg = z.object({
  ...base,
  t: z.literal("equipment"),
  json: z.string(),
});
export const SkillsMsg = z.object({
  ...base,
  t: z.literal("skills"),
  json: z.string(),
});
export const NpcDialogMsg = z.object({
  ...base,
  t: z.literal("npcDialog"),
  json: z.string(),
});
export const ShopMsg = z.object({
  ...base,
  t: z.literal("shop"),
  json: z.string(),
});
export const BuffsMsg = z.object({
  ...base,
  t: z.literal("buffs"),
  json: z.string(),
});
export const NoticeMsg = z.object({
  ...base,
  t: z.literal("notice"),
  json: z.string(),
});

// Parsed payload of StatsDetailMsg.json (engine → TS, detailed Stats window)
export const StatsDetail = z.object({
  name: z.string().optional(),
  job: z.string(),
  level: z.number().int(),
  ap: z.number().int(),
  str: z.number().int(),
  dex: z.number().int(),
  int: z.number().int(),
  luk: z.number().int(),
  hp: z.number().int(),
  maxHp: z.number().int(),
  mp: z.number().int(),
  maxMp: z.number().int(),
  watk: z.number().int(),
  matk: z.number().int(),
  wdef: z.number().int(),
  mdef: z.number().int(),
  accuracy: z.number().int(),
  avoid: z.number().int(),
  speed: z.number().int(),
  jump: z.number().int(),
});
export type StatsDetail = z.infer<typeof StatsDetail>;

// Parsed payload of InventoryMsg.json (engine → TS, DOM Inventory window).
// tab is one of "equip" | "use" | "setup" | "etc" | "cash" (lowercased).
export const InventorySlot = z.object({
  tab: z.string(),
  slot: z.number().int(),
  itemid: z.number().int(),
  count: z.number().int(),
});
export type InventorySlot = z.infer<typeof InventorySlot>;
export const InventoryData = z.array(InventorySlot);
export type InventoryData = z.infer<typeof InventoryData>;

// Parsed payload of EquipmentMsg.json (engine → TS, DOM Equipment window).
export const EquipSlot = z.object({
  slot: z.number().int(),
  itemid: z.number().int(),
});
export type EquipSlot = z.infer<typeof EquipSlot>;
export const EquipmentData = z.array(EquipSlot);
export type EquipmentData = z.infer<typeof EquipmentData>;

// Parsed payload of SkillsMsg.json (engine → TS, DOM Skills window).
export const SkillEntry = z.object({
  skillid: z.number().int(),
  level: z.number().int(),
  masterlevel: z.number().int(),
});
export type SkillEntry = z.infer<typeof SkillEntry>;
export const SkillsData = z.array(SkillEntry);
export type SkillsData = z.infer<typeof SkillsData>;

// Parsed payload of NpcDialogMsg.json (engine → TS, DOM NPC dialogue modal).
// active:false (or a null payload) means "no dialog". mode is one of the
// stable strings emitted by the engine: ok/next/nextprev/yesno/acceptdecline/
// textentry/selection. selections is present for the "selection" mode.
export const NpcDialogSelection = z.object({
  idx: z.number().int(),
  label: z.string(),
});
export type NpcDialogSelection = z.infer<typeof NpcDialogSelection>;
export const NpcDialogPayload = z.object({
  active: z.boolean(),
  npcid: z.number().int().optional().default(0),
  mode: z.string(),
  text: z.string().optional().default(""),
  selections: z.array(NpcDialogSelection).optional(),
});
export type NpcDialogPayload = z.infer<typeof NpcDialogPayload>;

// Parsed payload of ShopMsg.json (engine → TS, DOM NPC shop window).
// active:false means "no shop" (the DOM clears the window). buyable defaults
// to true when omitted by the engine.
export const ShopItem = z.object({
  slot: z.number().int(),
  itemid: z.number().int(),
  price: z.number().int(),
  buyable: z.boolean().optional().default(true),
});
export type ShopItem = z.infer<typeof ShopItem>;
export const ShopPayload = z.object({
  active: z.boolean(),
  npcid: z.number().int().optional().default(0),
  items: z.array(ShopItem),
});
export type ShopPayload = z.infer<typeof ShopPayload>;

// Parsed payload of BuffsMsg.json (engine → TS, DOM buff-icon bar). Each entry
// is an active buff with its triggering skill id and remaining duration in ms.
export const BuffEntry = z.object({
  skillid: z.number().int(),
  duration: z.number().int(),
});
export type BuffEntry = z.infer<typeof BuffEntry>;
export const BuffsData = z.array(BuffEntry);
export type BuffsData = z.infer<typeof BuffsData>;

// Parsed payload of NoticeMsg.json (engine → TS, DOM notification toasts).
// ntype defaults to "system" when omitted by the engine.
export const NoticePayload = z.object({
  text: z.string(),
  ntype: z.string().optional().default("system"),
});
export type NoticePayload = z.infer<typeof NoticePayload>;

export const PingMsg = z.object({
  ...base,
  t: z.literal("ping"),
  nonce: z.number().int(),
});
export const OpenWindowCmd = z.object({
  ...base,
  t: z.literal("openWindow"),
  window: z.string(),
});
export const SendChatCmd = z.object({
  ...base,
  t: z.literal("sendChat"),
  text: z.string(),
});

// Outbound command schemas (TS → engine)
export const LoginCmd = z.object({
  ...base,
  t: z.literal("login"),
  account: z.string(),
  password: z.string(),
});
export const SelectWorldCmd = z.object({
  ...base,
  t: z.literal("selectWorld"),
  world: z.number().int(),
  channel: z.number().int(),
});
export const RequestCharlistCmd = z.object({
  ...base,
  t: z.literal("requestCharlist"),
  world: z.number().int(),
  channel: z.number().int(),
});
export const SelectCharCmd = z.object({
  ...base,
  t: z.literal("selectChar"),
  cid: z.number().int(),
});
export const BackToLoginCmd = z.object({
  ...base,
  t: z.literal("backToLogin"),
});
export const RequestAssetCmd = z.object({
  ...base,
  t: z.literal("requestAsset"),
  key: z.string(),
});
export const AllocateApCmd = z.object({
  ...base,
  t: z.literal("allocateAp"),
  stat: z.string(),
});
export const NpcRespondCmd = z.object({
  ...base,
  t: z.literal("npcRespond"),
  action: z.string(),
  selection: z.number().int(),
  text: z.string(),
});
export const ShopActionCmd = z.object({
  ...base,
  t: z.literal("shopAction"),
  action: z.string(),
  slot: z.number().int(),
  itemid: z.number().int(),
  quantity: z.number().int(),
});

export const InboundMsg = z.discriminatedUnion("t", [
  PongMsg,
  SceneMsg,
  StatsMsg,
  CharacterMsg,
  ChatMsg,
  LoginResultMsg,
  WorldsMsg,
  CharactersMsg,
  AssetMsg,
  StatsDetailMsg,
  InventoryMsg,
  EquipmentMsg,
  SkillsMsg,
  NpcDialogMsg,
  ShopMsg,
  BuffsMsg,
  NoticeMsg,
]);
export const OutboundCmd = z.discriminatedUnion("t", [
  PingMsg,
  OpenWindowCmd,
  SendChatCmd,
  LoginCmd,
  SelectWorldCmd,
  RequestCharlistCmd,
  SelectCharCmd,
  BackToLoginCmd,
  RequestAssetCmd,
  AllocateApCmd,
  NpcRespondCmd,
  ShopActionCmd,
]);

export type InboundMsg = z.infer<typeof InboundMsg>;
export type OutboundCmd = z.infer<typeof OutboundCmd>;
