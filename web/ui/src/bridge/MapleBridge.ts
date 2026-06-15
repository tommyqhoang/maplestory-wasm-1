import {
  InboundMsg,
  OutboundCmd,
  PROTOCOL_VERSION,
  WorldInfo,
  CharInfo,
  StatsDetail,
  InventoryData,
  EquipmentData,
  SkillsData,
  NpcDialogPayload,
  ShopPayload,
  BuffsData,
  NoticePayload,
} from "./protocol";
import type { ChatChannel } from "./protocol";
import { z } from "zod";
import { useGame } from "../store/store";

type SendFn = (json: string) => void;

// Incoming group/whisper chat lines are pre-formatted by the engine with a
// channel prefix ("[Party] name: msg"). Derive the channel so the DOM chat can
// route the line to the matching tab. Anything unprefixed is map/general chat.
const CHANNEL_PREFIXES: Array<[string, ChatChannel]> = [
  ["[Party]", "party"],
  ["[Guild]", "guild"],
  ["[Alliance]", "alliance"],
  ["[Buddy]", "buddy"],
  ["[To ", "whisper"],
  ["[From ", "whisper"],
];

function channelFromLine(line: string): ChatChannel {
  for (const [prefix, channel] of CHANNEL_PREFIXES) {
    if (line.startsWith(prefix)) return channel;
  }
  return "all";
}

export class MapleBridge {
  constructor(private readonly transport: SendFn) {}

