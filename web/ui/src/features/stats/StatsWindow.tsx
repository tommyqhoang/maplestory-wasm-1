import { useGame } from "../../store/store";
import type { StatsDetail } from "../../bridge/protocol";
import { bridge } from "../../bridge/useBridge";
import { Window } from "../../design/Window";
import { IconButton } from "../../design/primitives";

/** Primary stats that can have AP allocated to them. */
const PRIMARY: Array<{ key: "str" | "dex" | "int" | "luk"; label: string }> = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "int", label: "INT" },
  { key: "luk", label: "LUK" },
];

function Row({
  label,
  value,
  testId,
  onAllocate,
}: {
  label: string;
  value: string | number;
  testId?: string;
  onAllocate?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--sp-3)",
        padding: "2px 0",
      }}
    >
      <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
        {label}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
          color: "var(--text-primary)",
          fontSize: "0.8rem",
          fontWeight: 600,
        }}
      >
        <span data-testid={testId}>{value}</span>
        {onAllocate && (
          <IconButton onClick={onAllocate} label={`Allocate AP to ${label}`}>
            +
          </IconButton>
        )}
      </span>
    </div>
  );
}

/**
 * Pure presentational body of the Stats window. Exported separately so it can
 * be unit-tested without the zustand store gate (renderToStaticMarkup uses the
 * server snapshot and does not reflect store mutations).
 */
export function StatsBody({ detail }: { detail: StatsDetail | null }) {
  if (!detail) {
    return (
      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
        No stats available.
      </div>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0 var(--sp-4)",
        minWidth: "300px",
      }}
    >
      <div>
        {detail.name !== undefined && (
          <Row label="Name" value={detail.name} testId="stat-name" />
        )}
        <Row label="Job" value={detail.job} testId="stat-job" />
        <Row label="Level" value={detail.level} testId="stat-level" />
        <Row label="AP" value={detail.ap} testId="stat-ap" />
        {PRIMARY.map(({ key, label }) => (
          <Row
            key={key}
            label={label}
            value={detail[key]}
            testId={`stat-${key}`}
            onAllocate={
              detail.ap > 0 ? () => bridge.allocateAp(key) : undefined
            }
          />
        ))}
      </div>
      <div>
        <Row
          label="HP"
          value={`${detail.hp} / ${detail.maxHp}`}
          testId="stat-hp"
        />
        <Row
          label="MP"
          value={`${detail.mp} / ${detail.maxMp}`}
          testId="stat-mp"
        />
        <Row label="W.Atk" value={detail.watk} testId="stat-watk" />
        <Row label="M.Atk" value={detail.matk} testId="stat-matk" />
        <Row label="W.Def" value={detail.wdef} testId="stat-wdef" />
        <Row label="M.Def" value={detail.mdef} testId="stat-mdef" />
        <Row label="Accuracy" value={detail.accuracy} testId="stat-acc" />
        <Row label="Avoid" value={detail.avoid} testId="stat-avoid" />
        <Row label="Speed" value={`${detail.speed}%`} testId="stat-speed" />
        <Row label="Jump" value={`${detail.jump}%`} testId="stat-jump" />
      </div>
    </div>
  );
}

export function StatsWindow() {
  const open = useGame((s) => s.openWindows["stats"]);
  const detail = useGame((s) => s.statsDetail);
  const closeWindow = useGame((s) => s.closeWindow);

  if (!open) return null;

  return (
    <Window title="Stats" onClose={() => closeWindow("stats")}>
      <StatsBody detail={detail} />
    </Window>
  );
}
