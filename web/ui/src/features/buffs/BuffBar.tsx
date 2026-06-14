import { useGame } from "../../store/store";
import type { BuffEntry } from "../../bridge/protocol";
import { AssetImage } from "../../design/AssetImage";

const CELL_PX = 36;

// Formats a remaining-buff duration (milliseconds) into a short label. Shows
// minutes (e.g. "3m") for anything a minute or longer, otherwise whole seconds
// ("45s"). Non-positive durations render nothing.
export function formatDuration(ms: number): string {
  if (ms <= 0) return "";
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds >= 60) {
    const minutes = Math.ceil(totalSeconds / 60);
    return `${minutes}m`;
  }
  return `${totalSeconds}s`;
}

/**
 * Pure presentational body of the buff bar. Exported separately so it can be
 * unit-tested without the zustand store gate (mirrors SkillsBody convention).
 */
export function BuffBarBody({ buffs }: { buffs: BuffEntry[] }) {
  if (buffs.length === 0) return null;

  return (
    <div
      data-testid="buff-bar"
      style={{
        display: "flex",
        flexDirection: "row-reverse",
        gap: "var(--sp-1)",
        flexWrap: "wrap",
        justifyContent: "flex-start",
        pointerEvents: "none",
      }}
    >
      {buffs.map((buff) => {
        const label = formatDuration(buff.duration);
        return (
          <div
            key={buff.skillid}
            data-testid="buff-icon"
            style={{
              position: "relative",
              width: CELL_PX,
              height: CELL_PX,
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AssetImage
              assetKey={`skill/${buff.skillid}`}
              alt={`Buff ${buff.skillid}`}
              style={{ width: CELL_PX - 8, height: CELL_PX - 8 }}
            />
            {label && (
              <span
                data-testid="buff-time"
                style={{
                  position: "absolute",
                  right: 1,
                  bottom: 0,
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  textShadow: "0 0 2px #000, 0 0 2px #000",
                  pointerEvents: "none",
                }}
              >
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BuffBar() {
  const buffs = useGame((s) => s.buffs);

  if (buffs.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "var(--sp-4)",
        right: "var(--sp-4)",
        zIndex: 50,
        maxWidth: "60vw",
      }}
    >
      <BuffBarBody buffs={buffs} />
    </div>
  );
}
