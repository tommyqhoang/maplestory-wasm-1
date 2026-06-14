import { renderToStaticMarkup } from "react-dom/server";
import { ToastsBody } from "./Toasts";
import type { Notice } from "../../store/store";

const notices: Notice[] = [
  { id: 1, text: "Welcome to Maple", ntype: "system" },
  { id: 2, text: "Server restarting soon", ntype: "system" },
];

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("ToastsBody renders one toast per notice", () => {
  const html = renderToStaticMarkup(
    <ToastsBody notices={notices} onDismiss={() => {}} />,
  );
  expect(countOccurrences(html, 'data-testid="toast"')).toBe(2);
});

test("ToastsBody renders the notice text", () => {
  const html = renderToStaticMarkup(
    <ToastsBody notices={notices} onDismiss={() => {}} />,
  );
  expect(html).toContain("Welcome to Maple");
  expect(html).toContain("Server restarting soon");
});

test("ToastsBody renders nothing when there are no notices", () => {
  const html = renderToStaticMarkup(
    <ToastsBody notices={[]} onDismiss={() => {}} />,
  );
  expect(html).toBe("");
});
