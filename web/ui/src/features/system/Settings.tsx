import type { ReactNode } from "react";
import { useGame } from "../../store/store";
import { bridge } from "../../bridge/useBridge";
import { Window } from "../../design/Window";
import { Button } from "../../design/primitives";

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen?.();
  } else {
    void document.documentElement.requestFullscreen?.();
  }
}

// Render Quality presets → engine scene supersample factor (1x..4x). The engine
// reads it at startup (GraphicsGL), so a change applies after the client
// reloads. Note the tradeoff is the reverse of most games: this is pixel art,
// so a LOWER factor is sharper (crisp pixel edges) and faster, while a higher
// factor anti-aliases the edges — smoother but softer and more GPU-intensive.
// Labels describe the visual result rather than a misleading "low→high".
const QUALITY_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "Sharp — crisp pixels (1x)", value: 1 },
  { label: "Anti-aliased (2x)", value: 2 },
  { label: "Smooth (3x)", value: 3 },
  { label: "Smoothest (4x)", value: 4 },
];

// The supersample the engine actually booted with (so we can prompt to reload
// only when the user picks a different value).
const BOOT_SUPERSAMPLE: number = (() => {
  try {
    const v = parseInt(localStorage.getItem("maple.supersample") ?? "", 10);
    return Number.isFinite(v) && v >= 1 && v <= 4 ? v : 1;
  } catch {
    return 1;
  }
})();

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-secondary)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        fontSize: "0.8rem",
      }}
    >
      <span style={{ width: 70 }}>{label}</span>
      {children}
    </label>
  );
}

function VolumeControls({
  label,
  volume,
  muted,
  onVolume,
  onMute,
  testId,
}: {
  label: string;
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onMute: (m: boolean) => void;
  testId: string;
}) {
  return (
    <Row label={label}>
      <input
        className="ui-interactive"
        type="range"
        min={0}
        max={100}
        value={volume}
        disabled={muted}
        data-testid={testId}
        onChange={(e) => onVolume(Number(e.target.value))}
        style={{ flex: 1, opacity: muted ? 0.4 : 1 }}
      />
      <span style={{ width: 26, textAlign: "right", opacity: muted ? 0.4 : 1 }}>
        {volume}
      </span>
      <button
        type="button"
        className="ui-interactive"
        data-testid={`${testId}-mute`}
        aria-pressed={muted}
        onClick={() => onMute(!muted)}
        title={muted ? "Unmute" : "Mute"}
        style={{
          width: 30,
          cursor: "pointer",
          borderRadius: "var(--radius)",
          border: "1px solid var(--surface-border)",
          background: muted ? "var(--accent)" : "rgba(255,255,255,0.04)",
          color: muted ? "#fff" : "var(--text-secondary)",
        }}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </Row>
  );
}

/** Gameplay settings — graphics, sound, and interface, GMS Options style. */
export function Settings() {
  const open = useGame((s) => s.openWindows["settings"]);
  const closeWindow = useGame((s) => s.closeWindow);
  const bgm = useGame((s) => s.bgmVolume);
  const sfx = useGame((s) => s.sfxVolume);
  const bgmMuted = useGame((s) => s.bgmMuted);
  const sfxMuted = useGame((s) => s.sfxMuted);
  const supersample = useGame((s) => s.supersample);
  const showFps = useGame((s) => s.showFps);
  const store = useGame.getState();

  if (!open) return null;

  const needsReload = supersample !== BOOT_SUPERSAMPLE;

  return (
    <Window title="Settings" onClose={() => closeWindow("settings")}>
      <div
        data-testid="settings-window"
        style={{
          minWidth: 290,
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-4)",
        }}
      >
        <Section title="Graphics">
          <Row label="Quality">
            <select
              className="ui-interactive"
              data-testid="settings-quality"
              value={supersample}
              onChange={(e) => store.setSupersample(Number(e.target.value))}
              style={{ flex: 1 }}
            >
              {QUALITY_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Row>
          {needsReload && (
            <div
              data-testid="settings-quality-reload"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--sp-2)",
                fontSize: "0.74rem",
                color: "var(--text-secondary)",
              }}
            >
              <span>Restart to apply the new quality.</span>
              <Button
                onClick={() => window.location.reload()}
                testId="settings-quality-reload-btn"
              >
                Reload
              </Button>
            </div>
          )}
          <Button onClick={toggleFullscreen} testId="settings-fullscreen">
            Toggle Fullscreen
          </Button>
        </Section>

        <Section title="Sound">
          <VolumeControls
            label="BGM"
            volume={bgm}
            muted={bgmMuted}
            testId="settings-bgm"
            onVolume={(v) => {
              store.setBgmVolume(v);
              bridge.setBgmVolume(bgmMuted ? 0 : v);
            }}
            onMute={(m) => {
              store.setBgmMuted(m);
              bridge.setBgmVolume(m ? 0 : bgm);
            }}
          />
          <VolumeControls
            label="SFX"
            volume={sfx}
            muted={sfxMuted}
            testId="settings-sfx"
            onVolume={(v) => {
              store.setSfxVolume(v);
              bridge.setSfxVolume(sfxMuted ? 0 : v);
            }}
            onMute={(m) => {
              store.setSfxMuted(m);
              bridge.setSfxVolume(m ? 0 : sfx);
            }}
          />
        </Section>

        <Section title="Interface">
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            <input
              className="ui-interactive"
              type="checkbox"
              data-testid="settings-showfps"
              checked={showFps}
              onChange={(e) => store.setShowFps(e.target.checked)}
            />
            <span>Show FPS counter</span>
          </label>
        </Section>
      </div>
    </Window>
  );
}
