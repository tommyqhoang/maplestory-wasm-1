import { MapleBridge } from "./MapleBridge";

function transportToEngine(json: string): void {
  const mod = (
    window as unknown as { Module?: { ccall?: (...a: unknown[]) => unknown } }
  ).Module;
  if (mod?.ccall) {
    mod.ccall("maple_bridge_send", null, ["string"], [json]);
  } else {
    console.warn("[bridge] engine not ready, dropping command", json);
  }
}

export const bridge = new MapleBridge(transportToEngine);

(window as unknown as { MapleBridge: MapleBridge }).MapleBridge = bridge;
