import { renderToStaticMarkup } from "react-dom/server";
import { EquipmentBody } from "./EquipmentWindow";
import type { EquipSlot } from "../../bridge/protocol";

// Body is rendered directly via the pure EquipmentBody component (same
// convention as StatsWindow.test.tsx / InventoryWindow.test.tsx).

const equipment: EquipSlot[] = [
  { slot: 5, itemid: 1040002 }, // Top
  { slot: 11, itemid: 1302000 }, // Weapon
];

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("EquipmentBody renders the full set of equip slots", () => {
  const html = renderToStaticMarkup(<EquipmentBody equipment={equipment} />);
  // 18 labeled slots defined in SLOTS.
  expect(countOccurrences(html, 'data-testid="equipment-slot"')).toBe(18);
});

test("EquipmentBody renders icons for equipped items", () => {
  const html = renderToStaticMarkup(<EquipmentBody equipment={equipment} />);
  expect(html).toContain('aria-label="Top (1040002)"');
  expect(html).toContain('aria-label="Weapon (1302000)"');
});

test("EquipmentBody renders with no equipment without throwing", () => {
  const html = renderToStaticMarkup(<EquipmentBody equipment={[]} />);
  expect(countOccurrences(html, 'data-testid="equipment-slot"')).toBe(18);
});
