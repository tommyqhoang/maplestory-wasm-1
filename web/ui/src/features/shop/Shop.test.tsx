import { renderToStaticMarkup } from "react-dom/server";
import { ShopBody } from "./Shop";
import type { ShopPayload, InventorySlot } from "../../bridge/protocol";

// renderToStaticMarkup uses React's server snapshot, so store-gated content is
// not reflected in markup (same convention as NpcDialog.test.tsx). The body is
// rendered directly via the pure ShopBody component.

test("ShopBody with items shows Buy buttons", () => {
  const shop: ShopPayload = {
    active: true,
    npcid: 9000000,
    items: [
      { slot: 0, itemid: 2000000, price: 100, buyable: true },
      { slot: 1, itemid: 2000001, price: 250, buyable: true },
    ],
  };
  const html = renderToStaticMarkup(<ShopBody shop={shop} inventory={[]} />);
  expect(html).toContain('data-testid="shop-buy-0"');
  expect(html).toContain('data-testid="shop-buy-1"');
  expect(html).toContain("#2000000");
  // Price is comma-formatted.
  expect(html).toContain("250 mesos");
});

test("ShopBody shows sellable inventory rows with Sell buttons", () => {
  const inventory: InventorySlot[] = [
    { tab: "use", slot: 1, itemid: 2000000, count: 50 },
    { tab: "cash", slot: 2, itemid: 5000000, count: 1 },
  ];
  const shop: ShopPayload = { active: true, npcid: 0, items: [] };
  const html = renderToStaticMarkup(
    <ShopBody shop={shop} inventory={inventory} />,
  );
  // use-tab item is sellable; cash-tab item is filtered out.
  expect(html).toContain('data-testid="shop-sell-use-1"');
  expect(html).not.toContain('data-testid="shop-sell-cash-2"');
});
