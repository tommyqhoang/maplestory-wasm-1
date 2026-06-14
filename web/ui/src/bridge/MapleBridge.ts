import {
  InboundMsg,
  OutboundCmd,
  PROTOCOL_VERSION,
  WorldInfo,
  CharInfo,
  StatsDetail,
} from "./protocol";
import { z } from "zod";
import { useGame } from "../store/store";

type SendFn = (json: string) => void;

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

  sendChat(text: string): void {
    this.send({ v: PROTOCOL_VERSION, t: "sendChat", text });
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
        s.addChatLine({ line: msg.line, ctype: msg.ctype });
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
    }
  }
}
