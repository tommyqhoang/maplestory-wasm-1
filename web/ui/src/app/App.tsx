import { useGame } from "../store/store";
import { bridge } from "../bridge/useBridge";

export function App() {
  const scene = useGame((s) => s.scene);
  const stats = useGame((s) => s.stats);
  const lastPong = useGame((s) => s.lastPong);
  return (
    <div className="phase0-probe ui-interactive">
      <div>scene: {scene}</div>
      <div>HP: {stats.hp} / {stats.maxHp}</div>
      <div>MP: {stats.mp} / {stats.maxMp}</div>
      <div>last pong: {lastPong ?? "—"}</div>
      <button onClick={() => bridge.ping(Date.now() % 100000)}>ping engine</button>
    </div>
  );
}
