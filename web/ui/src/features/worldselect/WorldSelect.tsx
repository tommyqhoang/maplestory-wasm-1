import { useState } from "react";
import { useGame } from "../../store/store";
import { bridge } from "../../bridge/useBridge";
import type { WorldInfo } from "../../bridge/protocol";
import { Panel, Button } from "../../design/primitives";
import { EntryBackdrop } from "../entry/EntryBackdrop";

function loadLabel(loads: number[]): string {
  if (loads.length === 0) return "offline";
  const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
  if (avg < 30) return "low";
  if (avg < 70) return "medium";
  return "high";
}

interface WorldItemProps {
  world: WorldInfo;
  selected: boolean;
  onSelect: (wid: number) => void;
}

function WorldItem({ world, selected, onSelect }: WorldItemProps) {
  const load = loadLabel(world.channelloads);
  return (
    <button
      className={`world-item${selected ? " selected" : ""} ui-interactive`}
      onClick={() => onSelect(world.wid)}
      data-testid={`world-${world.wid}`}
    >
      <div>
        <div className="world-item__name">{world.name}</div>
        {world.message && (
          <div className="world-item__meta">{world.message}</div>
        )}
        <div className="world-item__meta">
          {world.channelcount} channel{world.channelcount !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="world-item__load">
        <LoadDot load={load} />
        {load}
      </div>
    </button>
  );
}

function LoadDot({ load }: { load: string }) {
  const color =
    load === "low"
      ? "#22c55e"
      : load === "medium"
        ? "#f59e0b"
        : load === "high"
          ? "#ef4444"
          : "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        marginRight: 5,
        verticalAlign: "middle",
      }}
    />
  );
}

export function WorldSelect() {
  const worlds = useGame((s) => s.worlds);
  const [selectedWid, setSelectedWid] = useState<number | null>(null);

  const selectedWorld = worlds.find((w) => w.wid === selectedWid) ?? null;

  function handleSelectWorld(wid: number) {
    setSelectedWid(wid);
  }

  function handleSelectChannel(channelIndex: number) {
    if (selectedWid === null) return;
    bridge.requestCharlist(selectedWid, channelIndex);
  }

  return (
    <EntryBackdrop>
      <Panel className="entry-card entry-card--wide">
        <div className="entry-logo">
          <h1 className="entry-logo__title">Select World</h1>
          <p className="entry-logo__sub">Choose a world and channel</p>
        </div>

        {worlds.length === 0 ? (
          <div className="entry-empty">No worlds available.</div>
        ) : (
          <div className="world-list">
            {worlds.map((w) => (
              <WorldItem
                key={w.wid}
                world={w}
                selected={w.wid === selectedWid}
                onSelect={handleSelectWorld}
              />
            ))}
          </div>
        )}

        {selectedWorld !== null && (
          <div>
            <div className="section-label">Channels — {selectedWorld.name}</div>
            <div className="channel-grid">
              {Array.from({ length: selectedWorld.channelcount }, (_, i) => (
                <button
                  key={i}
                  className="channel-btn ui-interactive"
                  onClick={() => handleSelectChannel(i)}
                  data-testid={`channel-${i}`}
                >
                  Ch {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="entry-actions">
          <Button onClick={() => bridge.backToLogin()}>Back</Button>
        </div>
      </Panel>
    </EntryBackdrop>
  );
}
