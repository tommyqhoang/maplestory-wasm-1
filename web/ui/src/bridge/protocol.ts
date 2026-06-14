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
]);

export type InboundMsg = z.infer<typeof InboundMsg>;
export type OutboundCmd = z.infer<typeof OutboundCmd>;
