import { renderToStaticMarkup } from "react-dom/server";
import { NpcDialogBody } from "./NpcDialog";
import type { NpcDialogPayload } from "../../bridge/protocol";

// renderToStaticMarkup uses React's server snapshot, so store-gated content is
// not reflected in markup (same convention as StatsWindow.test.tsx). The body
// is rendered directly via the pure NpcDialogBody component.

test("NpcDialogBody with mode 'ok' shows an OK button", () => {
  const dialog: NpcDialogPayload = {
    active: true,
    npcid: 1,
    mode: "ok",
    text: "Hello there.",
  };
  const html = renderToStaticMarkup(<NpcDialogBody dialog={dialog} />);
  expect(html).toContain('data-testid="npc-btn-ok"');
  expect(html).toContain("Hello there.");
});

test("NpcDialogBody with mode 'selection' shows the selection labels", () => {
  const dialog: NpcDialogPayload = {
    active: true,
    npcid: 1,
    mode: "selection",
    text: "Choose:",
    selections: [
      { idx: 0, label: "Train me" },
      { idx: 1, label: "Leave" },
    ],
  };
  const html = renderToStaticMarkup(<NpcDialogBody dialog={dialog} />);
  expect(html).toContain("Train me");
  expect(html).toContain("Leave");
  expect(html).toContain('data-testid="npc-select-0"');
  expect(html).toContain('data-testid="npc-select-1"');
});

test("NpcDialogBody with mode 'yesno' shows Yes and No buttons", () => {
  const dialog: NpcDialogPayload = {
    active: true,
    npcid: 1,
    mode: "yesno",
    text: "Continue?",
  };
  const html = renderToStaticMarkup(<NpcDialogBody dialog={dialog} />);
  expect(html).toContain('data-testid="npc-btn-yes"');
  expect(html).toContain('data-testid="npc-btn-no"');
});

test("NpcDialogBody always renders a close button", () => {
  const dialog: NpcDialogPayload = {
    active: true,
    npcid: 1,
    mode: "ok",
    text: "x",
  };
  const html = renderToStaticMarkup(<NpcDialogBody dialog={dialog} />);
  expect(html).toContain('data-testid="npc-dialog-close"');
});
