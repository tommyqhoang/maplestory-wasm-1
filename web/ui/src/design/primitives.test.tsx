import { renderToStaticMarkup } from "react-dom/server";
import { GaugeBar } from "./primitives";

test("GaugeBar renders value/max text", () => {
  const html = renderToStaticMarkup(
    <GaugeBar
      label="HP"
      value={30}
      max={50}
      color="#e5484d"
      testId="test-hp"
    />,
  );
  expect(html).toContain("30 / 50");
});

test("GaugeBar fill width is 60% for value=30 max=50", () => {
  const html = renderToStaticMarkup(
    <GaugeBar
      label="HP"
      value={30}
      max={50}
      color="#e5484d"
      testId="test-hp"
    />,
  );
  expect(html).toContain("60%");
});

test("GaugeBar clamps to 0% when max=0", () => {
  const html = renderToStaticMarkup(
    <GaugeBar label="EXP" value={100} max={0} color="#f5a623" />,
  );
  expect(html).toContain("0%");
  // should not exceed 0
  expect(html).not.toMatch(/[1-9]\d*%/);
});

test("GaugeBar has data-testid attribute", () => {
  const html = renderToStaticMarkup(
    <GaugeBar
      label="MP"
      value={10}
      max={100}
      color="#3b82f6"
      testId="hud-mp"
    />,
  );
  expect(html).toContain('data-testid="hud-mp"');
});
