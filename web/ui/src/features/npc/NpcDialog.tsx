import { useGame } from "../../store/store";
import type { NpcDialogPayload } from "../../bridge/protocol";
import { bridge } from "../../bridge/useBridge";
import { Panel, Button } from "../../design/primitives";
import "../entry/entry.css";

/**
 * Pure presentational body of the NPC dialogue modal. Exported separately so it
 * can be unit-tested without the zustand store gate (renderToStaticMarkup uses
 * the server snapshot and does not reflect store mutations).
 *
 * Buttons are chosen by dialog.mode and each routes back to the engine via
 * bridge.npcRespond, which drives the live in-canvas UINpcTalk send logic.
 */
export function NpcDialogBody({ dialog }: { dialog: NpcDialogPayload }) {
  const respond = (action: string, selection = 0, text = "") =>
    bridge.npcRespond(action, selection, text);

  return (
    <Panel
      className="ui-interactive"
      style={{ minWidth: "360px", maxWidth: "480px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--sp-3)",
          marginBottom: "var(--sp-3)",
        }}
      >
        {/* MapleStory dialogue text may contain \r\n / formatting codes; we
            preserve newlines via white-space and show the text readably. */}
        <div
          data-testid="npc-dialog-text"
          style={{
            whiteSpace: "pre-wrap",
            color: "var(--text-primary)",
            fontSize: "0.85rem",
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          {dialog.text}
        </div>
        <button
          className="ui-interactive"
          aria-label="Close"
          data-testid="npc-dialog-close"
          onClick={() => respond("close")}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            fontSize: "1.1rem",
            lineHeight: 1,
            cursor: "pointer",
            padding: "0 var(--sp-1)",
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--sp-2)",
          justifyContent: "flex-end",
        }}
      >
        <NpcDialogActions dialog={dialog} respond={respond} />
      </div>
    </Panel>
  );
}

function NpcDialogActions({
  dialog,
  respond,
}: {
  dialog: NpcDialogPayload;
  respond: (action: string, selection?: number, text?: string) => void;
}) {
  switch (dialog.mode) {
    case "ok":
      return (
        <Button onClick={() => respond("ok")} testId="npc-btn-ok">
          OK
        </Button>
      );
    case "next":
      return (
        <Button onClick={() => respond("next")} testId="npc-btn-next">
          Next
        </Button>
      );
    case "nextprev":
      return (
        <>
          <Button onClick={() => respond("prev")} testId="npc-btn-prev">
            Prev
          </Button>
          <Button onClick={() => respond("next")} testId="npc-btn-next">
            Next
          </Button>
        </>
      );
    case "yesno":
      return (
        <>
          <Button onClick={() => respond("yes")} testId="npc-btn-yes">
            Yes
          </Button>
          <Button onClick={() => respond("no")} testId="npc-btn-no">
            No
          </Button>
        </>
      );
    case "acceptdecline":
      return (
        <>
          <Button onClick={() => respond("accept")} testId="npc-btn-accept">
            Accept
          </Button>
          <Button onClick={() => respond("decline")} testId="npc-btn-decline">
            Decline
          </Button>
        </>
      );
    case "textentry":
      return <NpcTextEntry respond={respond} />;
    case "selection":
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-1)",
            width: "100%",
          }}
        >
          {(dialog.selections ?? []).map((sel) => (
            <Button
              key={sel.idx}
              onClick={() => respond("select", sel.idx)}
              testId={`npc-select-${sel.idx}`}
              style={{ textAlign: "left", justifyContent: "flex-start" }}
            >
              {sel.label}
            </Button>
          ))}
        </div>
      );
    default:
      // Unknown mode: still offer a confirm so the player is never trapped.
      return (
        <Button onClick={() => respond("ok")} testId="npc-btn-ok">
          OK
        </Button>
      );
  }
}

function NpcTextEntry({
  respond,
}: {
  respond: (action: string, selection?: number, text?: string) => void;
}) {
  return (
    <form
      style={{ display: "flex", gap: "var(--sp-2)", width: "100%" }}
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem(
          "npc-text",
        ) as HTMLInputElement | null;
        respond("submitText", 0, input?.value ?? "");
      }}
    >
      <input
        name="npc-text"
        data-testid="npc-text-input"
        className="entry-input ui-interactive"
        style={{ flex: 1 }}
      />
      <Button onClick={() => {}} testId="npc-btn-ok">
        OK
      </Button>
    </form>
  );
}

export function NpcDialog() {
  const dialog = useGame((s) => s.npcDialog);

  if (!dialog?.active) return null;

  return (
    <div
      data-testid="npc-dialog"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
      }}
    >
      <NpcDialogBody dialog={dialog} />
    </div>
  );
}
