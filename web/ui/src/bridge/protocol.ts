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

export const InboundMsg = z.discriminatedUnion("t", [
  PongMsg,
  SceneMsg,
  StatsMsg,
  CharacterMsg,
  ChatMsg,
]);
export const OutboundCmd = z.discriminatedUnion("t", [
  PingMsg,
  OpenWindowCmd,
  SendChatCmd,
]);

export type InboundMsg = z.infer<typeof InboundMsg>;
export type OutboundCmd = z.infer<typeof OutboundCmd>;
