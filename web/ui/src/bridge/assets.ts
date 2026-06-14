import { useGame } from "../store/store";
import { bridge } from "./useBridge";

// Keys for which a requestAsset has already been dispatched. Prevents spamming
// the engine with duplicate requests while one is in flight (the response may
// take a frame or two to come back as an `asset` message).
const inFlight = new Set<string>();

// Reset the in-flight tracking. Exposed for tests; not used by app code.
export function _resetAssetRequests(): void {
  inFlight.clear();
}

// Resolve a WZ asset (item/equip/skill icon) to a data URL. Reads it from the
// store if already cached, otherwise asks the engine for it exactly once and
// returns undefined until the engine replies with an `asset` message.
export function useAsset(key: string): string | undefined {
  const dataUrl = useGame((s) => s.assets[key]);

  if (dataUrl === undefined && key && !inFlight.has(key)) {
    inFlight.add(key);
    bridge.requestAsset(key);
  }

  return dataUrl;
}
