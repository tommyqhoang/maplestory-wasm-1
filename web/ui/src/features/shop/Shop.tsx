import { useGame } from "../../store/store";
import type { ShopPayload, InventorySlot } from "../../bridge/protocol";
import { bridge } from "../../bridge/useBridge";
import { AssetImage } from "../../design/AssetImage";
import { Window } from "../../design/Window";
import { Button } from "../../design/primitives";

const ICON_PX = 32;

/** Inventory tabs offered for selling, in display order. */
const SELL_TABS = ["use", "etc", "equip"];

/** Formats an integer meso price with thousands separators. */
function formatPrice(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Pure presentational body of the NPC shop window. Exported separately so it
 * can be unit-tested without the zustand store gate (renderToStaticMarkup uses
 * the server snapshot and does not reflect store mutations).
 *
 * Left "Buy" lists the shop's items; right "Sell" lists the player's sellable
 * inventory. Each action routes back to the engine via bridge.shopAction, which
 * reuses the in-canvas UIShop dispatch.
 */
export function ShopBody({
  shop,
  inventory,
}: {
  shop: ShopPayload;
  inventory: InventorySlot[];
}) {
  const action = (name: string, slot = 0, itemid = 0, quantity = 1) =>
    bridge.shopAction(name, slot, itemid, quantity);

  // Sellable inventory items: use/etc/equip tabs, in tab then slot order.
  const sellItems = inventory
    .filter((it) => SELL_TABS.includes(it.tab))
    .sort(
      (a, b) =>
        SELL_TABS.indexOf(a.tab) - SELL_TABS.indexOf(b.tab) || a.slot - b.slot,
    );

  return (
    <div
      data-testid="shop-window"
      style={{ display: "flex", gap: "var(--sp-4)", minWidth: "480px" }}
    >
      {/* Buy column */}
      <div style={{ flex: 1, minWidth: "220px" }}>
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "var(--sp-2)",
          }}
        >
          Buy
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-1)",
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {shop.items.map((item) => (
            <div
              key={item.slot}
              data-testid="shop-buy-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                padding: "var(--sp-1)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--surface-border)",
                borderRadius: "var(--radius)",
              }}
            >
              <AssetImage
                assetKey={`item/${item.itemid}`}
                alt={`Item ${item.itemid}`}
                style={{ width: ICON_PX, height: ICON_PX }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  #{item.itemid}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {formatPrice(item.price)} mesos
                </div>
              </div>
              <Button
                onClick={() => action("buy", item.slot, item.itemid, 1)}
                testId={`shop-buy-${item.slot}`}
                disabled={item.buyable === false}
              >
                Buy
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Sell column */}
      <div style={{ flex: 1, minWidth: "220px" }}>
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "var(--sp-2)",
          }}
        >
          Sell
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-1)",
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {sellItems.map((item) => (
            <div
              key={`${item.tab}-${item.slot}`}
              data-testid="shop-sell-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                padding: "var(--sp-1)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--surface-border)",
                borderRadius: "var(--radius)",
              }}
            >
              <AssetImage
                assetKey={
                  item.tab === "equip"
                    ? `equip/${item.itemid}`
                    : `item/${item.itemid}`
                }
                alt={`Item ${item.itemid}`}
                style={{ width: ICON_PX, height: ICON_PX }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  #{item.itemid}
                </div>
                {item.count > 1 && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    x{item.count}
                  </div>
                )}
              </div>
              <Button
                onClick={() =>
                  action("sell", item.slot, item.itemid, item.count || 1)
                }
                testId={`shop-sell-${item.tab}-${item.slot}`}
              >
                Sell
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Shop() {
  const shop = useGame((s) => s.shop);
  const inventory = useGame((s) => s.inventory);

  if (!shop?.active) return null;

  return (
    <Window title="Shop" onClose={() => bridge.shopAction("exit")}>
      <ShopBody shop={shop} inventory={inventory} />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "var(--sp-3)",
        }}
      >
        <Button onClick={() => bridge.shopAction("exit")} testId="shop-exit">
          Exit
        </Button>
      </div>
    </Window>
  );
}
