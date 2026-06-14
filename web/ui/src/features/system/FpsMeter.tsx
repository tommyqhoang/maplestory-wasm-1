import { useEffect, useState } from "react";
import { useGame } from "../../store/store";

/** Lightweight FPS counter overlay, toggled from Settings → Interface. */
export function FpsMeter() {
  const show = useGame((s) => s.showFps);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!show) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();

    const loop = (now: number) => {
      frames++;
      const elapsed = now - last;
      if (elapsed >= 500) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [show]);

  if (!show) return null;

  return (
    <div
      data-testid="fps-meter"
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 50,
        padding: "2px 8px",
        fontFamily: "var(--font)",
        fontSize: "0.72rem",
        fontWeight: 700,
        color: fps >= 50 ? "#7CFC7C" : fps >= 30 ? "#ffd34d" : "#ff6b6b",
        background: "rgba(0, 0, 0, 0.55)",
        borderRadius: "var(--radius)",
        pointerEvents: "none",
        letterSpacing: "0.03em",
      }}
    >
      {fps} FPS
    </div>
  );
}
