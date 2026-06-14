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
