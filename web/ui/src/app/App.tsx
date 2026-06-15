import { useEffect } from "react";
import { useGame } from "../store/store";
import { Hud } from "../features/hud/Hud";
import { Login } from "../features/login/Login";
import { WorldSelect } from "../features/worldselect/WorldSelect";
import { CharSelect } from "../features/charselect/CharSelect";
import { EntryBackdrop } from "../features/entry/EntryBackdrop";
import { Disconnected } from "../features/system/Disconnected";
import "../features/entry/entry.css";

function Scene({ scene }: { scene: string }) {
  if (scene === "ingame") {
    return <Hud />;
  }

  if (scene === "login") {
    return <Login />;
  }

  if (scene === "worldselect") {
    return <WorldSelect />;
  }

  if (scene === "charselect") {
    return <CharSelect />;
  }

  // "loading" or any unknown scene — minimal loading state with backdrop
  return (
    <EntryBackdrop>
      <div className="entry-loading">
        <div className="entry-spinner" />
        <span>Connecting…</span>
      </div>
    </EntryBackdrop>
  );
}

export function App() {
  const scene = useGame((s) => s.scene);
  const connectionLost = useGame((s) => s.connectionLost);

  // Expose scene on body so CSS can show/hide the game canvas (#container).
  // We use visibility:hidden (not display:none) to avoid disturbing the WASM engine.
  useEffect(() => {
    document.body.dataset.scene = scene;
  }, [scene]);

  return (
    <>
      <Scene scene={scene} />
      {connectionLost && <Disconnected />}
    </>
  );
}

// Dev probe removed — real scene components now handle all pre-ingame states.
// Add DEV-only tooling here if needed in future without changing prod path.