  recv(json: string): void {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      console.warn("[bridge] dropped non-JSON message");
      return;
    }
    const parsed = InboundMsg.safeParse(raw);
    if (!parsed.success) {
      console.warn("[bridge] dropped invalid message", parsed.error.issues);
      return;
    }
    this.route(parsed.data);
  }

  send(cmd: OutboundCmd): void {
    const checked = OutboundCmd.parse(cmd);
    this.transport(JSON.stringify(checked));
  }

  ping(nonce: number): void {
    this.send({ v: PROTOCOL_VERSION, t: "ping", nonce });
  }

  openWindow(window: string): void {
    this.send({ v: PROTOCOL_VERSION, t: "openWindow", window });
  }

  sendChat(text: string, channel: ChatChannel = "all", target = ""): void {
    this.send({ v: PROTOCOL_VERSION, t: "sendChat", text, channel, target });
  }

  login(account: string, password: string): void {
    this.send({ v: PROTOCOL_VERSION, t: "login", account, password });
  }

  selectWorld(world: number, channel: number): void {
    this.send({ v: PROTOCOL_VERSION, t: "selectWorld", world, channel });
  }

  requestCharlist(world: number, channel: number): void {
    this.send({ v: PROTOCOL_VERSION, t: "requestCharlist", world, channel });
  }

  selectChar(cid: number): void {
    this.send({ v: PROTOCOL_VERSION, t: "selectChar", cid });
  }

  backToLogin(): void {
    this.send({ v: PROTOCOL_VERSION, t: "backToLogin" });
  }

  requestAsset(key: string): void {
    this.send({ v: PROTOCOL_VERSION, t: "requestAsset", key });
  }

  allocateAp(stat: string): void {
    this.send({ v: PROTOCOL_VERSION, t: "allocateAp", stat });
  }

  npcRespond(action: string, selection = 0, text = ""): void {
    this.send({
      v: PROTOCOL_VERSION,
      t: "npcRespond",
      action,
      selection,
      text,
    });
  }

  shopAction(action: string, slot = 0, itemid = 0, quantity = 1): void {
    this.send({
      v: PROTOCOL_VERSION,
      t: "shopAction",
      action,
      slot,
      itemid,
      quantity,
    });
  }

  // Double-click an inventory item: equip an equip, consume a use item.
  useItem(tab: string, slot: number): void {
    this.send({ v: PROTOCOL_VERSION, t: "useItem", tab, slot });
  }

  setBgmVolume(value: number): void {
    this.send({ v: PROTOCOL_VERSION, t: "setBgmVolume", value });
  }

  setSfxVolume(value: number): void {
    this.send({ v: PROTOCOL_VERSION, t: "setSfxVolume", value });
  }

  private route(msg: InboundMsg): void {
    const s = useGame.getState();
    switch (msg.t) {
      case "stats":
        s.setStats({
          hp: msg.hp,
          maxHp: msg.maxHp,
          mp: msg.mp,
          maxMp: msg.maxMp,
          level: msg.level,
          exp: msg.exp,
          expNext: msg.expNext,
        });
        break;
      case "scene":
        s.setScene(msg.name);
        break;
      case "pong":
        s.setPong(msg.nonce);
        break;
      case "character":
        s.setCharacter({ name: msg.name, job: msg.job });
        break;
      case "chat":
        s.addChatLine({
          line: msg.line,
          ctype: msg.ctype,
          channel: channelFromLine(msg.line),
        });
        break;
      case "loginResult":
        s.setLoginResult({ ok: msg.ok === 1, reason: msg.reason });
        break;
      case "worlds": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.json);
        } catch {
          console.warn("[bridge] worlds: failed to parse json field");
          s.setWorlds([]);
          break;
        }
        const result = z.array(WorldInfo).safeParse(parsed);
        if (!result.success) {
          console.warn(
            "[bridge] worlds: invalid world list",
            result.error.issues,
          );
          s.setWorlds([]);
        } else {
          s.setWorlds(result.data);
        }
        break;
      }
      case "characters": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.json);
        } catch {
          console.warn("[bridge] characters: failed to parse json field");
          s.setCharacters([]);
          break;
        }
        const result = z.array(CharInfo).safeParse(parsed);
        if (!result.success) {
          console.warn(
            "[bridge] characters: invalid character list",
            result.error.issues,
          );
          s.setCharacters([]);
        } else {
          s.setCharacters(result.data);
        }
        break;
      }
      case "asset":
        s.setAsset(msg.key, msg.dataUrl);
        break;
      case "statsdetail": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.json);
        } catch {
          console.warn("[bridge] statsdetail: failed to parse json field");
          break;
        }
        const result = StatsDetail.safeParse(parsed);
        if (!result.success) {
          console.warn(
            "[bridge] statsdetail: invalid payload",
            result.error.issues,
          );
        } else {
          s.setStatsDetail(result.data);
        }
        break;
      }
      case "inventory": {
        s.setMeso(msg.meso);
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.json);
        } catch {
          console.warn("[bridge] inventory: failed to parse json field");
          s.setInventory([]);
          break;
        }
        const result = InventoryData.safeParse(parsed);
        if (!result.success) {
          console.warn(
            "[bridge] inventory: invalid payload",
            result.error.issues,
          );
          s.setInventory([]);
        } else {
          s.setInventory(result.data);
        }
        break;
      }
      case "equipment": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.json);
        } catch {
          console.warn("[bridge] equipment: failed to parse json field");
          s.setEquipment([]);
          break;
        }
        const result = EquipmentData.safeParse(parsed);
        if (!result.success) {
          console.warn(
            "[bridge] equipment: invalid payload",
            result.error.issues,
          );
          s.setEquipment([]);
        } else {
          s.setEquipment(result.data);
        }
        break;
      }
      case "skills": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.json);
        } catch {
          console.warn("[bridge] skills: failed to parse json field");
          s.setSkills([]);
          break;
        }
        const result = SkillsData.safeParse(parsed);
        if (!result.success) {
          console.warn("[bridge] skills: invalid payload", result.error.issues);
          s.setSkills([]);
        } else {
          s.setSkills(result.data);
        }
        break;
      }
      case "npcDialog": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.json);
        } catch {
          console.warn("[bridge] npcDialog: failed to parse json field");
          s.setNpcDialog(null);
          break;
        }
        const result = NpcDialogPayload.safeParse(parsed);
        if (!result.success) {
          console.warn(
            "[bridge] npcDialog: invalid payload",
            result.error.issues,
          );
          s.setNpcDialog(null);
        } else if (!result.data.active) {
          // active:false means "no dialog" — clear the store.
          s.setNpcDialog(null);
        } else {
          s.setNpcDialog(result.data);
        }
        break;
      }
      case "shop": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.json);
        } catch {
          console.warn("[bridge] shop: failed to parse json field");
          s.setShop(null);
          break;
        }
        const result = ShopPayload.safeParse(parsed);
        if (!result.success) {
          console.warn("[bridge] shop: invalid payload", result.error.issues);
          s.setShop(null);
        } else if (!result.data.active) {
          // active:false means "no shop" — clear the store.
          s.setShop(null);
        } else {
          s.setShop(result.data);
        }
        break;
      }
      case "buffs": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.json);
        } catch {
          console.warn("[bridge] buffs: failed to parse json field");
          s.setBuffs([]);
          break;
        }
        const result = BuffsData.safeParse(parsed);
        if (!result.success) {
          console.warn("[bridge] buffs: invalid payload", result.error.issues);
          s.setBuffs([]);
        } else {
          s.setBuffs(result.data);
        }
        break;
      }
      case "connection":
        // The engine's native loop halts on a dropped game socket; surface it
        // so the player isn't left on a frozen frame with no explanation.
        s.setConnectionLost(msg.status === "lost");
        break;
      case "notice": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.json);
        } catch {
          console.warn("[bridge] notice: failed to parse json field");
          break;
        }
        const result = NoticePayload.safeParse(parsed);
        if (!result.success) {
          console.warn("[bridge] notice: invalid payload", result.error.issues);
        } else {
          s.pushNotice(result.data.text, result.data.ntype);
        }
        break;
      }
    }
  }
}
