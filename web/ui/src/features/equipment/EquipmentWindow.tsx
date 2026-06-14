import { useGame } from "../../store/store";
import type { EquipSlot } from "../../bridge/protocol";
import { AssetImage } from "../../design/AssetImage";
import { Tooltip } from "../../design/Tooltip";
import { Window } from "../../design/Window";

/**
 * Equipment slots shown in the window, keyed by the engine's Equipslot::Id
 * values (see src/client/Character/Look/EquipSlot.h). Laid out as a simple
 * labeled grid.
 */
const SLOTS: Array<{ id: number; label: string }> = [
  { id: 1, label: "Hat" },
  { id: 2, label: "Face" },
  { id: 3, label: "Eye" },
  { id: 4, label: "Earring" },
  { id: 5, label: "Top" },
  { id: 6, label: "Bottom" },
  { id: 7, label: "Shoes" },
  { id: 8, label: "Gloves" },
  { id: 9, label: "Cape" },
  { id: 10, label: "Shield" },
  { id: 11, label: "Weapon" },
  { id: 12, label: "Ring 1" },
  { id: 13, label: "Ring 2" },
  { id: 15, label: "Ring 3" },
  { id: 16, label: "Ring 4" },
  { id: 17, label: "Pendant" },
  { id: 49, label: "Medal" },
  { id: 50, label: "Belt" },
];

const CELL_PX = 40;

/**
 * Pure presentational body of the Equipment window. Exported separately so it
 * can be unit-tested without the zustand store gate.
 */
export function EquipmentBody({ equipment }: { equipment: EquipSlot[] }) {
  const bySlot = new Map<number, EquipSlot>();
  for (const e of equipment) {
    bySlot.set(e.slot, e);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, auto)",
        gap: "var(--sp-3)",
        justifyContent: "center",
      }}
    >
      {SLOTS.map(({ id, label }) => {
        const item = bySlot.get(id);
        return (
          <div
            key={id}
            data-testid="equipment-slot"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
            }}
          >
            <div
              style={{
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
                <Tooltip content={`${label} — Equip #${item.itemid}`}>
                  <AssetImage
                    assetKey={`equip/${item.itemid}`}
                    alt={`${label} (${item.itemid})`}
                    style={{ width: CELL_PX - 8, height: CELL_PX - 8 }}
                  />
                </Tooltip>
              )}
            </div>
            <span
              style={{
                fontSize: "0.6rem",
                color: "var(--text-muted)",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function EquipmentWindow() {
  const open = useGame((s) => s.openWindows["equipment"]);
  const equipment = useGame((s) => s.equipment);
  const closeWindow = useGame((s) => s.closeWindow);

  if (!open) return null;

  return (
    <Window title="Equipment" onClose={() => closeWindow("equipment")}>
      <div data-testid="equipment-window">
        <EquipmentBody equipment={equipment} />
      </div>
    </Window>
  );
}
