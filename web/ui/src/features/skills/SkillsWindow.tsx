import { useGame } from "../../store/store";
import type { SkillEntry } from "../../bridge/protocol";
import { AssetImage } from "../../design/AssetImage";
import { Tooltip } from "../../design/Tooltip";
import { Window } from "../../design/Window";

const COLUMNS = 4;
const CELL_PX = 40;

/**
 * Pure presentational body of the Skills window. Exported separately so it can
 * be unit-tested without the zustand store gate (renderToStaticMarkup uses the
 * server snapshot and does not reflect store mutations). Mirrors InventoryBody.
 */
export function SkillsBody({ skills }: { skills: SkillEntry[] }) {
  if (skills.length === 0) {
    return (
      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
        No skills learned.
      </div>
    );
  }

  const cells = skills.map((skill) => (
    <Tooltip
      key={skill.skillid}
      content={
        <>
          Skill #{skill.skillid}
          {" · Lv "}
          {skill.masterlevel > 0
            ? `${skill.level}/${skill.masterlevel}`
            : skill.level}
        </>
      }
    >
      <div
        data-testid="skills-cell"
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
        <AssetImage
          assetKey={`skill/${skill.skillid}`}
          alt={`Skill ${skill.skillid}`}
          style={{ width: CELL_PX - 8, height: CELL_PX - 8 }}
        />
        <span
          data-testid="skills-level"
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
          {skill.masterlevel > 0
            ? `${skill.level}/${skill.masterlevel}`
            : skill.level}
        </span>
      </div>
    </Tooltip>
  ));

  return (
    <div style={{ minWidth: COLUMNS * CELL_PX + 24 }}>
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

export function SkillsWindow() {
  const open = useGame((s) => s.openWindows["skills"]);
  const skills = useGame((s) => s.skills);
  const closeWindow = useGame((s) => s.closeWindow);

  if (!open) return null;

  return (
    <Window title="Skills" onClose={() => closeWindow("skills")}>
      <div data-testid="skills-window">
        <SkillsBody skills={skills} />
      </div>
    </Window>
  );
}
