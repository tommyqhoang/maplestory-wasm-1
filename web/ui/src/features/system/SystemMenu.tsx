import type { MouseEvent } from "react";
import { useGame } from "../../store/store";
import { Panel, Button } from "../../design/primitives";

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen?.();
  } else {
    void document.documentElement.requestFullscreen?.();
  }
}

/**
 * MapleStory-style system menu, opened by pressing Escape with nothing else
 * open. Centered modal with the common navigation actions.
 */
export function SystemMenu() {
  const open = useGame((s) => s.systemMenuOpen);
  const setOpen = useGame((s) => s.setSystemMenuOpen);
  const toggleWindow = useGame((s) => s.toggleWindow);

  if (!open) return null;

  function openSettings() {
    setOpen(false);
    if (!useGame.getState().openWindows["settings"]) {
      toggleWindow("settings");
    }
  }

  function logOut() {
    // Cleanest reliable return to the login screen: reload the client.
    window.location.reload();
  }

  return (
    <div
      data-testid="system-menu"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.55)",
      }}
      onClick={() => setOpen(false)}
    >
      <div
        className="ui-interactive"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <Panel style={{ minWidth: 260 }}>
          <div
            style={{
              fontSize: "1.05rem",
              fontWeight: 800,
              textAlign: "center",
              marginBottom: "var(--sp-3)",
              color: "var(--text-primary)",
            }}
          >
            Menu
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-2)",
            }}
          >
            <Button onClick={openSettings} testId="system-menu-settings">
              Settings
            </Button>
            <Button onClick={toggleFullscreen} testId="system-menu-fullscreen">
              Toggle Fullscreen
            </Button>
            <Button onClick={logOut} testId="system-menu-logout">
              Log Out
            </Button>
            <Button onClick={() => setOpen(false)} testId="system-menu-resume">
              Resume
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
