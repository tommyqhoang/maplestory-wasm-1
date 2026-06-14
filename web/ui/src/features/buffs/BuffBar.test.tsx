import { renderToStaticMarkup } from "react-dom/server";
import { BuffBarBody, formatDuration } from "./BuffBar";
import type { BuffEntry } from "../../bridge/protocol";

const buffs: BuffEntry[] = [
  { skillid: 1001003, duration: 200000 },
  { skillid: 1101006, duration: 30000 },
];

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("BuffBarBody renders one icon per active buff", () => {
  const html = renderToStaticMarkup(<BuffBarBody buffs={buffs} />);
  expect(countOccurrences(html, 'data-testid="buff-icon"')).toBe(2);
});

test("BuffBarBody renders a skill icon for each buff", () => {
  const html = renderToStaticMarkup(<BuffBarBody buffs={buffs} />);
  // AssetImage renders a placeholder with aria-label = alt while loading.
  expect(html).toContain('aria-label="Buff 1001003"');
  expect(html).toContain('aria-label="Buff 1101006"');
});

test("BuffBarBody shows a remaining-time label per buff", () => {
  const html = renderToStaticMarkup(<BuffBarBody buffs={buffs} />);
  expect(countOccurrences(html, 'data-testid="buff-time"')).toBe(2);
});

test("BuffBarBody renders nothing when there are no buffs", () => {
  const html = renderToStaticMarkup(<BuffBarBody buffs={[]} />);
  expect(html).toBe("");
});

test("formatDuration formats seconds and minutes sensibly", () => {
  expect(formatDuration(0)).toBe("");
  expect(formatDuration(30000)).toBe("30s");
  expect(formatDuration(59000)).toBe("59s");
  expect(formatDuration(60000)).toBe("1m");
  expect(formatDuration(200000)).toBe("4m");
});
