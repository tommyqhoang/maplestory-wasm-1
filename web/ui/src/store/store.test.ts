import { useGame } from "./store";

test("setStats updates stats", () => {
  useGame
    .getState()
    .setStats({ hp: 50, maxHp: 50, mp: 5, maxMp: 5, level: 1, exp: 0 });
  expect(useGame.getState().stats.hp).toBe(50);
  expect(useGame.getState().stats.maxMp).toBe(5);
});

test("setScene updates scene", () => {
  useGame.getState().setScene("ingame");
  expect(useGame.getState().scene).toBe("ingame");
});

test("setAsset stores a data url under its key", () => {
  useGame.getState().setAsset("item/2000000", "data:image/png;base64,XYZ");
  expect(useGame.getState().assets["item/2000000"]).toBe(
    "data:image/png;base64,XYZ",
  );
});
