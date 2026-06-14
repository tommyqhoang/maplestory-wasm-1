import { renderToStaticMarkup } from "react-dom/server";
import { StatsBody } from "./StatsWindow";
import { useGame } from "../../store/store";
import type { StatsDetail } from "../../bridge/protocol";

// renderToStaticMarkup uses React's server snapshot, so store-gated content is
// not reflected in markup (same convention as CharSelect.test.tsx). The window
// gate is therefore tested via store inspection, and the body is rendered
// directly via the pure StatsBody component.

const detail: StatsDetail = {
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

test("StatsBody shows the STR value", () => {
  const html = renderToStaticMarkup(<StatsBody detail={detail} />);
  expect(html).toContain('data-testid="stat-str"');
  expect(html).toContain(">12<");
});

test("StatsBody shows + allocate buttons when ap > 0", () => {
  const html = renderToStaticMarkup(<StatsBody detail={detail} />);
  expect(html).toContain("Allocate AP to STR");
});

test("StatsBody hides + buttons when ap is 0", () => {
  const html = renderToStaticMarkup(
    <StatsBody detail={{ ...detail, ap: 0 }} />,
  );
  expect(html).not.toContain("Allocate AP to STR");
});

test("StatsBody renders a placeholder when detail is null", () => {
  const html = renderToStaticMarkup(<StatsBody detail={null} />);
  expect(html).toContain("No stats available");
});

test("toggleWindow gates StatsWindow open state in the store", () => {
  useGame.setState({ openWindows: {} });
  expect(useGame.getState().openWindows["stats"]).toBeFalsy();
  useGame.getState().toggleWindow("stats");
  expect(useGame.getState().openWindows["stats"]).toBe(true);
  useGame.getState().closeWindow("stats");
  expect(useGame.getState().openWindows["stats"]).toBe(false);
});
