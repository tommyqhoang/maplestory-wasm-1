import { InboundMsg, OutboundCmd, PROTOCOL_VERSION } from "./protocol";
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
    }
  }
}
