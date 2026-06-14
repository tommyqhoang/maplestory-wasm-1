import { useState } from "react";
import { useGame } from "../../store/store";
import type { InventorySlot } from "../../bridge/protocol";
import { AssetImage } from "../../design/AssetImage";
import { Window } from "../../design/Window";

/** Inventory tabs, in display order. Values match the engine's lowercased tab strings. */
const TABS: Array<{ key: string; label: string }> = [
  { key: "equip", label: "Equip" },
  { key: "use", label: "Use" },
  { key: "setup", label: "Setup" },
  { key: "etc", label: "Etc" },
  { key: "cash", label: "Cash" },
];

const COLUMNS = 4;
const ROWS = 6;
const CELL_PX = 40;

/**
 * Pure presentational body of the Inventory window. Exported separately so it
 * can be unit-tested without the zustand store gate (renderToStaticMarkup uses
 * the server snapshot and does not reflect store mutations).
 */
export function InventoryBody({
  tab,
  setTab,
  inventory,
}: {
  tab: string;
  setTab: (t: string) => void;
  inventory: InventorySlot[];
}) {
  // Items for the active tab, indexed by their 1-based engine slot.
  const bySlot = new Map<number, InventorySlot>();
  let maxSlot = COLUMNS * ROWS;
  for (const it of inventory) {
    if (it.tab !== tab) continue;
    bySlot.set(it.slot, it);
    if (it.slot > maxSlot) maxSlot = it.slot;
  }

  const cells = [];
  for (let slot = 1; slot <= maxSlot; slot++) {
    const item = bySlot.get(slot);
    cells.push(
      <div
        key={slot}
        data-testid="inventory-cell"
        style={{
          position: "relative",
          width: CELL_PX,
          height: CELL_PX,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--surface-border)",
          borderRadius: "var(--radius)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item && (
          <>
            <AssetImage
              assetKey={
                tab === "equip" ? `equip/${item.itemid}` : `item/${item.itemid}`
              }
              alt={`Item ${item.itemid}`}
              style={{ width: CELL_PX - 8, height: CELL_PX - 8 }}
            />
            {item.count > 1 && (
              <span
                data-testid="inventory-count"
                style={{
                  position: "absolute",
                  right: 1,
                  bottom: 0,
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  textShadow: "0 0 2px #000, 0 0 2px #000",
                  pointerEvents: "none",
                }}
              >
                {item.count}
              </span>
            )}
          </>
        )}
      </div>,
    );
  }

  return (
    <div style={{ minWidth: COLUMNS * CELL_PX + 24 }}>
      <div
        style={{
          display: "flex",
          gap: "var(--sp-2)",
          marginBottom: "var(--sp-3)",
        }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            className="ui-interactive"
            data-testid={`inventory-tab-${key}`}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              padding: "4px 0",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: "var(--radius)",
              border: "1px solid var(--surface-border)",
              background:
                tab === key ? "var(--accent)" : "rgba(255,255,255,0.04)",
              color: tab === key ? "#fff" : "var(--text-secondary)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLUMNS}, ${CELL_PX}px)`,
          gap: "var(--sp-2)",
          justifyContent: "center",
        }}
      >
        {cells}
      </div>
    </div>
  );
}

export function InventoryWindow() {
  const open = useGame((s) => s.openWindows["inventory"]);
  const inventory = useGame((s) => s.inventory);
  const closeWindow = useGame((s) => s.closeWindow);
  const [tab, setTab] = useState<string>("equip");

  if (!open) return null;

  return (
    <Window title="Inventory" onClose={() => closeWindow("inventory")}>
      <div data-testid="inventory-window">
        <InventoryBody tab={tab} setTab={setTab} inventory={inventory} />
      </div>
    </Window>
  );
}
