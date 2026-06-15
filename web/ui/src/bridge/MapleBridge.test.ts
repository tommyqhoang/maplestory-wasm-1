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

test("recv connection status:lost sets store.connectionLost = true", () => {
  const { bridge } = makeBridge();
  useGame.setState({ connectionLost: false });
  bridge.recv(JSON.stringify({ v: 1, t: "connection", status: "lost" }));
  expect(useGame.getState().connectionLost).toBe(true);
});

test("recv connection status other than lost clears connectionLost", () => {
  const { bridge } = makeBridge();
  useGame.setState({ connectionLost: true });
  bridge.recv(JSON.stringify({ v: 1, t: "connection", status: "connected" }));
  expect(useGame.getState().connectionLost).toBe(false);
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
  expect(JSON.parse(sent[0])).toEqual({
    v: 1,
    t: "sendChat",
    text: "hi",
    channel: "all",
    target: "",
  });
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

// Phase 4 Task 1 — NPC dialogue modal

test("recv npcDialog active populates store.npcDialog", () => {
  const { bridge } = makeBridge();
  const payload = {
    active: true,
    npcid: 9000000,
    mode: "selection",
    text: "Pick one:",
    selections: [
      { idx: 0, label: "First" },
      { idx: 1, label: "Second" },
    ],
  };
  bridge.recv(
    JSON.stringify({ v: 1, t: "npcDialog", json: JSON.stringify(payload) }),
  );
  const nd = useGame.getState().npcDialog;
  expect(nd).not.toBeNull();
  expect(nd?.active).toBe(true);
  expect(nd?.mode).toBe("selection");
  expect(nd?.selections?.length).toBe(2);
  expect(nd?.selections?.[1].label).toBe("Second");
});

test("recv npcDialog active:false clears store.npcDialog", () => {
  const { bridge } = makeBridge();
  useGame.getState().setNpcDialog({
    active: true,
    npcid: 1,
    mode: "ok",
    text: "hi",
  });
  bridge.recv(
    JSON.stringify({
      v: 1,
      t: "npcDialog",
      json: JSON.stringify({ active: false, mode: "" }),
    }),
  );
  expect(useGame.getState().npcDialog).toBeNull();
});

test("recv npcDialog with malformed json clears without throwing", () => {
  const { bridge } = makeBridge();
  useGame.getState().setNpcDialog({
    active: true,
    npcid: 1,
    mode: "ok",
    text: "hi",
  });
  expect(() =>
    bridge.recv(JSON.stringify({ v: 1, t: "npcDialog", json: "not json" })),
  ).not.toThrow();
  expect(useGame.getState().npcDialog).toBeNull();
});

test("bridge.npcRespond sends correct command", () => {
  const { bridge, sent } = makeBridge();
  bridge.npcRespond("select", 2, "");
  expect(JSON.parse(sent[0])).toEqual({
    v: 1,
    t: "npcRespond",
    action: "select",
    selection: 2,
    text: "",
  });
});

// Phase 4 Task 2 — NPC shop window

test("recv shop active populates store.shop with items", () => {
  const { bridge } = makeBridge();
  const payload = {
    active: true,
    npcid: 9000000,
    items: [
      { slot: 0, itemid: 2000000, price: 100, buyable: true },
      { slot: 1, itemid: 2000001, price: 200 },
    ],
  };
  bridge.recv(
    JSON.stringify({ v: 1, t: "shop", json: JSON.stringify(payload) }),
  );
  const shop = useGame.getState().shop;
  expect(shop).not.toBeNull();
  expect(shop?.active).toBe(true);
  expect(shop?.npcid).toBe(9000000);
  expect(shop?.items.length).toBe(2);
  expect(shop?.items[0].itemid).toBe(2000000);
  expect(shop?.items[0].price).toBe(100);
  // buyable defaults to true when omitted
  expect(shop?.items[1].buyable).toBe(true);
});

test("recv shop active:false clears store.shop", () => {
  const { bridge } = makeBridge();
  useGame.getState().setShop({ active: true, npcid: 1, items: [] });
  bridge.recv(
    JSON.stringify({
      v: 1,
      t: "shop",
      json: JSON.stringify({ active: false }),
    }),
  );
  expect(useGame.getState().shop).toBeNull();
});

test("recv shop with malformed json clears without throwing", () => {
  const { bridge } = makeBridge();
  useGame.getState().setShop({ active: true, npcid: 1, items: [] });
  expect(() =>
    bridge.recv(JSON.stringify({ v: 1, t: "shop", json: "not json" })),
  ).not.toThrow();
  expect(useGame.getState().shop).toBeNull();
});

test("bridge.shopAction sends correct command", () => {
  const { bridge, sent } = makeBridge();
  bridge.shopAction("buy", 0, 2000, 1);
  expect(JSON.parse(sent[0])).toEqual({
    v: 1,
    t: "shopAction",
    action: "buy",
    slot: 0,
    itemid: 2000,
    quantity: 1,
  });
});

test("bridge.shopAction exit uses defaults", () => {
  const { bridge, sent } = makeBridge();
  bridge.shopAction("exit");
  expect(JSON.parse(sent[0])).toEqual({
    v: 1,
    t: "shopAction",
    action: "exit",
    slot: 0,
    itemid: 0,
    quantity: 1,
  });
});

// Phase 5 Task 3 — buffs + notice routing

test("recv buffs with valid json populates store.buffs", () => {
  const { bridge } = makeBridge();
  const buffsJson = JSON.stringify([
    { skillid: 1001003, duration: 200000 },
    { skillid: 1101006, duration: 30000 },
  ]);
  bridge.recv(JSON.stringify({ v: 1, t: "buffs", json: buffsJson }));
  const buffs = useGame.getState().buffs;
  expect(buffs.length).toBe(2);
  expect(buffs[0].skillid).toBe(1001003);
  expect(buffs[0].duration).toBe(200000);
});

test("recv buffs with malformed json is safe and clears buffs", () => {
  const { bridge } = makeBridge();
  // Seed a buff so we can observe the reset.
  bridge.recv(
    JSON.stringify({
      v: 1,
      t: "buffs",
      json: JSON.stringify([{ skillid: 1, duration: 1 }]),
    }),
  );
  expect(() =>
    bridge.recv(JSON.stringify({ v: 1, t: "buffs", json: "not json" })),
  ).not.toThrow();
  expect(useGame.getState().buffs).toEqual([]);
});

test("recv notice pushes a toast with the text", () => {
  // Start from a clean notice list.
  useGame.setState({ notices: [] });
  const { bridge } = makeBridge();
  bridge.recv(
    JSON.stringify({
      v: 1,
      t: "notice",
      json: JSON.stringify({ text: "Welcome to Maple", ntype: "system" }),
    }),
  );
  const notices = useGame.getState().notices;
  expect(notices.length).toBe(1);
  expect(notices[0].text).toBe("Welcome to Maple");
  expect(notices[0].ntype).toBe("system");
});

test("recv notice defaults ntype to system when omitted", () => {
  useGame.setState({ notices: [] });
  const { bridge } = makeBridge();
  bridge.recv(
    JSON.stringify({
      v: 1,
      t: "notice",
      json: JSON.stringify({ text: "Server restarting" }),
    }),
  );
  const notices = useGame.getState().notices;
  expect(notices[0].ntype).toBe("system");
});

test("recv notice with malformed json is safe", () => {
  useGame.setState({ notices: [] });
  const { bridge } = makeBridge();
  expect(() =>
    bridge.recv(JSON.stringify({ v: 1, t: "notice", json: "not json" })),
  ).not.toThrow();
  expect(useGame.getState().notices).toEqual([]);
});

test("notices list is capped", () => {
  useGame.setState({ notices: [] });
  const { bridge } = makeBridge();
  for (let i = 0; i < 10; i++) {
    bridge.recv(
      JSON.stringify({
        v: 1,
        t: "notice",
        json: JSON.stringify({ text: `n${i}`, ntype: "system" }),
      }),
    );
  }
  const notices = useGame.getState().notices;
  expect(notices.length).toBeLessThanOrEqual(5);
  expect(notices[notices.length - 1].text).toBe("n9");
});
