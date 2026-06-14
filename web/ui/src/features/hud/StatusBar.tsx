import { useGame } from "../../store/store";
import { Panel, Button, GaugeBar } from "../../design/primitives";

const MENU_BUTTONS: Array<{ label: string; window: string }> = [
  { label: "Stats", window: "stats" },
  { label: "Inventory", window: "inventory" },
  { label: "Equip", window: "equipment" },
  { label: "Skills", window: "skills" },
];

export function StatusBar() {
  const toggleWindow = useGame((s) => s.toggleWindow);
  const name = useGame((s) => s.character.name);
  const job = useGame((s) => s.character.job);
  const level = useGame((s) => s.stats.level);
  const hp = useGame((s) => s.stats.hp);
  const maxHp = useGame((s) => s.stats.maxHp);
  const mp = useGame((s) => s.stats.mp);
  const maxMp = useGame((s) => s.stats.maxMp);
  const exp = useGame((s) => s.stats.exp);
  const expNext = useGame((s) => s.stats.expNext);

  return (
    <Panel className="hud-status-bar">
      <div className="hud-char-row">
        <span className="hud-char-name">{name || "—"}</span>
        <span className="hud-char-job">{job || ""}</span>
        <span className="hud-char-level">Lv.{level}</span>
      </div>

      <div className="hud-gauges">
        <GaugeBar
          label="HP"
          value={hp}
          max={maxHp}
          color="var(--gauge-hp)"
          testId="hud-hp"
        />
        <GaugeBar
          label="MP"
          value={mp}
          max={maxMp}
          color="var(--gauge-mp)"
          testId="hud-mp"
        />
        <GaugeBar
          label="EXP"
          value={exp}
          max={expNext}
          color="var(--gauge-exp)"
          testId="hud-exp"
        />
      </div>

      <div className="hud-menu-row">
        {MENU_BUTTONS.map(({ label, window }) => (
          <Button key={window} onClick={() => toggleWindow(window)}>
            {label}
          </Button>
        ))}
      </div>
    </Panel>
  );
}
