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

export const InboundMsg = z.discriminatedUnion("t", [
  PongMsg,
  SceneMsg,
  StatsMsg,
  CharacterMsg,
  ChatMsg,
  LoginResultMsg,
  WorldsMsg,
  CharactersMsg,
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
]);

export type InboundMsg = z.infer<typeof InboundMsg>;
export type OutboundCmd = z.infer<typeof OutboundCmd>;
