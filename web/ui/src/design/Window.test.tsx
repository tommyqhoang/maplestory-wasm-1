import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "./Window";

test("Window renders its title", () => {
  const html = renderToStaticMarkup(
    <Window title="Stats" onClose={() => {}}>
      <div>body</div>
    </Window>,
  );
  expect(html).toContain("Stats");
  expect(html).toContain("body");
});

test("Window renders a close button", () => {
  const html = renderToStaticMarkup(
    <Window title="Stats" onClose={() => {}}>
      <div />
    </Window>,
  );
  expect(html).toContain('aria-label="Close"');
});
