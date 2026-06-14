import { MapleBridge } from "./MapleBridge";
import { useGame } from "../store/store";

function makeBridge() {
  const sent: string[] = [];
  const bridge = new MapleBridge((json) => sent.push(json));
  return { bridge, sent };
}

test("recv routes a valid stats message into the store", () => {
  const { bridge } = makeBridge();
  bridge.recv(
    JSON.stringify({
      v: 1,
      t: "stats",
      hp: 30,
      maxHp: 50,
      mp: 2,
      maxMp: 5,
      level: 3,
      exp: 12,
    }),
  );
  expect(useGame.getState().stats.hp).toBe(30);
  expect(useGame.getState().stats.level).toBe(3);
});

test("recv routes scene", () => {
  const { bridge } = makeBridge();
  bridge.recv(JSON.stringify({ v: 1, t: "scene", name: "charselect" }));
  expect(useGame.getState().scene).toBe("charselect");
});

test("recv ignores malformed messages without throwing", () => {
  const { bridge } = makeBridge();
  expect(() => bridge.recv("{ not json")).not.toThrow();
  expect(() =>
    bridge.recv(JSON.stringify({ v: 1, t: "stats", hp: "x" })),
  ).not.toThrow();
});

test("send validates and forwards a ping command as json", () => {
  const { bridge, sent } = makeBridge();
  bridge.send({ v: 1, t: "ping", nonce: 7 });
  expect(JSON.parse(sent[0])).toEqual({ v: 1, t: "ping", nonce: 7 });
});

test("send throws on an invalid command", () => {
  const { bridge } = makeBridge();
  // @ts-expect-error invalid command shape
  expect(() => bridge.send({ v: 1, t: "ping" })).toThrow();
});

test("recv routes character message into store", () => {
  const { bridge } = makeBridge();
  bridge.recv(
    JSON.stringify({ v: 1, t: "character", name: "WasmHero", job: "Beginner" }),
  );
  expect(useGame.getState().character.name).toBe("WasmHero");
});

test("recv routes chat message into store", () => {
  const { bridge } = makeBridge();
  bridge.recv(JSON.stringify({ v: 1, t: "chat", line: "hello", ctype: 0 }));
  const chat = useGame.getState().chat;
  expect(chat[chat.length - 1].line).toBe("hello");
});

test("bridge.openWindow sends correct command", () => {
  const { bridge, sent } = makeBridge();
  bridge.openWindow("inventory");
  expect(JSON.parse(sent[0])).toEqual({
    v: 1,
    t: "openWindow",
    window: "inventory",
  });
});

test("bridge.sendChat sends correct command", () => {
  const { bridge, sent } = makeBridge();
  bridge.sendChat("hi");
  expect(JSON.parse(sent[0])).toEqual({ v: 1, t: "sendChat", text: "hi" });
});

test("chat store caps at 200 entries", () => {
  const { bridge } = makeBridge();
  // Send 250 chat messages
  for (let i = 0; i < 250; i++) {
    bridge.recv(JSON.stringify({ v: 1, t: "chat", line: `msg${i}`, ctype: 0 }));
  }
  const chat = useGame.getState().chat;
  expect(chat.length).toBeLessThanOrEqual(200);
  // Last entry should be the most recent
  expect(chat[chat.length - 1].line).toBe("msg249");
});
