import { renderToStaticMarkup } from "react-dom/server";
import { InventoryBody } from "./InventoryWindow";
import type { InventorySlot } from "../../bridge/protocol";

// renderToStaticMarkup uses React's server snapshot, so the store-gated window
// is tested via store inspection elsewhere; the body is rendered directly via
// the pure InventoryBody component (same convention as StatsWindow.test.tsx).

const inventory: InventorySlot[] = [
  { tab: "use", slot: 1, itemid: 2000000, count: 200 },
  { tab: "use", slot: 2, itemid: 2000001, count: 1 },
  { tab: "equip", slot: 1, itemid: 1040002, count: 1 },
];

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("InventoryBody renders one occupied cell with a count badge for the use tab", () => {
  const html = renderToStaticMarkup(
    <InventoryBody tab="use" setTab={() => {}} inventory={inventory} />,
  );
  // Count badge only appears for count > 1 (slot 1, count 200).
  expect(countOccurrences(html, 'data-testid="inventory-count"')).toBe(1);
  expect(html).toContain(">200<");
});

test("InventoryBody renders a full grid of cells (>= default size)", () => {
  const html = renderToStaticMarkup(
    <InventoryBody tab="use" setTab={() => {}} inventory={inventory} />,
  );
  // Default grid is 4 columns x 6 rows = 24 cells.
  expect(countOccurrences(html, 'data-testid="inventory-cell"')).toBe(24);
});

test("InventoryBody filters items to the selected tab", () => {
  const html = renderToStaticMarkup(
    <InventoryBody tab="equip" setTab={() => {}} inventory={inventory} />,
  );
  // AssetImage renders a placeholder with aria-label = alt while loading.
  // Only the single equip item (1040002) should appear; no use-tab count badge.
  expect(html).toContain('aria-label="Item 1040002"');
  expect(countOccurrences(html, 'data-testid="inventory-count"')).toBe(0);
});

test("InventoryBody renders all five tab buttons", () => {
  const html = renderToStaticMarkup(
    <InventoryBody tab="equip" setTab={() => {}} inventory={inventory} />,
  );
  for (const key of ["equip", "use", "setup", "etc", "cash"]) {
    expect(html).toContain(`data-testid="inventory-tab-${key}"`);
  }
});
