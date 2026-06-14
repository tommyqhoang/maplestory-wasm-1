import { useEffect } from "react";
import { useGame } from "../../store/store";
import { bridge } from "../../bridge/useBridge";

// MapleStory-standard window hotkeys, mapped to the store window keys used by
// toggleWindow / openWindows. Keyed by the lowercased KeyboardEvent.key.
const WINDOW_KEYS: Record<string, string> = {
  i: "inventory",
  e: "equipment",
  k: "skills",
  s: "stats",
};

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

function focusChat(): void {
  const input = document.querySelector<HTMLInputElement>(
    '[data-testid="hud-chat-input"]',
  );
  input?.focus();
}

// Escape: close the topmost piece of open DOM UI through its real path (NPC
// dialogs and shops route back to the engine, which sends the close packet and
// clears the payload; plain windows are pure DOM). When nothing is open, open
// the system menu — mirroring MapleStory's ESC behavior.
function onEscapePressed(): void {
  const s = useGame.getState();
  if (s.npcDialog?.active) {
    bridge.npcRespond("close", 0, "");
    return;
  }
  if (s.shop?.active) {
    bridge.shopAction("exit");
    return;
  }
  if (s.openWindows["settings"]) {
    s.closeWindow("settings");
    return;
  }
  const others = Object.keys(s.openWindows).filter(
    (n) => s.openWindows[n] && n !== "settings",
  );
  if (others.length) {
    others.forEach((n) => s.closeWindow(n));
    return;
  }
  if (s.systemMenuOpen) {
    s.setSystemMenuOpen(false);
    return;
  }
  s.setSystemMenuOpen(true);
}

/**
 * Global in-game keyboard shortcuts.
 *
 *  - i/e/k/s  toggle Inventory / Equipment / Skills / Stats
 *  - Enter    focus the chat input
 *  - Escape   close the topmost window / shop / NPC dialog
 *  - Tab      (while the chat input is focused) cycle chat channels
 *
 * Escape and chat-channel Tab arrive as custom events from the engine-isolation
 * listener in index.html, which runs in the capture phase *before* the WASM
 * engine's GLFW key handler — so it can stop those keys from reaching (and being
 * swallowed by) the engine. The plain i/e/k/s and Enter shortcuts are handled
 * here on the document and are ignored while a form field is focused.
 */
export function useHudHotkeys(): void {
  const toggleWindow = useGame((s) => s.toggleWindow);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      if (e.key === "Enter") {
        e.preventDefault();
        focusChat();
        return;
      }

      const window = WINDOW_KEYS[e.key.toLowerCase()];
      if (window) {
        e.preventDefault();
        toggleWindow(window);
      }
    }

    function onEscape() {
      onEscapePressed();
    }

    function onCycleChannel(e: Event) {
      const dir = (e as CustomEvent<{ dir: number }>).detail?.dir ?? 1;
      useGame.getState().cycleChatChannel(dir);
    }

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("maple:escape", onEscape);
    window.addEventListener("maple:chatchannel", onCycleChannel);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("maple:escape", onEscape);
      window.removeEventListener("maple:chatchannel", onCycleChannel);
    };
  }, [toggleWindow]);
}
