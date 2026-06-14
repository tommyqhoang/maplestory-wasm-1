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

// Phase 2 Task 1 — entry flow tests

test("recv loginResult ok=0 sets store.loginResult = {ok:false, reason:'bad'}", () => {
  const { bridge } = makeBridge();
  bridge.recv(JSON.stringify({ v: 1, t: "loginResult", ok: 0, reason: "bad" }));
  expect(useGame.getState().loginResult).toEqual({ ok: false, reason: "bad" });
});

test("recv worlds with valid json populates store.worlds", () => {
  const { bridge } = makeBridge();
  const worldJson = JSON.stringify([
    {
      wid: 0,
      name: "Scania",
      message: "",
      channelcount: 2,
      flag: 0,
      channelloads: [1, 1],
    },
  ]);
  bridge.recv(JSON.stringify({ v: 1, t: "worlds", json: worldJson }));
  const worlds = useGame.getState().worlds;
  expect(worlds.length).toBe(1);
  expect(worlds[0].name).toBe("Scania");
});

test("recv worlds with malformed json sets store.worlds = [] without throwing", () => {
  const { bridge } = makeBridge();
  expect(() =>
    bridge.recv(JSON.stringify({ v: 1, t: "worlds", json: "not json" })),
  ).not.toThrow();
  expect(useGame.getState().worlds).toEqual([]);
});

test("recv characters with valid CharInfo populates store.characters", () => {
  const { bridge } = makeBridge();
  const charJson = JSON.stringify([
    {
      cid: 1,
      name: "HeroChar",
      level: 10,
      job: 100,
      str: 4,
      dex: 4,
      int: 4,
      luk: 4,
    },
  ]);
  bridge.recv(JSON.stringify({ v: 1, t: "characters", json: charJson }));
  const chars = useGame.getState().characters;
  expect(chars.length).toBe(1);
  expect(chars[0].name).toBe("HeroChar");
  expect(chars[0].level).toBe(10);
});

test("bridge.login sends correct command", () => {
  const { bridge, sent } = makeBridge();
  bridge.login("a", "b");
  expect(JSON.parse(sent[0])).toEqual({
    v: 1,
    t: "login",
    account: "a",
    password: "b",
  });
});

test("bridge.selectChar sends correct command", () => {
  const { bridge, sent } = makeBridge();
  bridge.selectChar(5);
  expect(JSON.parse(sent[0])).toEqual({ v: 1, t: "selectChar", cid: 5 });
});

test("bridge.backToLogin sends correct command", () => {
  const { bridge, sent } = makeBridge();
  bridge.backToLogin();
  expect(JSON.parse(sent[0])).toEqual({ v: 1, t: "backToLogin" });
});

// Phase 3 Task 1 — WZ asset bridge

test("recv asset sets store.assets[key]", () => {
  const { bridge } = makeBridge();
  bridge.recv(
    JSON.stringify({
      v: 1,
      t: "asset",
      key: "item/2000000",
      dataUrl: "data:image/png;base64,AAAA",
    }),
  );
  expect(useGame.getState().assets["item/2000000"]).toBe(
    "data:image/png;base64,AAAA",
  );
});

test("bridge.requestAsset sends correct command", () => {
  const { bridge, sent } = makeBridge();
  bridge.requestAsset("item/2000");
  expect(JSON.parse(sent[0])).toEqual({
    v: 1,
    t: "requestAsset",
    key: "item/2000",
  });
});

// Phase 3 Task 2 — detailed stats window

test("recv statsdetail with valid json populates store.statsDetail", () => {
  const { bridge } = makeBridge();
  const detail = {
    name: "HeroChar",
    job: "Beginner",
    level: 10,
    ap: 5,
    str: 12,
    dex: 8,
    int: 4,
    luk: 4,
    hp: 100,
    maxHp: 120,
    mp: 30,
    maxMp: 40,
    watk: 17,
    matk: 9,
    wdef: 5,
    mdef: 3,
    accuracy: 25,
    avoid: 11,
    speed: 100,
    jump: 100,
  };
  bridge.recv(
    JSON.stringify({ v: 1, t: "statsdetail", json: JSON.stringify(detail) }),
  );
  const sd = useGame.getState().statsDetail;
  expect(sd).not.toBeNull();
  expect(sd?.str).toBe(12);
  expect(sd?.ap).toBe(5);
  expect(sd?.job).toBe("Beginner");
});

