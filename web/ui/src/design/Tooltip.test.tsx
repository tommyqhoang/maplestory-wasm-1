import { renderToStaticMarkup } from "react-dom/server";
import { Tooltip } from "./Tooltip";

// The project builds with process.env.NODE_ENV = "production", so React's
// act() is unavailable in tests. All tests use renderToStaticMarkup (server
// render) following the project convention. The Tooltip supports a
// `forceVisible` prop specifically to allow static-render tests to assert on
// panel markup without requiring live interaction.

test("Tooltip renders its children", () => {
  const html = renderToStaticMarkup(
    <Tooltip content="Item #1234">
      <span data-testid="trigger">icon</span>
    </Tooltip>,
  );
  expect(html).toContain('data-testid="trigger"');
  expect(html).toContain("icon");
});

test("Tooltip panel is not rendered by default (hidden until hover)", () => {
  const html = renderToStaticMarkup(
    <Tooltip content="Item #1234">
      <span>icon</span>
    </Tooltip>,
  );
  expect(html).not.toContain('data-testid="tooltip-panel"');
  expect(html).not.toContain("Item #1234");
});

test("Tooltip panel is present in DOM when forceVisible is true", () => {
  const html = renderToStaticMarkup(
    <Tooltip content="Item #9999" forceVisible>
      <span>icon</span>
    </Tooltip>,
  );
  expect(html).toContain('data-testid="tooltip-panel"');
  expect(html).toContain("Item #9999");
});

test("Tooltip panel has role=tooltip when visible", () => {
  const html = renderToStaticMarkup(
    <Tooltip content="Skill #1000 · Lv 5" forceVisible>
      <span>icon</span>
    </Tooltip>,
  );
  expect(html).toContain('role="tooltip"');
  expect(html).toContain("Skill #1000");
});
