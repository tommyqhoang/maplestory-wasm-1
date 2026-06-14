import { useGame } from "../store/store";
import { Hud } from "../features/hud/Hud";

export function App() {
  const scene = useGame((s) => s.scene);

  if (scene === "ingame") {
    return <Hud />;
  }

  // Dev-only probe: shows bridge state during loading/charselect scenes
  if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    return <DevProbe />;
  }

  return null;
}

function DevProbe() {
  const scene = useGame((s) => s.scene);
  const stats = useGame((s) => s.stats);
  const lastPong = useGame((s) => s.lastPong);
  return (
    <div className="phase0-probe ui-interactive">
      <div>scene: {scene}</div>
      <div>
        HP: {stats.hp} / {stats.maxHp}
      </div>
      <div>
        MP: {stats.mp} / {stats.maxMp}
      </div>
      <div>last pong: {lastPong ?? "—"}</div>
    </div>
  );
}