test("recv statsdetail with malformed json does not throw", () => {
  const { bridge } = makeBridge();
  useGame.getState().setStatsDetail(null);
  expect(() =>
    bridge.recv(JSON.stringify({ v: 1, t: "statsdetail", json: "not json" })),
  ).not.toThrow();
  expect(useGame.getState().statsDetail).toBeNull();
});

test("bridge.allocateAp sends correct command", () => {
  const { bridge, sent } = makeBridge();
  bridge.allocateAp("str");
  expect(JSON.parse(sent[0])).toEqual({
    v: 1,
    t: "allocateAp",
    stat: "str",
  });
});

// Phase 3 Task 3 — inventory & equipment windows

test("recv inventory with one slot populates store.inventory", () => {
  const { bridge } = makeBridge();
  const inv = [{ tab: "use", slot: 1, itemid: 2000000, count: 200 }];
  bridge.recv(
    JSON.stringify({ v: 1, t: "inventory", json: JSON.stringify(inv) }),
  );
  const got = useGame.getState().inventory;
  expect(got.length).toBe(1);
  expect(got[0].tab).toBe("use");
  expect(got[0].itemid).toBe(2000000);
  expect(got[0].count).toBe(200);
});

test("recv inventory with malformed json sets store.inventory = [] without throwing", () => {
  const { bridge } = makeBridge();
  useGame
    .getState()
    .setInventory([{ tab: "use", slot: 1, itemid: 1, count: 1 }]);
  expect(() =>
    bridge.recv(JSON.stringify({ v: 1, t: "inventory", json: "not json" })),
  ).not.toThrow();
  expect(useGame.getState().inventory).toEqual([]);
});

test("recv equipment with one slot populates store.equipment", () => {
  const { bridge } = makeBridge();
  const eq = [{ slot: 5, itemid: 1040002 }];
  bridge.recv(
    JSON.stringify({ v: 1, t: "equipment", json: JSON.stringify(eq) }),
  );
  const got = useGame.getState().equipment;
  expect(got.length).toBe(1);
  expect(got[0].slot).toBe(5);
  expect(got[0].itemid).toBe(1040002);
});

test("recv equipment with malformed json sets store.equipment = [] without throwing", () => {
  const { bridge } = makeBridge();
  useGame.getState().setEquipment([{ slot: 1, itemid: 1 }]);
  expect(() =>
    bridge.recv(JSON.stringify({ v: 1, t: "equipment", json: "not json" })),
  ).not.toThrow();
  expect(useGame.getState().equipment).toEqual([]);
});

// Phase 3 Task 4 — skills window
test("recv skills with one entry populates store.skills", () => {
  const { bridge } = makeBridge();
  const sk = [{ skillid: 1001, level: 10, masterlevel: 20 }];
  bridge.recv(JSON.stringify({ v: 1, t: "skills", json: JSON.stringify(sk) }));
  const got = useGame.getState().skills;
  expect(got.length).toBe(1);
  expect(got[0].skillid).toBe(1001);
  expect(got[0].level).toBe(10);
  expect(got[0].masterlevel).toBe(20);
});

test("recv skills with malformed json sets store.skills = [] without throwing", () => {
  const { bridge } = makeBridge();
  useGame.getState().setSkills([{ skillid: 1, level: 1, masterlevel: 0 }]);
  expect(() =>
    bridge.recv(JSON.stringify({ v: 1, t: "skills", json: "not json" })),
  ).not.toThrow();
  expect(useGame.getState().skills).toEqual([]);
});
