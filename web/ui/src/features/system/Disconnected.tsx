import { Panel, Button } from "../../design/primitives";
import "./disconnected.css";

// Shown when the engine reports the game socket dropped. The native loop has
// already halted at this point, so the only path forward is a full reload —
// the button restarts the client rather than pretending we can resume.
export function Disconnected() {
  return (
    <div className="disconnect-overlay" data-testid="disconnect-overlay">
      <Panel className="entry-card disconnect-card" style={{ maxWidth: 380 }}>
        <div className="entry-logo">
          <h1 className="entry-logo__title">Connection Lost</h1>
          <p className="entry-logo__sub">
            You were disconnected from the server.
          </p>
        </div>
        <div className="entry-actions">
          <Button
            onClick={() => window.location.reload()}
            testId="disconnect-reconnect"
          >
            Return to Login
          </Button>
        </div>
      </Panel>
    </div>
  );
}
